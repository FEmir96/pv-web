// playverse-web/app/checkout/alquiler/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ValidationError } from "@/components/ui/validation-error";
import { useToast } from "@/hooks/use-toast";
import { validatePaymentForm, validateRentalWeeks, formatExpirationInput } from "@/lib/validation";

type PM = {
  _id: string;
  brand: "visa" | "mastercard" | "amex" | "otro";
  last4: string;
  expMonth: number;
  expYear: number;
};

/* === helpers de precios === */
const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s0 = v.trim().replace(/\s+/g, "");
    const s1 = s0.replace(/[^\d.,-]/g, "");
    const hasComma = s1.includes(",");
    const hasDot = s1.includes(".");
    let s = s1;
    if (hasComma && hasDot) s = s1.replace(/\./g, "").replace(",", ".");
    else if (hasComma) s = s1.replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

function pickRentPrice(game: any): number | undefined {
  return (
    num(game?.weekly_price) ??
    num(game?.weeklyPrice) ??
    num(game?.rent_price) ??
    num(game?.rental_price) ??
    num(game?.rentPrice) ??
    num(game?.price_weekly) ??
    num(game?.weekly) ??
    num(game?.pricing?.rent) ??
    num(game?.prices?.rentWeekly) ??
    (typeof game?.rentalPriceCents === "number" ? game.rentalPriceCents / 100 : undefined)
  );
}

function pickCurrency(game: any): string {
  return game?.currency || game?.prices?.currency || game?.pricing?.currency || "USD";
}

function computeIsPremium(g: any): { premium: boolean; reason: string } {
  if (!g) return { premium: false, reason: "game=null" };
  const boolCandidates = [
    { key: "is_premium", val: g?.is_premium },
    { key: "isPremium", val: g?.isPremium },
    { key: "premium", val: g?.premium },
    { key: "requiresPremium", val: g?.requiresPremium },
    { key: "only_premium", val: g?.only_premium },
  ];
  const hitBool = boolCandidates.find((c) => c.val === true);
  if (hitBool) return { premium: true, reason: `bool:${hitBool.key}=true` };

  const norm = (v: any) => String(v ?? "").toLowerCase();
  const strFields = ["category", "tier", "access", "plan", "level", "type", "status"];
  for (const f of strFields) if (norm(g?.[f]).includes("premium")) return { premium: true, reason: `str:${f}~premium` };
  const arrFields = ["categories", "tags", "labels", "flags"];
  for (const f of arrFields) {
    const arr = g?.[f];
    if (Array.isArray(arr) && arr.some((x: any) => norm(x).includes("premium"))) return { premium: true, reason: `arr:${f} has premium` };
  }
  try {
    const flatText = Object.values(g).filter((v: any) => typeof v === "string").map((v: string) => v.toLowerCase()).join("|");
    if (flatText.includes("premium")) return { premium: true, reason: "flat:string contains premium" };
  } catch {}
  return { premium: false, reason: "no-premium-field-detected" };
}

