// playverse-web/app/play/[id]/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import RankingButton from "@/components/RankingButton";
import { useAuthStore } from "@/lib/useAuthStore";

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
    () => (Array.isArray(params?.id) ? params.id[0] : params?.id) as string | undefined,
    [params]
  );

  const router = useRouter();
  const { data: session } = useSession();
  const localUser = useAuthStore((s) => s.user);

  const email =
    session?.user?.email?.toLowerCase() ||
    localUser?.email?.toLowerCase() ||
    null;

  // Datos del usuario
  const profile = useQuery(
    getUserByEmailRef,
    email ? { email } : "skip"
  ) as { _id: Id<"profiles">; role?: "free" | "premium" | "admin" } | null | undefined;

  const game = useQuery(
    getGameByIdRef,
    gameId ? ({ id: gameId as Id<"games"> } as any) : "skip"
  ) as any;

  const canPlay = useQuery(
    canPlayGameRef,
    email && profile?._id && gameId
      ? ({ userId: profile._id, gameId: gameId as Id<"games"> } as any)
      : "skip"
  ) as { canPlay: boolean; reason: string | null; expiresAt: number | null } | undefined;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Estados de carga
  if (!email || profile === undefined || game === undefined || canPlay === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
        Cargando…
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
        Juego no encontrado.
      </div>
    );
  }

  const embedUrl = (game as any)?.embed_url ?? (game as any)?.embedUrl ?? null;
  const sandbox = (game as any)?.embed_sandbox ?? undefined;
  const allow = (game as any)?.embed_allow ?? undefined;
  const title = game?.title ?? "Juego";

  if (!embedUrl) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
        Este juego no tiene versión embebible.
      </div>
    );
  }

  const expiresInMs =
    canPlay?.expiresAt != null ? Math.max(0, canPlay.expiresAt - now) : null;

  const qp: Record<string, string> = {};
  if (email) qp.email = email;
  if (gameId) qp.gid = gameId;

  const qs =
    Object.keys(qp).length
      ? (embedUrl.includes("?") ? "&" : "?") + new URLSearchParams(qp).toString()
      : "";

  const finalSrc = embedUrl + qs;
  const showCountdown = typeof expiresInMs === "number";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl md:text-2xl font-bold text-orange-400">{title}</h1>

          <div className="flex items-center gap-2">
            <RankingButton embedUrl={embedUrl} />
            <Button
              variant="outline"
              onClick={() => router.push(`/juego/${gameId}`)}
              className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900"
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
            </div>
          </div>
        )}

        <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
          {expiresInMs === 0 && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/75 backdrop-blur-sm">
              <div className="text-center space-y-3">
                <p className="text-slate-300">Tu alquiler expiró.</p>
                <Button
                  onClick={() => router.push(`/checkout/extender/${gameId}`)}
                  className="bg-orange-400 hover:bg-orange-500 text-slate-900"
                >
                  Extender
                </Button>
              </div>
            </div>
          )}

          <iframe
            src={finalSrc}
            title={title}
            className="w-full h-full"
            allow={
              allow ??
              "autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; cross-origin-isolated"
            }
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            allowFullScreen
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Si el juego no carga, revisá bloqueadores de anuncios o probá en una pestaña nueva.
        </p>
      </div>
    </div>
  );
}
