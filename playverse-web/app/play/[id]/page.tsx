// playverse-web/app/play/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/useAuthStore";
import { useHouseAds } from "@/app/providers/HouseAdProvider"; // ⬅️ NUEVO

// ✅ nuevo: botón Ranking
import RankingButton from "@/components/RankingButton";

const getGameByIdRef =
  (api as any)["queries/getGameById"].getGameById as FunctionReference<"query">;

const getUserByEmailRef =
  (api as any)["queries/getUserByEmail"].getUserByEmail as FunctionReference<"query">;

const canPlayGameRef =
  (api as any)["queries/canPlayGame"].canPlayGame as FunctionReference<"query">;

function msToClock(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function PlayEmbeddedPage() {
  const params = useParams() as { id?: string | string[] };
  const gameId = useMemo(
    () => (Array.isArray(params?.id) ? params!.id[0] : params?.id) as string | undefined,
    [params]
  );
  const router = useRouter();

  // Sesión + store local
  const { data: session } = useSession();
  const localUser = useAuthStore((s) => s.user);
  const email =
    session?.user?.email?.toLowerCase() ||
    localUser?.email?.toLowerCase() ||
    null;

  const profile = useQuery(
    getUserByEmailRef,
    email ? { email } : "skip"
  ) as { _id: Id<"profiles">; role?: "free" | "premium" | "admin" } | null | undefined;

  const isAdmin = profile?.role === "admin";
  const isPremiumSub = profile?.role === "premium";

  const game = useQuery(
    getGameByIdRef,
    gameId ? ({ id: gameId as Id<"games"> } as any) : "skip"
  ) as any;

  const canPlay = useQuery(
    canPlayGameRef,
    gameId ? ({ userId: profile?._id ?? null, gameId: gameId as Id<"games"> } as any) : "skip"
  ) as { canPlay: boolean; reason: string | null; expiresAt: number | null } | undefined;

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Datos de juego
  const title = String(game?.title ?? "Juego");
  const embedUrl = (game as any)?.embed_url ?? (game as any)?.embedUrl ?? null;
  const sandbox = (game as any)?.embed_sandbox as string | undefined;
  const allow = (game as any)?.embed_allow as string | undefined;

  const isEmbeddable = typeof embedUrl === "string" && embedUrl.trim().length > 0;
  const plan = (game as any)?.plan as "free" | "premium" | undefined;
  const isFreePlan = plan === "free";
  const isPremiumPlan = plan === "premium";

  // ⏱ contador alquiler (si aplica)
  const expiresInMs = useMemo(() => {
    if (isAdmin) return null;
    if (!canPlay?.expiresAt) return null;
    return Math.max(0, canPlay.expiresAt - now);
  }, [canPlay?.expiresAt, now, isAdmin]);

  // ✅ OVERRIDE local: embebidos
  const premiumOverrideAllowed =
    isEmbeddable &&
    !!email &&
    (isFreePlan || (isPremiumPlan && (isPremiumSub || isAdmin)));

  // Guard de login cuando corresponde (sin romper canPlay)
  useEffect(() => {
    if (isAdmin || premiumOverrideAllowed) return;
    if (canPlay === undefined) return;
    if (canPlay?.canPlay) return;
    if (canPlay?.reason === "login" || !email) {
      const next = `/play/${gameId}`;
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    }
  }, [canPlay, router, gameId, isAdmin, premiumOverrideAllowed, email]);

  // CTA según motivo (admin u override premium/free → sin CTA)
  const action = useMemo(() => {
    if (isAdmin || premiumOverrideAllowed) return null;
    const reason = canPlay?.reason;
    if (!reason) return null;
    if (reason === "premium_required") {
      return { label: "Hazte Premium", href: "/premium?intent=subscribe&plan=monthly" };
    }
    if (reason === "purchase_required") {
      return { label: "Comprar juego", href: `/checkout/compra/${gameId}` };
    }
    if (reason === "rental_required") {
      return { label: "Alquilar juego", href: `/checkout/alquiler/${gameId}` };
    }
    return null;
  }, [canPlay?.reason, gameId, isAdmin, premiumOverrideAllowed]);

  // ---------- NUEVO: pre-roll al entrar directo a /play/[id] (solo plan free) ----------
  const { gateOnPlayPageMount } = useHouseAds();
  useEffect(() => {
    if (!gameId) return;
    if (!game) return; // esperar a tener el juego
    const plan = (game as any)?.plan;
    if (plan === "free") {
      // El provider valida role === "free" y aplica TTL para que no dispare en bucle.
      gateOnPlayPageMount(gameId);
    }
  }, [gameId, game, gateOnPlayPageMount]);
  // -------------------------------------------------------------------------------------

  // Loading / sin datos
  if (!gameId || game === undefined || canPlay === undefined) {
    return <div className="min-h-[60vh] grid place-items-center text-slate-300">Cargando…</div>;
  }
  if (!game) {
    return <div className="min-h-[60vh] grid place-items-center text-slate-300">Juego no encontrado.</div>;
  }
  if (!embedUrl) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-slate-300">
        Este juego no tiene versión embebible.
      </div>
    );
  }

  // Acceso final
  const allowed = isAdmin || premiumOverrideAllowed || !!canPlay?.canPlay;

  // No permitido → pantalla con CTA
  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-orange-400">{title}</h1>
            <Button
              variant="outline"
              onClick={() => router.push(`/juego/${gameId}`)}
              className="border-orange-400 text-orange-400 bg-transparent hover:bg-orange-400 hover:text-slate-900"
            >
              Volver
            </Button>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
            <p className="text-slate-300 mb-4">
              No tenés acceso para jugar este título desde el sitio.
            </p>
            {action && (
              <Button
                onClick={() => router.push(action.href)}
                className="bg-orange-400 hover:bg-orange-500 text-slate-900"
              >
                {action.label}
              </Button>
            )}
            {!action && (
              <Button
                onClick={() => router.push(`/juego/${gameId}`)}
                className="bg-orange-400 hover:bg-orange-500 text-slate-900"
              >
                Volver al detalle
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const showCountdown = typeof expiresInMs === "number";

  // URL final del iframe con email + gid (para que tu juego conozca el user y el gameId)
  const qp: Record<string, string> = {};
  if (email) qp.email = email;
  if (gameId) qp.gid = gameId;
  const qs =
    Object.keys(qp).length
      ? (embedUrl.includes("?") ? "&" : "?") + new URLSearchParams(qp).toString()
      : "";
  const finalSrc = embedUrl + qs;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header con botón Ranking + Volver */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl md:text-2xl font-bold text-orange-400">{title}</h1>
          <div className="flex items-center gap-2">
            <RankingButton embedUrl={(game as any)?.embed_url ?? (game as any)?.embedUrl ?? undefined} />
            <Button
              variant="outline"
              onClick={() => router.push(`/juego/${gameId}`)}
              className="border-orange-400 text-orange-400 bg-transparent hover:bg-orange-400 hover:text-slate-900"
            >
              Volver
            </Button>
          </div>
        </div>

        {showCountdown && (
          <div className="mb-3">
            <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-slate-300 text-sm">Tiempo restante del alquiler:</span>
              <span className="text-orange-400 font-semibold">{msToClock(expiresInMs!)}</span>
              {expiresInMs === 0 && (
                <Button
                  onClick={() => router.push(`/checkout/extender/${gameId}`)}
                  className="ml-2 bg-orange-400 hover:bg-orange-500 text-slate-900 h-8"
                >
                  Extender
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Player */}
        <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
          {expiresInMs === 0 && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/80 backdrop-blur-sm">
              <div className="text-center space-y-3">
                <p className="text-slate-300">Tu alquiler venció.</p>
                <Button
                  onClick={() => router.push(`/checkout/extender/${gameId}`)}
                  className="bg-orange-400 hover:bg-orange-500 text-slate-900"
                >
                  Extender alquiler
                </Button>
              </div>
            </div>
          )}

          <iframe
            src={finalSrc}
            title={title}
            className="w-full h-full"
            allow={allow ?? "autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; cross-origin-isolated"}
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            allowFullScreen
          />
        </div>

        {/* Ayudas de compatibilidad */}
        <p className="mt-3 text-xs text-slate-500">
          Si el juego no carga, revisá bloqueadores de anuncios o probá en una pestaña nueva.
        </p>
      </div>
    </div>
  );
}
