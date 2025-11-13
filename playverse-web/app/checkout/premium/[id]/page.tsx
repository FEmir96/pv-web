// app/checkout/premium/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex";
import type { Id } from "@convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ValidationError } from "@/components/ui/validation-error";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/useAuthStore";
import { validatePaymentForm, formatExpirationInput } from "@/lib/validation";

const getUserByIdRef =
  (api as any)["queries/getUserById"].getUserById as FunctionReference<"query">;

const HAS_PM_QUERY = Boolean(
  (api as any)["queries/getPaymentMethods"]?.getPaymentMethods
);
const getPaymentMethodsRef = (HAS_PM_QUERY
  ? (api as any)["queries/getPaymentMethods"].getPaymentMethods
  : (api as any)["queries/getUserById"].getUserById) as FunctionReference<"query">;

const savePaymentMethodRef =
  (api as any)["mutations/savePaymentMethod"]
    .savePaymentMethod as FunctionReference<"mutation">;

const makePaymentRef =
  (api as any)["mutations/makePayment"].makePayment as FunctionReference<"mutation">;

const upgradePlanRef =
  (api as any)["mutations/upgradePlan"].upgradePlan as FunctionReference<"mutation">;

type PM = {
  _id: string;
  brand: "visa" | "mastercard" | "amex" | "otro";
  last4: string;
  expMonth: number;
  expYear: number;
};

const PLANS: Record<
  string,
  { name: string; price: number; priceLabel: string; period: string; description: string }
> = {
  monthly: {
    name: "Premium Mensual",
    price: 9.99,
    priceLabel: "$9.99",
    period: "/mes",
    description: "Perfecto para probar la experiencia",
  },
  quarterly: {
    name: "Premium Trimestral",
    price: 24.99,
    priceLabel: "$24.99",
    period: "/3 meses",
    description: "Equilibrio entre precio y flexibilidad",
  },
  annual: {
    name: "Premium Anual",
    price: 89.99,
    priceLabel: "$89.99",
    period: "/año",
    description: "Ahorra $30",
  },
  // Compatibilidad hacia atrás si llega a venir "lifetime" desde algún enlace viejo
  lifetime: {
    name: "Premium Lifetime",
    price: 239.99,
    priceLabel: "$239.99",
    period: " único pago",
    description: "Acceso de por vida a todas las funciones Premium",
  },
};

/* saneo next interno */
function safeInternalNext(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const dec = decodeURIComponent(raw);
    return dec.startsWith("/") ? dec : null;
  } catch {
    return null;
  }
}

