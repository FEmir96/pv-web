// playverse-web/components/cart-dropdown.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useSession } from "next-auth/react";

/* helpers */
const fmt = (n: number, currency = "USD") =>
  n.toLocaleString("en-US", { style: "currency", currency });

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: Id<"profiles"> | null;
};

export function CartDropdown({ isOpen, onClose, userId }: Props) {
  const { toast } = useToast();

  // Rol del usuario para descuento
  const { data: session } = useSession();
  const loginEmail = session?.user?.email?.toLowerCase() || null;
  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loginEmail ? { email: loginEmail } : "skip"
  ) as { _id: Id<"profiles">; role?: "free" | "premium" | "admin" } | null | undefined;
  const isPremiumViewer = profile?.role === "premium" || profile?.role === "admin";
  const discountRate = isPremiumViewer ? 0.1 : 0;

  const items = useQuery(
    api.queries.cart.getCartDetailed as any,
    userId ? { userId } : "skip"
  ) as
    | Array<{
      cartItemId: Id<"cartItems">;
      gameId: Id<"games">;
      title: string;
      cover_url?: string | null;
      price_buy: number;
      currency: "USD";
    }>
    | undefined;

  const cartRemove = useMutation(api.mutations.cart.remove as any);
  const cartClear = useMutation(api.mutations.cart.clear as any);

  const subtotalBase = useMemo(
    () => (items ?? []).reduce((acc, it) => acc + (Number(it.price_buy) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () => +(subtotalBase * (1 - discountRate)).toFixed(2),
    [subtotalBase, discountRate]
  );

  const hasItems = (items?.length ?? 0) > 0;

  // Esc para cerrar
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  return (
    <div
      ref={wrapRef}
      role="dialog"
      aria-hidden={!isOpen}
      className={[
        // 👇 En mobile es fixed a la ventana; desde sm vuelve a absolute anclado al botón
        "fixed sm:absolute z-50",
        // 👉 En mobile ocupa casi todo el ancho, centrado; en sm se alinea al borde derecho del trigger
        "inset-x-2 sm:inset-auto sm:right-0",
        // 👉 Separación desde arriba: en mobile bajo el header (5rem ~ 80px); en sm pegado al botón
        "top-20 sm:top-[calc(100%+8px)]",
        // 👉 Ancho: full en mobile, 420px en sm+
        "w-full sm:w-[420px] mx-auto sm:mx-0",
        // 👉 Altura máxima con scroll interno
        "max-h-[75vh] overflow-y-auto overscroll-contain",
        // Transiciones / estado abierto-cerrado
        "transition-all duration-200 ease-out",
        isOpen
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-1 scale-95 pointer-events-none",
      ].join(" ")}
    >
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400/50 via-orange-400/40 to-purple-500/40">
        <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-300">
                Mi Carrito
              </h3>
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-400/20 text-orange-300 border border-orange-400/30">
                {items?.length ?? 0}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 rounded-md transition-all duration-200
                         hover:text-orange-300 hover:bg-orange-400/10
                         hover:shadow-[0_0_12px_rgba(251,146,60,0.30)]
                         hover:ring-1 hover:ring-orange-400/30
                         focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-orange-400/60"
              aria-label="Cerrar"
              title="Cerrar"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-800">
            {!hasItems ? (
              <div className="p-6 text-center text-slate-400">
                No agregaste juegos al carrito aún.
              </div>
            ) : (
              items!.map((it) => {
                const base = Number(it.price_buy) || 0;
                const finalP = discountRate > 0 ? +(base * (1 - discountRate)).toFixed(2) : base;
                return (
                  <div
                    key={String(it.cartItemId)}
                    className="p-3 transition-all duration-200
                               hover:bg-slate-800/50 hover:shadow-[0_0_14px_rgba(251,146,60,0.15)]
                               hover:ring-1 hover:ring-orange-400/20"
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 rounded-lg overflow-hidden ring-1 ring-slate-700">
                        <Image
                          src={it.cover_url || "/placeholder.svg"}
                          alt={it.title}
                          width={56}
                          height={56}
                          className="object-cover w-14 h-14"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-amber-300 font-medium truncate" title={it.title}>
                              {it.title}
                            </p>
                            <p className="text-amber-400 text-sm">
                              {discountRate > 0 ? (
                                <>
                                  <span className="text-slate-400 line-through mr-2">
                                    {fmt(base, it.currency)}
                                  </span>
                                  <span>{fmt(finalP, it.currency)}</span>
                                </>
                              ) : (
                                fmt(base, it.currency)
                              )}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!userId) return;
                              await cartRemove({ userId, gameId: it.gameId });
                              toast({
                                title: "Quitado del carrito",
                                description: `${it.title} se quitó del carrito.`,
                              });
                            }}
                            className="text-slate-400 rounded-md transition-all duration-200
                                       hover:text-red-400 hover:bg-red-400/10
                                       hover:shadow-[0_0_12px_rgba(248,113,113,0.25)]
                                       hover:ring-1 hover:ring-red-400/30
                                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                            title="Quitar del carrito"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-900/80 flex items-center justify-between pb-[env(safe-area-inset-bottom)]">
            {hasItems && (
              <div className="text-amber-400 font-semibold">
                Total:{" "}
                {discountRate > 0 ? (
                  <>
                    <span className="text-slate-400 line-through mr-2">
                      {fmt(subtotalBase, "USD")}
                    </span>
                    <span>{fmt(subtotal, "USD")}</span>
                  </>
                ) : (
                  fmt(subtotalBase, "USD")
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Link href="/checkout/carrito" onClick={onClose}>
                <Button className="bg-orange-400 hover:bg-orange-500 text-slate-900 mb-3">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Ir al carrito
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
