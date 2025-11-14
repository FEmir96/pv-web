"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ValidationError } from "@/components/ui/validation-error";
import { useToast } from "@/hooks/use-toast";
import { validatePaymentForm, formatExpirationInput } from "@/lib/validation";

/* ---------- Helpers de precios: mismos criterios que /juego/[id] ---------- */
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

type BestPriceHit = { path: string; val: number };

function deepFindBuyPrice(game: any): number | undefined {
  if (!game || typeof game !== "object") return undefined;

  const EXCLUDE = /(rent|alquiler|rental|weekly|week|semana|suscrip|subscription|sub)/i;
  const INCLUDE = /(buy|purchase|compra|permanent|perma|flat|price|precio)/i;

  // <- clave: usar undefined en vez de null y retornar con optional chaining
  let best: { path: string; val: number } | undefined;

  const walk = (val: unknown, path: string, depth: number) => {
    if (depth > 6 || val == null) return;

    if (typeof val === "object") {
      for (const k of Object.keys(val as Record<string, unknown>)) {
        walk((val as any)[k], path ? `${path}.${k}` : k, depth + 1);
      }
      return;
    }

    // normalización numérica
    let n: number | undefined;
    if (typeof val === "number" && Number.isFinite(val)) n = val;
    else if (typeof val === "string") {
      const s1 = val.trim().replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
      const s =
        s1.includes(",") && s1.includes(".")
          ? s1.replace(/\./g, "").replace(",", ".")
          : s1.includes(",")
          ? s1.replace(",", ".")
          : s1;
      const parsed = Number(s);
      if (Number.isFinite(parsed)) n = parsed;
    }
    if (n === undefined) return;

    const p = path.toLowerCase();
    if (EXCLUDE.test(p) || !INCLUDE.test(p)) return;

    if (!best) best = { path, val: n };
  };

  walk(game, "", 0);
  return best?.val;
}

function pickBuyPrice(game: any): number | undefined {
  const direct =
    num(game?.price_buy) ??
    num(game?.priceBuy) ??
    num(game?.buy_price) ??
    num(game?.purchase_price) ??
    num(game?.permanent_price) ??
    num(game?.price_permanent) ??
    num(game?.permanentPrice) ??
    num(game?.precio_compra) ??
    num(game?.precioCompra) ??
    num(game?.precio_permanente) ??
    num(game?.precio) ??
    num(game?.price) ??
    num(game?.basePrice) ??
    num(game?.flat_price) ??
    num(game?.price_flat) ??
    num(game?.flatPrice) ??
    num(game?.pricing?.buy) ??
    num(game?.pricing?.purchase) ??
    num(game?.prices?.buy) ??
    num(game?.prices?.purchase) ??
    (typeof game?.priceBuyCents === "number" ? game.priceBuyCents / 100 : undefined) ??
    (typeof game?.buyPriceCents === "number" ? game.buyPriceCents / 100 : undefined) ??
    (typeof game?.prices?.buyCents === "number" ? game.prices.buyCents / 100 : undefined);

  return direct ?? deepFindBuyPrice(game);
}

function pickCurrency(game: any): string {
  return game?.currency || game?.prices?.currency || game?.pricing?.currency || "USD";
}

function formatMoney(value: number, currency = "USD", locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `$${value.toFixed(2)} ${currency}`;
  }
}

/* ---------------- UI ---------------- */
function CheckoutTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center mb-6">
      <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
        {children}
      </h1>
      <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-orange-400 to-amber-300" />
    </div>
  );
}

type PM = {
  _id: string;
  brand: "visa" | "mastercard" | "amex" | "otro";
  last4: string;
  expMonth: number;
  expYear: number;
};

