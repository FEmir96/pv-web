"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import RankingButton from "@/components/RankingButton";
import { Button } from "@/components/ui/button";

// --------------------------
// CONVEX REFS
// --------------------------
const getGameByIdRef = api.queries.getGameById.getGameById as any;
const getUserByEmailRef = api.queries.getUserByEmail.getUserByEmail as any;
const canPlayGameRef =
  api.queries.games?.canPlayGame?.canPlayGame ??
  api.queries.canPlayGame?.canPlayGame ??
  api.queries.games?.canPlayGame;

export default function PlayEmbeddedPage() {
  const router = useRouter();
  const params = useParams();

  // --------------------------
  // ID DE JUEGO
  // --------------------------
  const gameId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const { data: session } = useSession();
  const email = session?.user?.email?.toLowerCase() ?? null;

  useEffect(() => {
    console.log("🎮 [DEBUG FRONT] gameId →", gameId);
    console.log("👤 [DEBUG FRONT] session email →", email);
  }, [gameId, email]);

  if (!gameId) {
    return (
      <Blocked
        title="Error"
        text="ID de juego inválido."
        buttonText="Volver"
        onClick={() => router.push("/")}
      />
    );
  }

  // --------------------------
  // QUERIES
  // --------------------------
  const game = useQuery(getGameByIdRef, { id: gameId as Id<"games"> });

  const profile = useQuery(
    getUserByEmailRef,
    email ? { email } : "skip"
  );

  const canPlay = useQuery(
    canPlayGameRef,
    email && profile?._id
      ? { userId: profile._id, gameId: gameId as Id<"games"> }
      : "skip"
  );

  // DEBUG
  useEffect(() => console.log("🎮 [DEBUG FRONT] game →", game), [game]);
  useEffect(() => console.log("👤 [DEBUG FRONT] profile →", profile), [profile]);
  useEffect(() => console.log("🔐 [DEBUG FRONT] canPlay →", canPlay), [canPlay]);

  // --------------------------
  // LOADING STATE
  // --------------------------
  if (!game || (email && !profile) || (email && !canPlay)) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-200">
        Cargando…
      </div>
    );
  }

  const title = game?.title ?? "Juego";
  const embedUrl = game?.embed_url ?? game?.embedUrl ?? null;

  console.log("🌐 [DEBUG FRONT] embedUrl →", embedUrl);

  // --------------------------
  // NO LOGUEADO
  // --------------------------
  if (!email) {
    return (
      <Blocked
        title={title}
        text="Debes iniciar sesión para jugar este título."
        buttonText="Iniciar sesión"
        onClick={() => router.push(`/auth/login?next=/play/${gameId}`)}
      />
    );
  }

  // --------------------------
  // JUEGO INEXISTENTE
  // --------------------------
  if (!game) {
    return (
      <Blocked
        title="Error"
        text="Juego no encontrado."
        buttonText="Volver"
        onClick={() => router.push("/")}
      />
    );
  }

  // --------------------------
  // NO EMBEBIBLE
  // --------------------------
  if (!embedUrl) {
    return (
      <Blocked
        title={title}
        text="Este juego no tiene versión embebible."
        buttonText="Volver"
        onClick={() => router.push(`/juego/${gameId}`)}
      />
    );
  }

  // --------------------------
  // VALIDACIÓN DE ACCESO
  // --------------------------
  if (!canPlay.canPlay) {
    console.log("🚫 [DEBUG FRONT] canPlayGame bloqueó acceso. Razón:", canPlay.reason);

    let msg = "No tenés acceso a este juego.";
    let btn = "Volver";
    let href = `/juego/${gameId}`;

    if (canPlay.reason === "premium_required") {
      msg = "Este título es Premium.";
      btn = "Hacerse Premium";
      href = "/premium";
    }

    if (canPlay.reason === "purchase_required") {
      msg = "Debes comprar este juego.";
      btn = "Comprar";
      href = `/checkout/compra/${gameId}`;
    }

    if (canPlay.reason === "rental_required") {
      msg = "Tu alquiler está vencido o no tenés uno activo.";
      btn = "Alquilar";
      href = `/checkout/alquiler/${gameId}`;
    }

    return (
      <Blocked
        title={title}
        text={msg}
        buttonText={btn}
        onClick={() => router.push(href)}
      />
    );
  }

  // --------------------------
  // CONSTRUIR QUERYSTRING
  // --------------------------
  const qsParams = new URLSearchParams({
    email: email ?? "",
    gid: gameId ?? "",
  }).toString();

  console.log("🔗 [DEBUG FRONT] QueryString generado →", qsParams);

  const finalSrc = embedUrl.includes("?")
    ? `${embedUrl}&${qsParams}`
    : `${embedUrl}?${qsParams}`;

  console.log("▶️ [DEBUG FRONT] iframe src FINAL →", finalSrc);

  // --------------------------
  // RENDER FRAME
  // --------------------------
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

        <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
          <iframe
            src={finalSrc}
            className="w-full h-full"
            title={title}
            allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write;"
            referrerPolicy="no-referrer"
            allowFullScreen
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Si el juego no carga, probá en una pestaña nueva.
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// COMPONENTE BLOQUEADO
// -------------------------------------------------------
function Blocked({
  title,
  text,
  buttonText,
  onClick,
}: {
  title: string;
  text: string;
  buttonText: string;
  onClick: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-white grid place-items-center px-4">
      <div className="p-6 bg-slate-800/70 border border-slate-700 rounded-xl text-center max-w-md">
        <h1 className="text-xl font-bold text-red-400 mb-2">{title}</h1>
        <p className="text-slate-300 mb-4">{text}</p>
        <Button onClick={onClick} className="bg-red-500 hover:bg-red-600 text-white">
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
