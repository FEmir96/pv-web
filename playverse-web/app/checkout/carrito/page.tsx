// playverse-web/app/checkout/carrito/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ValidationError } from "@/components/ui/validation-error";
import { useToast } from "@/hooks/use-toast";
import { validatePaymentForm, formatExpirationInput, type ValidationError as ValidationErrorType } from "@/lib/validation";

/* helpers mínimos */
const formatMoney = (n: number, currency = "USD") =>
  n.toLocaleString("en-US", { style: "currency", currency });

export default function CartCheckoutPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Sesión obligatoria para pagar
  const { data: session, status } = useSession();
  const loginEmail = session?.user?.email?.toLowerCase() || null;

  useEffect(() => {
    if (status === "loading") return;
    if (!loginEmail) {
      router.replace(`/auth/login?next=${encodeURIComponent("/checkout/carrito")}`);
    }
  }, [status, loginEmail, router]);

  // Perfil
  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loginEmail ? { email: loginEmail } : "skip"
  ) as { _id: Id<"profiles">; name?: string; role?: "free" | "premium" | "admin" } | null | undefined;

  const userId = profile?._id ?? null;
  const isPremiumViewer = profile?.role === "premium" || profile?.role === "admin";
  const discountRate = isPremiumViewer ? 0.1 : 0;

  // Items del carrito (server)
  const serverItems = useQuery(
    api.queries.cart?.getCartDetailed as any,
    userId ? { userId } : "skip"
  ) as
    | Array<{
      cartItemId: string;
      gameId: Id<"games">;
      title: string;
      cover_url?: string | null;
      price_buy: number;
      currency: "USD";
    }>
    | undefined;

  const items = serverItems ?? [];
  const hasItems = items.length > 0;

  // Métodos de pago guardados (solo si existe la query)
  const getPaymentMethods = api.queries.getPaymentMethods?.getPaymentMethods;
  const pmSupported = Boolean(getPaymentMethods);

  const paymentMethods =
    (pmSupported
      ? (useQuery(
        getPaymentMethods as any,
        userId ? { userId } : "skip"
      ) as
        | Array<{
          _id: Id<"paymentMethods">;
          brand: "visa" | "mastercard" | "amex" | "otro";
          last4: string;
          expMonth: number;
          expYear: number;
        }>
        | undefined)
      : undefined) || [];

  // UI: usar guardadas vs nueva
  const [useSaved, setUseSaved] = useState<boolean>(true);
  useEffect(() => {
    setUseSaved((paymentMethods?.length ?? 0) > 0);
  }, [paymentMethods]);

  // método seleccionado
  const [methodId, setMethodId] = useState<string | null>(null);
  useEffect(() => {
    if (useSaved && !methodId && Array.isArray(paymentMethods) && paymentMethods.length > 0) {
      setMethodId(String(paymentMethods[0]._id));
    }
    if (!useSaved) setMethodId(null);
  }, [paymentMethods, methodId, useSaved]);

  // Form tarjeta nueva
  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [rememberNew, setRememberNew] = useState(false);

  // Estados de validación
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showValidation, setShowValidation] = useState(false);

  // Totales
  const subtotalBase = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.price_buy) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () => +(subtotalBase * (1 - discountRate)).toFixed(2),
    [subtotalBase, discountRate]
  );

  // Mutations (solo instanciar si existen)
  const cartRemoveFn = api.mutations.cart?.remove;
  const cartClearFn = api.mutations.cart?.clear;
  const cartRemove = cartRemoveFn ? useMutation(cartRemoveFn) : null;
  const cartClear = cartClearFn ? useMutation(cartClearFn) : null;

  const purchaseCart = useMutation(api.transactions.purchaseCart as any);

  const savePaymentMethodFn = api.mutations.savePaymentMethod?.savePaymentMethod;
  const savePaymentMethod = savePaymentMethodFn ? useMutation(savePaymentMethodFn) : null;

  const [processing, setProcessing] = useState(false);

  const onPay = async () => {
    if (processing) return;
    if (!userId || items.length === 0) return;

    // Limpiar errores previos
    setValidationErrors({});
    setShowValidation(true);

    // Validación: si usás guardadas, elegí una
    if (useSaved && Array.isArray(paymentMethods) && paymentMethods.length > 0 && !methodId) {
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

      // Guardar método nuevo si corresponde y existe la mutation
      if (!useSaved && rememberNew && savePaymentMethod) {
        try {
          await savePaymentMethod({
            userId,
            fullNumber: number.replace(/\s/g, ""),
            exp,
            cvv: cvc,
            brand: undefined,
          } as any);
        } catch {
          // ignorar fallo al guardar
        }
      }

      // purchaseCart solo envía ids: el backend calcula precios/descuentos
      await purchaseCart({
        userId,
        gameIds: items.map((m) => m.gameId),
        currency: "USD",
        paymentMethodId: useSaved ? (methodId ?? undefined) : undefined,
      } as any);

      // Guardar payload de éxito y redirigir a página de confirmación
      try {
        const payload = {
          items: items.map((it) => ({
            gameId: String(it.gameId),
            title: it.title,
            cover: it.cover_url ?? "/placeholder.svg",
            price: Number(it.price_buy) || 0,
            currency: it.currency || "USD",
          })),
          amount: subtotal,
          currency: "USD",
        };
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pv_cart_success", JSON.stringify(payload));
        }
      } catch (e) {
        // ignore
      }

      startTransition(() => {
        router.replace("/checkout/carrito/success");
        router.refresh();
      });
      setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname !== "/checkout/carrito/success") {
          window.location.assign("/checkout/carrito/success");
        }
      }, 800);
    } catch (e: any) {
      toast({
        title: "No se pudo completar el pago",
        description: e?.message ?? "Intentá nuevamente.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const brandLabel = (b: string) =>
    b === "visa" ? "Visa" : b === "mastercard" ? "Mastercard" : b === "amex" ? "Amex" : "Tarjeta";

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-orange-400 mb-6 tracking-wide">
          CARRITO
        </h1>
        <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-orange-400 to-amber-300" />
      </div>

      {!hasItems ? (
        <div className="mx-auto max-w-xl text-center text-slate-300">
          <p>Tu carrito está vacío.</p>
          <Link href="/catalogo" className="inline-block mt-4">
            <Button className="bg-orange-400 hover:bg-orange-500 text-slate-900 font-bold">
              Ir al catálogo
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((it) => {
              const base = Number(it.price_buy) || 0;
              const finalP = discountRate > 0 ? +(base * (1 - discountRate)).toFixed(2) : base;
              return (
                <div
                  key={String(it.gameId)}
                  className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 rounded-xl p-3"
                >
                  <div className="relative w-20 h-24 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
                    <Image
                      src={it.cover_url || "/placeholder.svg"}
                      alt={it.title}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-amber-400 font-semibold">{it.title}</div>
                    <div className="text-amber-300 font-bold">
                      {discountRate > 0 ? (
                        <>
                          <span className="text-slate-400 line-through mr-2">
                            {formatMoney(base, it.currency)}
                          </span>
                          <span>{formatMoney(finalP, it.currency)}</span>
                        </>
                      ) : (
                        formatMoney(base, it.currency)
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={async () => {
                      if (!userId || !cartRemove) return;
                      await cartRemove({ userId, gameId: it.gameId } as any);
                    }}
                    className="!bg-transparent border border-amber-400/40 text-amber-300 hover:!bg-amber-400/20 hover:text-amber-100 hover:border-amber-400 rounded-lg px-4 py-2 transition-colors"
                  >
                    Quitar
                  </Button>
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                onClick={async () => {
                  if (!userId || !cartClear) return;
                  await cartClear({ userId } as any);
                }}
                className="!bg-transparent border border-amber-400/40 text-amber-300 hover:!bg-amber-400/20 hover:text-amber-100 hover:border-amber-400 rounded-lg px-4 py-2 transition-colors"
              >
                Vaciar carrito
              </Button>

              <Link
                href="/catalogo"
                className="text-amber-300 hover:text-white hover:underline underline-offset-4"
              >
                Seguir comprando
              </Link>
            </div>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-lg font-bold text-amber-400 mb-3">Resumen</h3>

              <label className="flex items-center gap-2 mb-2">
                <Checkbox checked={useSaved} onCheckedChange={(v) => setUseSaved(v === true)} />
                <span className="text-slate-300 text-sm">Usar tarjeta guardada</span>
              </label>

              <div className="mb-4">
                {useSaved ? (
                  Array.isArray(paymentMethods) && paymentMethods.length > 0 ? (
                    <div className="space-y-2">
                      {paymentMethods.map((pm) => {
                        const label = `${brandLabel(pm.brand)} •••• ${pm.last4} — ${String(
                          pm.expMonth
                        ).padStart(2, "0")}/${pm.expYear}`;
                        return (
                          <label
                            key={String(pm._id)}
                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${methodId === String(pm._id)
                              ? "border-amber-300 bg-amber-300/10"
                              : "border-slate-700 hover:border-amber-300/60"
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
                  <div className="space-y-3">
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
                        className={`bg-slate-700 text-white mt-1 ${validationErrors.holder ? 'border-red-400' : 'border-slate-600'
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
                          const pretty = d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
                          setNumber(pretty);
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
                        className={`bg-slate-700 text-white mt-1 ${validationErrors.number ? 'border-red-400' : 'border-slate-600'
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
                          className={`bg-slate-700 text-white mt-1 ${validationErrors.exp ? 'border-red-400' : 'border-slate-600'
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
                          className={`bg-slate-700 text-white mt-1 ${validationErrors.cvc ? 'border-red-400' : 'border-slate-600'
                            }`}
                          inputMode="numeric"
                          autoComplete="cc-csc"
                        />
                        <ValidationError error={showValidation ? validationErrors.cvc : undefined} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1">
                      <Checkbox
                        checked={rememberNew}
                        onCheckedChange={(v) => setRememberNew(v === true)}
                      />
                      <span className="text-slate-300 text-sm">Guardar método de pago</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-1 text-amber-300">
                <span>Productos</span>
                <span>{items.length}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-amber-400 font-semibold">
                <span>Total</span>
                <span>
                  {discountRate > 0 ? (
                    <>
                      <span className="text-slate-400 line-through mr-2">
                        {formatMoney(subtotalBase, "USD")}
                      </span>
                      <span>{formatMoney(subtotal, "USD")}</span>
                    </>
                  ) : (
                    formatMoney(subtotalBase, "USD")
                  )}
                </span>
              </div>

              <Button
                onClick={onPay}
                disabled={processing || items.length === 0 || !userId}
                className={`w-full mt-4 text-slate-900 text-lg py-6 font-bold ${processing
                  ? "bg-slate-600 cursor-not-allowed"
                  : "bg-orange-400 hover:bg-orange-500"
                  }`}
              >
                {processing ? "Procesando…" : "Pagar ahora"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
