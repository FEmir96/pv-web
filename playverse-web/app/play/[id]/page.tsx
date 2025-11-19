"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import RankingButton from "@/components/RankingButton";
import { Button } from "@/components/ui/button";

const convexApi = api as Record<string, any>;

const getGameByIdRef =
  (convexApi?.queries?.getGameById?.getGameById ??
    convexApi?.queries?.getGameById ??
    convexApi?.getGameById ??
    convexApi?.["queries/getGameById"]) as FunctionReference<"query">;

const getUserByEmailRef =
  (convexApi?.queries?.getUserByEmail?.getUserByEmail ??
    convexApi?.queries?.getUserByEmail ??
    convexApi?.getUserByEmail ??
    convexApi?.["queries/getUserByEmail"]) as FunctionReference<"query">;

const canPlayGameRef =
  (convexApi?.queries?.games?.canPlayGame?.canPlayGame ??
    convexApi?.queries?.games?.canPlayGame ??
    convexApi?.queries?.["games/canPlayGame"] ??
    convexApi?.["queries/games/canPlayGame"]) as FunctionReference<"query">;

export default function PlayEmbeddedPage() {
  const router = useRouter();
  const params = useParams();

  const gameId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const { data: session } = useSession();
  const email = session?.user?.email?.toLowerCase() ?? null;

  useEffect(() => {
    console.debug("[PLAY] gameId", gameId);
    console.debug("[PLAY] session email", email);
  }, [gameId, email]);

  const game = useQuery(
    getGameByIdRef,
    gameId ? { id: gameId as Id<"games"> } : "skip"
  );

  const profile = useQuery(
    getUserByEmailRef,
    email ? { email } : "skip"
  );

  const canPlay = useQuery(
    canPlayGameRef,
    email && profile?._id && gameId
      ? { userId: profile._id, gameId: gameId as Id<"games"> }
      : "skip"
  );

  useEffect(() => {
    console.debug("[PLAY] game", game);
  }, [game]);

  useEffect(() => {
    console.debug("[PLAY] profile", profile);
  }, [profile]);

  useEffect(() => {
    console.debug("[PLAY] canPlay", canPlay);
  }, [canPlay]);

  if (!gameId) {
    return (
      <Blocked
        title="Error"
        text="ID de juego invalido."
        buttonText="Volver"
        onClick={() => router.push("/")}
      />
    );
  }

  const isGameLoading = typeof game === "undefined";
  const isProfileLoading = email ? typeof profile === "undefined" : false;
  const isCanPlayLoading =
    email && profile?._id ? typeof canPlay === "undefined" : false;

  if (isGameLoading || isProfileLoading || isCanPlayLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-200">
        Cargando...
      </div>
    );
  }

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

  const title = game?.title ?? "Juego";

  if (!email) {
    return (
      <Blocked
        title={title}
        text="Debes iniciar sesion para jugar este titulo."
        buttonText="Iniciar sesion"
        onClick={() => router.push(`/auth/login?next=/play/${gameId}`)}
      />
    );
  }

  if (profile === null) {
    return (
      <Blocked
        title="Error"
        text="No encontramos tu perfil."
        buttonText="Volver"
        onClick={() => router.push("/")}
      />
    );
  }

  const embedUrl =
    (game as any)?.embed_url ?? (game as any)?.embedUrl ?? null;
  console.debug("[PLAY] embedUrl", embedUrl);

  if (!embedUrl) {
    return (
      <Blocked
        title={title}
        text="Este juego no tiene version embebible."
        buttonText="Volver"
        onClick={() => router.push(`/juego/${gameId}`)}
      />
    );
  }

  if (!canPlay || !canPlay.canPlay) {
    const role = (profile as any)?.role ?? null;
    const isPremium = role === "premium" || role === "admin";

    let message = "No tenes acceso a este juego.";
    let buttonText = "Volver";
    let href: string | null = `/juego/${gameId}`;

    switch (canPlay?.reason) {
      case "premium_required":
        message = "Este juego requiere ser usuario Premium.";
        buttonText = "Hacerse Premium";
        href = "/premium";
        break;
      case "purchase_required":
        if (isPremium) {
          message = "Debes comprar este juego.";
          buttonText = "Comprar";
          href = `/checkout/compra/${gameId}`;
        } else {
          message = "Actualiza a Premium para comprar este juego.";
          buttonText = "Hacerse Premium";
          href = "/premium";
        }
        break;
      case "rental_required":
        message = "Tu alquiler esta vencido o no tienes uno activo.";
        buttonText = "Alquilar";
        href = `/checkout/alquiler/${gameId}`;
        break;
      default:
        break;
    }

    return (
      <Blocked
        title={title}
        text={message}
        buttonText={buttonText}
        onClick={href ? () => router.push(href) : undefined}
      />
    );
  }

  const qsParams = new URLSearchParams({
    email,
    gid: gameId,
  }).toString();
  console.debug("[PLAY] queryString", qsParams);

  const finalSrc = embedUrl.includes("?")
    ? `${embedUrl}&${qsParams}`
    : `${embedUrl}?${qsParams}`;
  console.debug("[PLAY] iframe src", finalSrc);

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
          Si el juego no carga, proba en una pestana nueva.
        </p>
      </div>
    </div>
  );
}

function Blocked({
  title,
  text,
  buttonText,
  onClick,
}: {
  title: string;
  text: string;
  buttonText?: string;
  onClick?: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-white grid place-items-center px-4">
      <div className="p-6 bg-slate-800/70 border border-slate-700 rounded-xl text-center max-w-md">
        <h1 className="text-xl font-bold text-red-400 mb-2">{title}</h1>
        <p className="text-slate-300 mb-4">{text}</p>
        {buttonText && onClick ? (
          <Button onClick={onClick} className="bg-red-500 hover:bg-red-600 text-white">
            {buttonText}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