export default function PremiumCheckoutPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { toast } = useToast();

  // Sesión + store local
  const { status, data: session } = useSession();
  const storeUser = useAuthStore((s) => s.user);

  const loginEmail =
    session?.user?.email?.toLowerCase() ??
    storeUser?.email?.toLowerCase() ??
    null;

  // Si no hay sesión → login con return a esta ruta (con query intacta)
  useEffect(() => {
    if (status === "loading") return;
    if (!loginEmail && !storeUser) {
      const next = `${pathname}${sp?.toString() ? `?${sp?.toString()}` : ""}`;
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, loginEmail, storeUser, router, pathname, sp]);

  // Perfil por ID (ruta fuerte)
const profile = useQuery(
  getUserByIdRef,
  params?.id ? ({ id: params.id as Id<"profiles"> } as any) : "skip"
) as
  | (Record<string, any> & { _id: Id<"profiles">; role?: string; name?: string; email?: string })
  | null
  | undefined;
const profileLoaded = profile !== undefined;

// Plan y helpers derivados de la URL
const planKey = sp?.get("plan") ?? "monthly";
const trial = sp?.get("trial") === "true";
const plan = PLANS[planKey] ?? PLANS.monthly;

const nextParam = safeInternalNext(sp?.get("next") ?? null);

const formatMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const profileTrialUsed = Boolean((profile as any)?.freeTrialUsed);
  const profileTrialEndsAt =
    typeof (profile as any)?.trialEndsAt === "number" ? (profile as any).trialEndsAt : null;
  const profileRole = (profile as any)?.role;
  const trialEligible =
    Boolean(profile) &&
    profileRole !== "premium" &&
    !profileTrialUsed &&
    !(profileTrialEndsAt && profileTrialEndsAt > Date.now());
  const trialActiveForUser =
    Boolean(profileRole === "premium" && profileTrialEndsAt && profileTrialEndsAt > Date.now());
  const trialCheckoutEnabled = Boolean(trial) && Boolean(trialEligible);

  const todayCharge = trialCheckoutEnabled ? 0 : plan.price;
  const todayChargeLabel = formatMoney(todayCharge);
  const trialNextChargeLabel = useMemo(() => {
    if (!trialCheckoutEnabled) return null;
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return date.toLocaleDateString();
  }, [trialCheckoutEnabled]);

  const warnedTrialRef = useRef(false);
  useEffect(() => {
    if (warnedTrialRef.current) return;
    if (!trial || !profileLoaded) return;
    if (!trialCheckoutEnabled && !trialActiveForUser) {
      warnedTrialRef.current = true;
      toast({
        title: "Prueba gratuita ya utilizada",
        description: "Elegí cualquiera de nuestros planes para seguir disfrutando de PlayVerse Premium.",
      });
      router.replace("/premium");
    }
  }, [trial, trialCheckoutEnabled, trialActiveForUser, profileLoaded, router, toast]);

  // Métodos desde DB si existe la query, si no mostramos UI manual
  const methods = useQuery(
    getPaymentMethodsRef as any,
    HAS_PM_QUERY && profile?._id ? { userId: profile._id } : "skip"
  ) as PM[] | undefined;

  // UI payment state
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

  const savePaymentMethod = useMutation(savePaymentMethodRef);
  const makePayment = useMutation(makePaymentRef);
  const upgradePlan = useMutation(upgradePlanRef);

  // Normalizador de marcas
  const normalizeBrand = (b?: string): PM["brand"] => {
    const s = (b || "").toLowerCase();
    if (s.includes("visa")) return "visa";
    if (s.includes("master")) return "mastercard";
    if (s.includes("amex") || s.includes("american")) return "amex";
    return "otro";
  };

  // Fallback: por si tienes algo de PM en profile
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

  const onPay = async () => {
    if (!profile?._id) return;

    // Limpiar errores previos
    setValidationErrors({});
    setShowValidation(true);

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
      // Guardar tarjeta nueva si corresponde
      if (!useSaved && rememberNew) {
        await savePaymentMethod({
          userId: profile._id,
          fullNumber: number,
          exp,
          cvv: cvc,
          brand: undefined,
        });
      }

      const payRes = await makePayment({
        userId: profile._id,
        amount: todayCharge,
        currency: "USD",
        provider: "manual",
      });

      // 2) Subir a premium + seteo de expiración / suscripción
      await upgradePlan({
        userId: profile._id,
        toRole: "premium",
        plan: planKey,
        paymentId: (payRes as any)?.paymentId,
        trial: Boolean(trialCheckoutEnabled),
      });

      // 3) Toast futuro en success
      try {
        if (profile?.name) sessionStorage.setItem("pv_premium_welcome", profile.name);
      } catch {}

      // 4) UX: si hay next, volvemos ahí; si no, success page
      if (nextParam) {
        const u = new URL(
          nextParam,
          typeof window !== "undefined" ? window.location.origin : "https://local"
        );
        // flags útiles para mostrar toasts arriba si querés
        u.searchParams.set("auth", "ok");
        u.searchParams.set("upgraded", "1");
        router.replace(u.pathname + u.search);
      } else {
        router.replace("success");
      }

      toast({
        title: `¡Bienvenido a Premium, ${profile?.name ?? "gamer"}!`,
        description: "Tu suscripción se activó correctamente.",
      });
    } catch (e: any) {
      toast({
        title: "No se pudo completar la suscripción",
        description: e?.message ?? "Intentá nuevamente.",
        variant: "destructive",
      });
    }
  };

  // Loaders: sesión o perfil (cuando hay sesión)
  if (status === "loading" || (status === "authenticated" && typeof profile === "undefined")) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-slate-300">
        Cargando…
      </div>
    );
  }

  // Si el perfil no existe (id inválido)
  if (status === "authenticated" && profile === null) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-slate-300">
        No encontramos tu perfil. Volvé a intentarlo.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Back */}
      <div className="container mx-auto px-4 pt-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="border-orange-400 text-orange-400 bg-transparent hover:bg-orange-400 hover:text-slate-900"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Volver
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-orange-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-orange-400 mb-2">Checkout premium</h1>
            <p className="text-slate-400">Estás a un paso de desbloquear la mejor experiencia gaming</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Resumen del plan */}
            <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-orange-400 mb-6">Resumen de tu plan</h2>

              <div className="bg-slate-700/50 rounded-lg p-6 mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-teal-400 mb-2">
                  {plan.priceLabel}
                  <span className="text-lg text-slate-400">{plan.period}</span>
                </div>
                <p className="text-slate-400 mb-1">{plan.description}</p>

                {/* ⬇️ NUEVO: Mostrar quién compra */}
                <p className="text-slate-400 text-sm">
                  Comprador: <span className="text-slate-200">{profile?.name ?? "Usuario"}</span>
                  {profile?.email ? <> &nbsp;(<span className="text-slate-300">{profile.email}</span>)</> : null}
                </p>

                <div className="space-y-2 mt-4">
                  {["Acceso a toda la biblioteca", "Descuentos del 10%", "Cero publicidad"].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-teal-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {trialCheckoutEnabled && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-400/30 rounded-lg p-4 text-sm text-amber-100">
                    <p className="font-semibold">Prueba gratuita de 7 dias</p>
                    <p className="mt-1 text-amber-100/80">
                      Hoy pagas {todayChargeLabel}. Si no cancelas, cobraremos {plan.priceLabel} el{" "}
                      {trialNextChargeLabel ?? "dia 7"}.
                    </p>
                  </div>
                )}
                {!trialCheckoutEnabled && trial && (
                  <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-100">
                    Esta cuenta ya utilizo la prueba gratuita, por lo que aplicaremos el precio completo del plan seleccionado.
                  </div>
                )}
              </div>

              <div className="text-sm text-slate-400">
                {trialCheckoutEnabled
                  ? "Hoy no se realizara ningun cargo. Guardaremos tu metodo para cobrar el plan mensual dentro de 7 dias si no cancelas desde tu perfil."
                  : "Tu suscripcion se renovara automaticamente. Podes cancelarla en cualquier momento desde tu perfil."}
              </div>
            </div>

            {/* Pago */}
            <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white font-medium">Método de pago</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={useSaved} onCheckedChange={(v) => setUseSaved(v === true)} />
                  Usar tarjeta guardada
                </label>
              </div>

              <div className="mb-4">
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
                        className={`bg-slate-700/60 text-white mt-1 ${
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
                        className={`bg-slate-700/60 text-white mt-1 ${
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
                          className={`bg-slate-700/60 text-white mt-1 ${
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
                            setCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
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
                          className={`bg-slate-700/60 text-white mt-1 ${
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

              <Button
                onClick={onPay}
                className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold py-3 text-lg"
              >
                {trialCheckoutEnabled
                  ? "Iniciar prueba gratuita"
                  : `Pagar ${formatMoney(plan.price)} y suscribirse`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
