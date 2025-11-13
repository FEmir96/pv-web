"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export type HouseAdPayload = {
  id: string;
  slot: "onLogin" | "prePlay";
  title: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  videoUrl?: string;
  theme?: "dark" | "light";
  skipAfterSec: number; // 5–10
  dismissible: boolean; // si false, no aparece botón de cerrar
  featuredGames?: Array<{ _id: string; title: string; cover_url?: string }>;
};

type Props = {
  open: boolean;
  ad: HouseAdPayload | null;
  onSkip: () => Promise<void> | void;
  onCta: () => Promise<void> | void;
};

function pickCovers(ad: HouseAdPayload | null) {
  if (!ad?.featuredGames?.length) return [];
  const shuffled = [...ad.featuredGames].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(9, shuffled.length));
}

export default function HouseAdModal({ open, ad, onSkip, onCta }: Props) {
  const pathname = usePathname();
  const isGameRoute = !!pathname && pathname.startsWith("/static-games");

  // No mostrar el modal dentro de rutas de juegos
  if (!open || !ad || isGameRoute) return null;

  const [sec, setSec] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const covers = useMemo(() => pickCovers(ad), [ad]);
  const isDark = (ad?.theme ?? "dark") === "dark";

  // Countdown
  useEffect(() => {
    if (!open || !ad) return;
    setSec(ad.skipAfterSec ?? 7);
    setCanSkip(false);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSec((s) => {
        const next = Math.max(0, s - 1);
        if (next === 0) setCanSkip(true);
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open, ad?.id]);

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop que bloquea clicks */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto" />

      {/* Contenedor del modal (panel grande) */}
      <div
        className={[
          "relative mx-4 w-full max-w-[1400px] rounded-3xl shadow-2xl ring-1 ring-white/10 pointer-events-auto",
          isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900",
        ].join(" ")}
      >
        {/* Botón Omitir arriba derecha (sólo habilita cuando sec=0 y si es dismissible) */}
        <div className="absolute right-4 top-4 z-10">
          {ad.dismissible ? (
            <button
              disabled={!canSkip}
              onClick={() => canSkip && onSkip()}
              className={[
                "px-3 py-1 rounded-full text-sm font-semibold transition-colors cursor-pointer",
                isDark
                  ? "bg-slate-800/70 hover:bg-slate-700 disabled:bg-slate-800/40"
                  : "bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100/60",
              ].join(" ")}
              aria-label="Omitir"
              title="Omitir"
            >
              {canSkip ? "Omitir" : `Omitir (${sec})`}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* IZQ: mosaico 3×3 de covers (object-cover, full box) */}
          <div className="md:col-span-7 relative overflow-hidden rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none">
            <div className="w-full h-[600px] relative">
              <div className="absolute inset-0 p-2 grid grid-cols-3 grid-rows-3 gap-2">
                {covers.length ? (
                  covers.map((g, i) => (
                    <div
                      key={g._id + i}
                      className="relative w-full h-full rounded-xl overflow-hidden ring-1 ring-white/10"
                    >
                      {g.cover_url ? (
                        <img
                          src={g.cover_url}
                          alt={g.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-slate-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 row-span-3 rounded-xl bg-slate-800" />
                )}
              </div>
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-slate-900/80 via-slate-900/30 to-transparent" />
            </div>
          </div>

          {/* DER: copy + CTAs */}
          <div className="md:col-span-5 p-7 md:p-10 flex flex-col justify-center gap-5">
            <div className="space-y-3">
              <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight">
                {ad.title || "¡Pasate a Premium!"}
              </h2>
              {ad.subtitle ? (
                <p
                  className={[
                    "text-lg",
                    isDark ? "text-slate-300" : "text-slate-600",
                  ].join(" ")}
                >
                  {ad.subtitle}
                </p>
              ) : null}
              {ad.body ? (
                <p
                  className={[
                    "text-base",
                    isDark ? "text-slate-400" : "text-slate-600",
                  ].join(" ")}
                >
                  {ad.body}
                </p>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-4">
              <button
                onClick={onCta}
                className="px-6 py-3.5 rounded-2xl font-semibold shadow-md transition-transform hover:scale-[1.02] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-violet-600 text-white cursor-pointer"
              >
                {ad.ctaLabel || "Suscribirme"}
              </button>

              {ad.dismissible ? (
                <button
                  onClick={() => canSkip && onSkip()}
                  disabled={!canSkip}
                  className={[
                    "px-6 py-3.5 rounded-2xl font-semibold transition-colors cursor-pointer",
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:bg-slate-800/60"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:bg-slate-100/60",
                  ].join(" ")}
                >
                  {canSkip ? "Saltar" : `Esperar (${sec})`}
                </button>
              ) : null}
            </div>

            <p
              className={[
                "mt-2 text-xs",
                isDark ? "text-slate-500" : "text-slate-500",
              ].join(" ")}
            >
              Este anuncio solo se muestra a cuentas Free.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}