export default function RentCheckoutPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const forcePremium = sp?.get("forcePremium") === "1";
  const { toast } = useToast();

  const { data: session, status } = useSession();

  const loginEmail = useMemo(
    () => (status === "authenticated" ? session?.user?.email?.toLowerCase() ?? null : null),
    [status, session?.user?.email]
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!loginEmail) router.replace(`/auth/login?next=%2F`);
  }, [status, loginEmail, router]);

  // Perfil
  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loginEmail ? { email: loginEmail } : "skip"
  ) as | { _id: Id<"profiles">; role?: "free" | "premium" | "admin" } | null | undefined;

  const userRole = (profile?.role ?? "free") as "free" | "premium" | "admin";
  const isPremiumViewer = userRole === "premium" || userRole === "admin";
  const discountRate = isPremiumViewer ? 0.1 : 0;

  // Juego
  const game = useQuery(
    api.queries.getGameById?.getGameById as any,
    api.queries.getGameById?.getGameById ? ({ id: params.id as Id<"games"> } as any) : "skip"
  ) as any | null | undefined;

  // Premium detection
  const { isGamePremium } = useMemo(() => {
    if (forcePremium) return { isGamePremium: true };
    const { premium } = computeIsPremium(game as any);
    return { isGamePremium: premium };
  }, [game, forcePremium]);

  const payDisabled = isGamePremium && userRole === "free";

  // Rentals del usuario
  const rentalsByUser = useQuery(
    api.queries.getUserRentals?.getUserRentals as any,
    profile?._id && api.queries.getUserRentals?.getUserRentals ? { userId: profile._id } : "skip"
  ) as any[] | undefined;

  const hasActiveRental = useMemo(() => {
    if (!Array.isArray(rentalsByUser)) return false;
    const now = Date.now();
    return rentalsByUser.some((r: any) => {
      if (String(r.gameId) !== String(params.id)) return false;
      const end = r.expiresAt ?? r.endAt ?? r.endsAt ?? r.expires_at;
      return typeof end === "number" && end > now;
    });
  }, [rentalsByUser, params.id]);

  // Redirigir si ya alquilado
  const redirectedToExtend = useRef(false);
  useEffect(() => {
    if (!profile?._id) return;
    if (typeof game === "undefined") return;
    if (redirectedToExtend.current) return;
    if (hasActiveRental) {
      redirectedToExtend.current = true;
      router.replace(`/checkout/extender/${params.id}?next=%2F`);
    }
  }, [hasActiveRental, profile?._id, game, router, params.id]);

  // Métodos guardados
  const pmSupported = Boolean(api.queries.getPaymentMethods?.getPaymentMethods);
  const methods = useQuery(
    (api.queries.getPaymentMethods?.getPaymentMethods as any) || (null as any),
    pmSupported && profile?._id ? { userId: profile._id } : "skip"
  ) as PM[] | undefined;

  const savePaymentMethod = useMutation(api.mutations.savePaymentMethod?.savePaymentMethod as any);
  const startRental = useMutation(api.transactions.startRental as any);

  // UI
  const [weeks, setWeeks] = useState(2);
  const [useSaved, setUseSaved] = useState(true);
  const [rememberNew, setRememberNew] = useState(false);
  const [methodId, setMethodId] = useState<string | null>(null);

  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const [processing, setProcessing] = useState(false);
  
  // Estados de validación
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showValidation, setShowValidation] = useState(false);

  // Precio semanal real + descuento
  const currency = useMemo(() => pickCurrency(game), [game]);
  const weeklyPriceBase = useMemo(() => pickRentPrice(game) ?? 14.99, [game]);
  const weeklyPrice = useMemo(
    () => +(weeklyPriceBase * (1 - discountRate)).toFixed(2),
    [weeklyPriceBase, discountRate]
  );
  const total = useMemo(() => +(weeklyPrice * weeks).toFixed(2), [weeklyPrice, weeks]);

  const normalizeBrand = (b?: string): PM["brand"] => {
    const s = (b || "").toLowerCase();
    if (s.includes("visa")) return "visa";
    if (s.includes("master")) return "mastercard";
    if (s.includes("amex") || s.includes("american")) return "amex";
    return "otro";
  };

  const pmFromProfile: PM | null = useMemo(() => {
    const p: any = profile;
    if (!p) return null;
    const arr = p.paymentMethods ?? p.payment_methods;
    if (Array.isArray(arr) && arr.length > 0) {
      const m = arr[0] || {};
      return {
        _id: m._id ?? "profile",
        brand: normalizeBrand(m.brand),
        last4: String(m.last4 ?? "").slice(-4),
        expMonth: Number(m.expMonth ?? m.exp_month ?? 0),
        expYear: Number(m.expYear ?? m.exp_year ?? 0),
      };
    }
    const last4 = p.pmLast4 ?? p.cardLast4 ?? p.last4;
    const expMonth = p.pmExpMonth ?? p.cardExpMonth ?? p.expMonth;
    const expYear = p.pmExpYear ?? p.cardExpYear ?? p.expYear;
    const brand = p.pmBrand ?? p.cardBrand ?? p.brand;
    if (last4 && expMonth && expYear && brand) {
      return {
        _id: "profile",
        brand: normalizeBrand(brand),
        last4: String(last4).slice(-4),
        expMonth: Number(expMonth),
        expYear: Number(expYear),
      };
    }
    return null;
  }, [profile]);

  const primaryPM = (methods && methods.length > 0 ? methods[0] : null) ?? pmFromProfile;

  // Inicializar método seleccionado
  useEffect(() => {
    if (useSaved && !methodId && Array.isArray(methods) && methods.length > 0) {
      setMethodId(String(methods[0]._id));
    }
    if (!useSaved) setMethodId(null);
  }, [methods, methodId, useSaved]);

  // Alinear el toggle con la disponibilidad real de métodos guardados
  useEffect(() => {
    setUseSaved((methods?.length ?? 0) > 0);
  }, [methods]);

  const brandLabel = (b: string) =>
    b === "visa" ? "Visa" : b === "mastercard" ? "Mastercard" : b === "amex" ? "Amex" : "Tarjeta";

  const onRent = async () => {
    if (processing) return;
    if (!profile?._id || !game?._id) return;

    // Limpiar errores previos
    setValidationErrors({});
    setShowValidation(true);

    if (hasActiveRental) {
      router.replace(`/checkout/extender/${params.id}?next=%2F`);
      return;
    }
    if (payDisabled) return;

    // Validación de semanas
    const weeksValidation = validateRentalWeeks(weeks);
    if (weeksValidation) {
      setValidationErrors({ weeks: weeksValidation.message });
      toast({
        title: "Número de semanas inválido",
        description: weeksValidation.message,
        variant: "destructive",
      });
      return;
    }

    // Validación: si usás guardadas, debe haber al menos una y estar seleccionada
    if (useSaved && (!Array.isArray(methods) || methods.length === 0)) {
      toast({
        title: "No hay tarjetas guardadas",
        description: "Destildá 'Usar tarjeta guardada' y completá los datos de tarjeta.",
        variant: "destructive",
      });
      return;
    }
    if (useSaved && Array.isArray(methods) && methods.length > 0 && !methodId) {
      toast({
        title: "Selecciona un método de pago",
        description: "Debes elegir una tarjeta para continuar.",
        variant: "destructive",
      });
      return;
    }

    // Validación tarjeta nueva
    if (!useSaved) {
      const validation = validatePaymentForm({ holder, number, exp, cvc });
      
      if (!validation.isValid) {
        const errors: Record<string, string> = {};
        validation.errors.forEach(error => {
          errors[error.field] = error.message;
        });
        setValidationErrors(errors);
        
        toast({
          title: "Datos de tarjeta inválidos",
          description: "Por favor corrige los errores marcados en rojo.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setProcessing(true);

      if (!useSaved && rememberNew && api.mutations.savePaymentMethod?.savePaymentMethod) {
        await savePaymentMethod({
          userId: profile._id,
          fullNumber: number,
          exp,
          cvv: cvc,
          brand: undefined,
        } as any);
      }

      // Pasamos el weeklyPrice ya con descuento aplicado
      await startRental({
        userId: profile._id,
        gameId: game._id,
        weeks,
        weeklyPrice,
        currency,
      } as any);

      // Guardar payload de éxito y redirigir a página de confirmación
      try {
        const payload = {
          gameId: String(game._id),
          title,
          cover,
          weeks,
          amount: total,
          currency,
        };
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pv_rental_success", JSON.stringify(payload));
        }
      } catch (e) {
        // ignore
      }

      startTransition(() => {
        router.replace("/checkout/alquiler/success");
        router.refresh();
      });
      setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname !== "/checkout/alquiler/success")
          window.location.assign("/checkout/alquiler/success");
      }, 600);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("ALREADY_RENTED_ACTIVE")) {
        router.replace(`/checkout/extender/${params.id}?next=%2F`);
        return;
      }
      toast({
        title: "No se pudo iniciar el alquiler",
        description: e?.message ?? "Intentá nuevamente.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!loginEmail) {
    return (
      <div className="container mx-auto px-4 py-16">
        <p className="text-slate-300">Redirigiendo al login…</p>
      </div>
    );
  }

  const title = game?.title ?? "Juego";
  const cover = game?.cover_url ?? "/placeholder.svg";

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Izquierda */}
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-amber-300 drop-shadow-sm mb-4">{title}</h2>
          <div className="mx-auto max-w-[380px] md:max-w-[420px]">
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800/60" style={{ aspectRatio: "3 / 4" }}>
              <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
            </div>
          </div>
        </div>

        {/* Derecha */}
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-300 text-sm mb-2">
              Semanas de alquiler: <span className="text-white font-semibold">{weeks}</span>
            </p>
            <Slider 
              value={[weeks]} 
              min={1} 
              max={12} 
              step={1} 
              onValueChange={(v) => {
                setWeeks(v[0] ?? 1);
                // Limpiar error al cambiar
                if (validationErrors.weeks) {
                  setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.weeks;
                    return newErrors;
                  });
                }
              }} 
            />
            <ValidationError error={showValidation ? validationErrors.weeks : undefined} />
          </div>

          <div className="text-center space-y-4">
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              {discountRate > 0 ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-slate-400 line-through text-lg">
                    {weeklyPriceBase.toLocaleString("en-US", { style: "currency", currency })}
                  </span>
                  <span className="text-2xl font-black text-emerald-300">
                    {weeklyPrice.toLocaleString("en-US", { style: "currency", currency })}
                  </span>
                  <span className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
                    -10% Premium
                  </span>
                </div>
              ) : (
                <div className="text-2xl font-black text-emerald-300">
                  {weeklyPriceBase.toLocaleString("en-US", { style: "currency", currency })}
                  <span className="text-slate-300 text-base font-medium">/sem</span>
                </div>
              )}
            </div>
          </div>

          {/* Pago */}
          {primaryPM ? (
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white font-medium">Método de pago</p>
                <div className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox checked={useSaved} onCheckedChange={(v) => setUseSaved(v === true)} />
                    Usar tarjeta guardada
                  </label>
                </div>
              </div>

              {useSaved ? (
                Array.isArray(methods) && methods.length > 0 ? (
                  <div className="space-y-2">
                    {methods.map((pm) => {
                      const label = `${brandLabel(pm.brand)} •••• ${pm.last4} — ${String(
                        pm.expMonth
                      ).padStart(2, "0")}/${pm.expYear}`;
                      return (
                        <label
                          key={String(pm._id)}
                          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                            methodId === String(pm._id)
                              ? "border-orange-300 bg-orange-300/10"
                              : "border-slate-700 hover:border-orange-300/60"
                          }`}
                        >
                          <input
                            type="radio"
                            name="pm"
                            checked={methodId === String(pm._id)}
                            onChange={() => setMethodId(String(pm._id))}
                          />
                          <span className="text-slate-200">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    No tenés tarjetas guardadas. Activá el formulario destildando arriba.
                  </div>
                )
              ) : (
                <>
                  <div>
                    <label className="text-slate-300 text-sm">Nombre del titular</label>
                    <Input 
                      value={holder} 
                      onChange={(e) => {
                        setHolder(e.target.value);
                        // Limpiar error al escribir
                        if (validationErrors.holder) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.holder;
                            return newErrors;
                          });
                        }
                      }} 
                      placeholder="Nombre en la tarjeta" 
                      className={`bg-slate-700 text-white mt-1 ${
                        validationErrors.holder ? 'border-red-400' : 'border-slate-600'
                      }`} 
                    />
                    <ValidationError error={showValidation ? validationErrors.holder : undefined} />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm">Número de tarjeta</label>
                    <Input
                      value={number}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 19);
                        setNumber(d.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
                        // Limpiar error al escribir
                        if (validationErrors.number) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.number;
                            return newErrors;
                          });
                        }
                      }}
                      placeholder="4111 1111 1111 1111"
                      className={`bg-slate-700 text-white mt-1 ${
                        validationErrors.number ? 'border-red-400' : 'border-slate-600'
                      }`}
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />
                    <ValidationError error={showValidation ? validationErrors.number : undefined} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 text-sm">Fecha de expiración</label>
                      <Input
                        value={exp}
                        onChange={(e) => {
                          setExp(formatExpirationInput(e.target.value));
                          // Limpiar error al escribir
                          if (validationErrors.exp) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.exp;
                              return newErrors;
                            });
                          }
                        }}
                        placeholder="MM/YY"
                        className={`bg-slate-700 text-white mt-1 ${
                          validationErrors.exp ? 'border-red-400' : 'border-slate-600'
                        }`}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                      />
                      <ValidationError error={showValidation ? validationErrors.exp : undefined} />
                    </div>
                    <div>
                      <label className="text-slate-300 text-sm">CVC</label>
                      <Input 
                        value={cvc} 
                        onChange={(e) => {
                          setCvc(e.target.value.replace(/\D/g, "").slice(0, 3));
                          // Limpiar error al escribir
                          if (validationErrors.cvc) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.cvc;
                              return newErrors;
                            });
                          }
                        }} 
                        placeholder="123" 
                        className={`bg-slate-700 text-white mt-1 ${
                          validationErrors.cvc ? 'border-red-400' : 'border-slate-600'
                        }`} 
                        inputMode="numeric" 
                        autoComplete="cc-csc" 
                      />
                      <ValidationError error={showValidation ? validationErrors.cvc : undefined} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox checked={rememberNew} onCheckedChange={(v) => setRememberNew(v === true)} />
                    <span className="text-slate-300 text-sm">Guardar método de pago</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-slate-300 text-sm">Nombre del titular</label>
                <Input 
                  value={holder} 
                  onChange={(e) => {
                    setHolder(e.target.value);
                    // Limpiar error al escribir
                    if (validationErrors.holder) {
                      setValidationErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.holder;
                        return newErrors;
                      });
                    }
                  }} 
                  placeholder="Nombre en la tarjeta" 
                  className={`bg-slate-700 text-white mt-1 ${
                    validationErrors.holder ? 'border-red-400' : 'border-slate-600'
                  }`} 
                />
                <ValidationError error={showValidation ? validationErrors.holder : undefined} />
              </div>
              <div>
                <label className="text-slate-300 text-sm">Número de tarjeta</label>
                <Input
                  value={number}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 19);
                    setNumber(d.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
                    // Limpiar error al escribir
                    if (validationErrors.number) {
                      setValidationErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.number;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder="4111 1111 1111 1111"
                  className={`bg-slate-700 text-white mt-1 ${
                    validationErrors.number ? 'border-red-400' : 'border-slate-600'
                  }`}
                  inputMode="numeric"
                  autoComplete="cc-number"
                />
                <ValidationError error={showValidation ? validationErrors.number : undefined} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 text-sm">Fecha de expiración</label>
                  <Input
                    value={exp}
                    onChange={(e) => {
                      setExp(formatExpirationInput(e.target.value));
                      // Limpiar error al escribir
                      if (validationErrors.exp) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.exp;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder="MM/YY"
                    className={`bg-slate-700 text-white mt-1 ${
                      validationErrors.exp ? 'border-red-400' : 'border-slate-600'
                    }`}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                  />
                  <ValidationError error={showValidation ? validationErrors.exp : undefined} />
                </div>
                <div>
                  <label className="text-slate-300 text-sm">CVC</label>
                  <Input 
                    value={cvc} 
                    onChange={(e) => {
                      setCvc(e.target.value.replace(/\D/g, "").slice(0, 3));
                      // Limpiar error al escribir
                      if (validationErrors.cvc) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.cvc;
                          return newErrors;
                        });
                      }
                    }} 
                    placeholder="123" 
                    className={`bg-slate-700 text-white mt-1 ${
                      validationErrors.cvc ? 'border-red-400' : 'border-slate-600'
                    }`} 
                    inputMode="numeric" 
                    autoComplete="cc-csc" 
                  />
                  <ValidationError error={showValidation ? validationErrors.cvc : undefined} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox checked={rememberNew} onCheckedChange={(v) => setRememberNew(v === true)} />
                <span className="text-slate-300 text-sm">Guardar método de pago</span>
              </div>
            </div>
          )}

          <Button
            onClick={onRent}
            disabled={payDisabled || processing}
            className={`w-full text-slate-900 text-lg py-6 font-bold ${
              payDisabled || processing ? "bg-slate-600 cursor-not-allowed" : "bg-orange-400 hover:bg-orange-500"
            }`}
          >
            {processing
              ? "Procesando…"
              : `Pagar ${total.toLocaleString("en-US", { style: "currency", currency })}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
