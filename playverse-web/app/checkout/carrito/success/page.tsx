"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type CartItem = {
  gameId: string;
  title: string;
  cover: string;
  price: number;
  currency: string;
};

type CartPayload = {
  items: CartItem[];
  amount: number;
  currency: string;
  savedAt?: number;
};

const STORAGE_KEY = "pv_cart_success";
const PAYLOAD_TTL_MS = 1000 * 60 * 30; // 30 minutes

export default function CartSuccessPage() {
  const [payload, setPayload] = useState<CartPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartPayload;
          const savedAt = parsed.savedAt ?? Date.now();

          if (Date.now() - savedAt <= PAYLOAD_TTL_MS) {
            setPayload(parsed);
          }

          sessionStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center">
        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-8">
          <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">¡Compra confirmada!</h1>

          {loading ? (
            <div className="text-slate-300 mb-6">Recuperando los detalles de tu compra...</div>
          ) : payload ? (
            <div className="mb-6 text-left">
              <div className="grid gap-3">
                {payload.items.map((it) => (
                  <div key={it.gameId} className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                    <div className="w-20 h-24 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.cover} alt={it.title} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1">
                      <div className="text-amber-400 font-semibold">{it.title}</div>
                      <div className="text-white font-bold">{new Intl.NumberFormat("es-AR", { style: "currency", currency: it.currency }).format(it.price)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3 inline-block mt-4">
                <div className="text-sm text-slate-400">Total pagado</div>
                <div className="text-lg font-semibold text-white">
                  {new Intl.NumberFormat("es-AR", { style: "currency", currency: payload.currency }).format(payload.amount)}
                </div>
              </div>

              <p className="text-slate-400 mt-4 text-sm">Te enviaremos un comprobante por email con los detalles de la compra.</p>
            </div>
          ) : (
            <div className="text-slate-300 mb-6">No se encontraron los detalles de la compra. Si el pago fue exitoso, tus juegos deberían aparecer en "Mis juegos".</div>
          )}

          <div className="space-y-3">
            <Link href="/mis-juegos">
              <Button className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold mb-2">Ver mi biblioteca</Button>
            </Link>

            <Link href="/catalogo">
              <Button variant="outline" className="w-full border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent">Seguir explorando</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
