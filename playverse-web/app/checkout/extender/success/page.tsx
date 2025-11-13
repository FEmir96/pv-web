"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ExtendPayload = {
  gameId: string;
  title: string;
  cover: string;
  weeks: number;
  amount: number;
  currency: string;
};

export default function ExtendSuccessPage() {
  const [payload, setPayload] = useState<ExtendPayload | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem("pv_extend_success") : null;
      if (raw) {
        const p = JSON.parse(raw) as ExtendPayload;
        setPayload(p);
        sessionStorage.removeItem("pv_extend_success");
      }
    } catch {
      setPayload(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-3xl w-full text-center">
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

          <h1 className="text-2xl font-bold text-white mb-4">¡Alquiler extendido!</h1>

          {payload ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-6">
              <div className="md:col-span-1 mx-auto">
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800/60" style={{ aspectRatio: "3 / 4", width: 180 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payload.cover} alt={payload.title} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
                </div>
              </div>

              <div className="md:col-span-2 text-left">
                <h2 className="text-xl font-bold text-amber-300 mb-2">{payload.title}</h2>
                <p className="text-slate-300 mb-3">La fecha de vencimiento se actualizó correctamente.</p>

                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3 inline-block">
                  <div className="text-sm text-slate-400">Semanas añadidas</div>
                  <div className="text-lg font-semibold text-white">{payload.weeks}</div>
                </div>

                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3 inline-block ml-4">
                  <div className="text-sm text-slate-400">Total abonado</div>
                  <div className="text-lg font-semibold text-white">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: payload.currency }).format(payload.amount)}
                  </div>
                </div>

                <p className="text-slate-400 mt-4 text-sm">Te enviaremos un correo con los detalles del recibo.</p>
              </div>
            </div>
          ) : (
            <div className="text-slate-300 mb-6">No se encontraron los detalles. Si la extensión fue exitosa, deberías ver la nueva fecha en tu perfil.</div>
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
