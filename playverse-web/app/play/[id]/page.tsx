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
import { useHouseAds } from "@/app/providers/HouseAdProvider";
import RankingButton from "@/components/RankingButton";
import { toast } from "sonner";

// Convex refs
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

  // Sesión
  const { data: session, status } = useSession();
  const localUser = useAuthStore((s) => s.user);

  const email =
    session?.user?.email?.toLowerCase() ||
    localUser?.email?.toLowerCase() ||
    null;

  // ⛔ CORTE SEGURO: sin email no sigue nada (previene acceso al iframe)
  useEffect(() => {
    if (status === "loading") return;
    if (!email) {
      toast.error("Debes iniciar sesión para jugar.");
      router.replace(`/auth/login?next=/play/${gameId}`);
    }
  }, [email, status, router, gameId]);

  // Perfil Convex
  const profile = useQuery(
    getUserByEmailRef,
    email ? { email } : "skip"
  ) as { _id: Id<"profiles">; role?: "free" | "premium" | "admin" } | null | undefined;

  const isAdmin = profile?.role === "admin";

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

  const title = String(game?.title ?? "Juego");
  const embedUrl = (game as any)?.embed_url ?? (game as any)?.embedUrl ?? null;
  const sandbox = (game as any)?.embed_sandbox ?? undefined;
  const allow = (game as any)?.embed_allow ?? undefined;

  const plan = (game as any)?.plan as "free" | "premium" | undefined;

  const expiresInMs = useMemo(() => {
    if (isAdmin) return null;
    if (!canPlay?.expiresAt) return null;
    return Math.max(0, canPlay.expiresAt - now);
  }, [canPlay?.expiresAt, now, isAdmin]);

// 🚫 Guardia total de seguridad (nivel superior)
useEffect(() => {
  if (status === "loading") return;
  if (!email) return; // ya se redirige más arriba

  // Esperar datos
  if (profile === undefined || canPlay === undefined) return;

  // Admin siempre OK
  if (profile?.role === "admin") return;

  // Acceso denegado
  if (!canPlay.canPlay) {
    let msg = "No tenés acceso a este juego.";

    if (canPlay.reason === "premium_required") msg = "Este juego requiere ser Premium.";
    if (canPlay.reason === "purchase_required") msg = "Debés comprar este juego.";
    if (canPlay.reason === "rental_required") msg = "Tu alquiler está vencido.";

    toast.error(msg);
    router.replace(`/juego/${gameId}`);
  }
}, [email, status, profile, canPlay, gameId, router]);

// ⚠️ Corte de backup (si algo llegara antes que el useEffect)
if (
  !email ||
  profile === undefined ||
  canPlay === undefined ||
  (!isAdmin && canPlay && !canPlay.canPlay)
) {
  return (
    <div className="min-h-screen bg-slate-900 text-white grid place-items-center">
      <div className="px-6 py-4 bg-slate-800/70 rounded-xl border border-slate-700 text-center space-y-4 max-w-md">
        <h1 className="text-xl font-bold text-red-400">{title}</h1>
        <p className="text-slate-300">No tenés acceso a este juego.</p>
        <Button
          onClick={() => router.push(`/juego/${gameId}`)}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Volver
        </Button>
      </div>
    </div>
  );
}

// 🚫 Nunca permitimos que la UI avance mientras falten datos críticos
const loadingHard =
  status === "loading" ||
  !email ||
  profile === undefined ||
  canPlay === undefined ||
  game === undefined;

if (loadingHard) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
      Cargando…
    </div>
  );
}

// 🚫 Si no hay juego o no es embebible, cortar aquí ANTES de montar iframe
if (!game) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
      Juego no encontrado.
    </div>
  );
}

if (!embedUrl) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
      Este juego no tiene versión embebible.
    </div>
  );
}

// 🚫 Corte duro: si NO está permitido, NI SIQUIERA se monta el iframe
if (!isAdmin && !canPlay.canPlay) {
  return (
    <div className="min-h-screen bg-slate-900 text-white grid place-items-center">
      <div className="px-6 py-4 bg-slate-800/70 rounded-xl border border-slate-700 text-center space-y-4 max-w-md">
        <h1 className="text-xl font-bold text-red-400">{title}</h1>
        <p className="text-slate-300">No tenés acceso a este juego.</p>
        <Button
          onClick={() => router.push(`/juego/${gameId}`)}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Volver
        </Button>
      </div>
    </div>
  );
}





  // Parámetros para score
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
            <RankingButton embedUrl={(game as any)?.embed_url ?? (game as any)?.embedUrl ?? undefined} />
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
            allow={allow ?? "autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; cross-origin-isolated"}
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