export default function PurchaseCheckoutPage({ params }: { params: { id: string } }) {
  const router = useRouter();
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

  // Perfil + rol
  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loginEmail ? { email: loginEmail } : "skip"
  ) as { _id: Id<"profiles">; role?: "free" | "premium" | "admin" } | null | undefined;

  const userRole = (profile?.role ?? "free") as "free" | "premium" | "admin";
  const isPremiumViewer = userRole === "premium" || userRole === "admin";
  const discountRate = isPremiumViewer ? 0.1 : 0;

  // Juego
  const game = useQuery(
    api.queries.getGameById?.getGameById as any,
    api.queries.getGameById?.getGameById ? ({ id: params.id as Id<"games"> } as any) : "skip"
  ) as any | null | undefined;

  // Currency + precio real + precio con descuento
  const currency = useMemo(() => pickCurrency(game), [game]);
  const basePrice = useMemo(() => pickBuyPrice(game) ?? 0, [game]);
  const finalPrice = useMemo(() => (typeof basePrice === "number" ? +(basePrice * (1 - discountRate)).toFixed(2) : 0), [basePrice, discountRate]);

  // Métodos guardados (si hay query)
  const pmSupported = Boolean(api.queries.getPaymentMethods?.getPaymentMethods);
  const methods = useQuery(
    (api.queries.getPaymentMethods?.getPaymentMethods as any) || (null as any),
    pmSupported && profile?._id ? { userId: profile._id } : "skip"
  ) as PM[] | undefined;

  // Biblioteca (para evitar recompras)
  const library = useQuery(
    api.queries.getUserLibrary?.getUserLibrary as any,
    profile?._id && api.queries.getUserLibrary?.getUserLibrary ? { userId: profile._id } : "skip"
  ) as any[] | undefined;

  const savePaymentMethod = useMutation(api.mutations.savePaymentMethod?.savePaymentMethod as any);
  const purchaseGame = useMutation(api.transactions.purchaseGame as any);

  // UI
  const [useSaved, setUseSaved] = useState(true);
  const [rememberNew, setRememberNew] = useState(false);
  const [methodId, setMethodId] = useState<string | null>(null);

  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  
  // Estados de validación
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showValidation, setShowValidation] = useState(false);

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

  /** Helper: obtener timestamp de posible campo expiry en fila */
  const parseExpiry = (row: any) => {
    if (!row) return undefined;
    const candidates = [
      "expiresAt","expires_at","expires","endDate","end_date","expiry","expiryDate",
      "rentalExpires","rental_expires","expiresOn","expires_on","endsAt"
    ];
    const tryParse = (v: any) => {
      if (!v) return undefined;
      if (typeof v === "number") {
        return Number.isFinite(v) ? v : undefined;
      }
      if (typeof v === "string") {
        const parsed = Date.parse(v);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      if (v instanceof Date) return v.getTime();
      return undefined;
    };
    for (const k of candidates) {
      const val = row?.[k] ?? (row?.game ?? {})[k] ?? row?.rental?.[k];
      const t = tryParse(val);
      if (t) return t;
    }
    return undefined;
  };

  /** ¿Ya es dueño del juego? (mejor: ignora rentals vencidos) */
  const alreadyOwned = useMemo(() => {
    if (!library || !game?._id) return false;
    const gid = String(game._id);
    const now = Date.now();
    return library.some((row: any) => {
      const g = row?.game ?? row;
      const id = String(g?._id ?? row?.gameId ?? "");
      if (id !== gid) return false;
      const kind = String(row?.kind ?? row?.type ?? "").toLowerCase();
      // Compra permanente -> owned
      if (kind === "purchase" || kind === "buy" || row?.owned === true) return true;
      // Si es rental/alquiler -> solo owned si expiry > now
      if (kind === "rental" || kind === "rent" || kind.includes("alquiler")) {
        const expiry = parseExpiry(row);
        if (expiry && expiry > now) return true;
        return false;
      }
      // Fallbacks: si row tiene field owned true lo respetamos
      if (row?.owned === true) return true;
      return false;
    });
  }, [library, game?._id]);

  const ownedToastShownRef = useRef(false);
  const suppressOwnedToastRef = useRef(false);

  useEffect(() => {
    if (alreadyOwned && game?.title && !ownedToastShownRef.current && !suppressOwnedToastRef.current) {
      ownedToastShownRef.current = true;
      toast({ title: "Ya tienes este juego", description: `“${game.title}” ya está en tu catálogo.` });
    }
  }, [alreadyOwned, game?.title, toast]);

  const onPay = async () => {
    if (!profile?._id || !game?._id) return;

    // Limpiar errores previos
    setValidationErrors({});
    setShowValidation(true);

    if (alreadyOwned) {
      toast({ title: "Compra no necesaria", description: "Ya tienes este producto en tu catálogo." });
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
      suppressOwnedToastRef.current = true;

      if (!useSaved && rememberNew && api.mutations.savePaymentMethod?.savePaymentMethod) {
        await savePaymentMethod({
          userId: profile._id,
          fullNumber: number,
          exp,
          cvv: cvc,
          brand: undefined,
        } as any);
      }

      // Enviamos el precio FINAL (con descuento si corresponde)
      await purchaseGame({
        userId: profile._id,
        gameId: game._id,
        amount: finalPrice,
        currency,
      } as any);

      toast({ title: "Compra confirmada", description: "Te enviamos un email con los detalles." });

      // Guardar detalle de la compra en sessionStorage y redirigir a la página de éxito
      const successPayload = {
        gameId: String(game._id),
        title: String(game.title ?? "Juego"),
        cover: String(game.cover_url ?? "/placeholder.svg"),
        amount: finalPrice,
        currency,
      } as const;

      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pv_purchase_success", JSON.stringify(successPayload));
        }
      } catch {}

      // centralizar la navegación a la página de éxito para asegurarnos que siempre ocurra
      const navigateToSuccess = () => {
        try {
          // Prefer router navigation in a transition
          router.replace("/checkout/compra/success");
          router.refresh();
        } catch {}
        setTimeout(() => {
          if (typeof window !== "undefined" && window.location.pathname !== "/checkout/compra/success") {
            window.location.assign("/checkout/compra/success");
          }
        }, 600);
      };

      navigateToSuccess();
    } catch (e: any) {
      suppressOwnedToastRef.current = false;
      const msg = String(e?.message || "");
      if (msg.includes("ALREADY_OWNED")) {
        toast({ title: "Ya tienes este juego", description: "No es necesario volver a comprarlo." });
        return;
      }
      toast({
        title: "No se pudo completar el pago",
        description: e?.message ?? "Intentá nuevamente.",
        variant: "destructive",
      });
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
      <CheckoutTitle>Confirmar compra</CheckoutTitle>
      <p className="text-slate-300 text-center mb-8">Estás comprando:</p>

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
        <div className="text-center space-y-4">
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
            {discountRate > 0 && (
              <div className="flex items-baseline gap-3">
                <span className="text-slate-400 line-through text-lg">{formatMoney(basePrice, currency)}</span>
                <span className="text-3xl font-black text-emerald-300">{formatMoney(finalPrice, currency)}</span>
                <span className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
                  -10% Premium
                </span>
              </div>
            )}
            {discountRate === 0 && (
              <div className="text-3xl font-black text-emerald-300">{formatMoney(basePrice, currency)}</div>
            )}
          </div>

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
            onClick={onPay}
            disabled={alreadyOwned}
            className={`w-full text-slate-900 text-lg py-6 font-bold ${
              alreadyOwned ? "bg-slate-600 cursor-not-allowed" : "bg-orange-400 hover:bg-orange-500"
            }`}
          >
            {alreadyOwned
              ? "Ya tienes este juego"
              : `Pagar ${formatMoney(discountRate > 0 ? finalPrice : basePrice, currency)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
