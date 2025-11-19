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
  const gameId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const router = useRouter();
  const { data: session } = useSession();
  const localUser = useAuthStore((s) => s.user);
  const email =
    session?.user?.email?.toLowerCase() ||
    localUser?.email?.toLowerCase() ||
    null;

  //-- 1) Query juego: siempre se ejecuta
  const game = useQuery(
    getGameByIdRef,
    gameId ? { id: gameId as Id<"games"> } : "skip"
  );

  //-- 2) Perfil: solo si hay email
  const profile = useQuery(
    getUserByEmailRef,
    email ? { email } : "skip"
  );

  //-- 3) canPlay: solo si email, profile y juego están listos
  const canPlay = useQuery(
    canPlayGameRef,
    email && profile?._id && gameId
      ? { userId: profile._id, gameId: gameId as Id<"games"> }
      : "skip"
  );

  // ========== LOADING CONTROL INTELIGENTE ==========
  // Si no hay email → no es loading → se muestra guard más abajo
  if (!game) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
        Cargando juego…
      </div>
    );
  }

  // Si hay email pero profile está cargando
  if (email && profile === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
        Cargando perfil…
      </div>
    );
  }

  // Si hay email + profile pero todavía no vino canPlay
  if (email && profile && canPlay === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-300">
        Verificando acceso…
      </div>
    );
  }

  // ========== ANÁLISIS DE ACCESO ==========
  const embedUrl = game?.embed_url ?? game?.embedUrl ?? null;
  const title = game?.title ?? "Juego";
  const sandbox = game?.embed_sandbox ?? undefined;
  const allow = game?.embed_allow ?? undefined;

  const blocked =
    !email ||                 // no logueado
    !canPlay?.canPlay;        // no tiene permiso

  // Mensaje + CTA según el motivo
  let guardMsg = "";
  let guardCTA = null;

  if (!email) {
    guardMsg = "Debes iniciar sesión para jugar este título.";
    guardCTA = (
      <Button
        onClick={() => router.push(`/auth/login?next=/play/${gameId}`)}
        className="bg-orange-400 hover:bg-orange-500 text-slate-900"
      >
        Iniciar sesión
      </Button>
    );
  } else if (!canPlay?.canPlay) {
    switch (canPlay?.reason) {
      case "purchase_required":
        guardMsg = "Debes comprar este juego para jugarlo.";
        guardCTA = (
          <Button
            onClick={() => router.push(`/checkout/compra/${gameId}`)}
            className="bg-orange-400 hover:bg-orange-500 text-slate-900"
          >
            Comprar juego
          </Button>
        );
        break;
      case "rental_required":
        guardMsg = "Tu alquiler está vencido o no tienes uno activo.";
        guardCTA = (
          <Button
            onClick={() => router.push(`/checkout/alquiler/${gameId}`)}
            className="bg-orange-400 hover:bg-orange-500 text-slate-900"
          >
            Alquilar juego
          </Button>
        );
        break;
      case "premium_required":
        guardMsg = "Este juego requiere suscripción Premium.";
        guardCTA = (
          <Button
            onClick={() => router.push(`/premium`)}
            className="bg-orange-400 hover:bg-orange-500 text-slate-900"
          >
            Hacerse Premium
          </Button>
        );
        break;
      default:
        guardMsg = "No tienes acceso a este juego.";
        guardCTA = (
          <Button
            onClick={() => router.push(`/juego/${gameId}`)}
            className="bg-orange-400 hover:bg-orange-500 text-slate-900"
          >
            Volver
          </Button>
        );
    }
  }

  // ========== GUARD UI (modal/pantalla) ==========
  if (blocked) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-white px-4">
        <div className="px-6 py-5 bg-slate-800/70 border border-slate-700 rounded-xl max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-orange-400">{title}</h1>
          <p className="text-slate-300">{guardMsg}</p>
          {guardCTA}
        </div>
      </div>
    );
  }

  // ========== SI LLEGA ACÁ → PUEDE JUGAR ==========
  const qp: Record<string, string> = {};
  if (email) qp.email = email;
  if (gameId) qp.gid = gameId;

  const qs =
    embedUrl.includes("?")
      ? "&" + new URLSearchParams(qp).toString()
      : "?" + new URLSearchParams(qp).toString();

  const finalSrc = embedUrl + qs;

  // Alquiler countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresInMs =
    canPlay?.expiresAt != null ? Math.max(0, canPlay.expiresAt - now) : null;

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

        {expiresInMs != null && (
          <div className="mb-3">
            <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-slate-300 text-sm">Tiempo restante del alquiler:</span>
              <span className="text-orange-400 font-semibold">{msToClock(expiresInMs)}</span>
            </div>
          </div>
        )}

        <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
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
