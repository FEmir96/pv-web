"use client";

import { useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex";
import type { Id } from "@convex/_generated/dataModel";
import RankingButton from "@/components/RankingButton";
import { Button } from "@/components/ui/button";

// Convex refs
const getGameByIdRef = (api as any)["queries/getGameById"].getGameById;
const getUserByEmailRef = (api as any)["queries/getUserByEmail"].getUserByEmail;
const canPlayGameRef = (api as any)["queries/canPlayGame"].canPlayGame;

export default function PlayEmbeddedPage() {
  const router = useRouter();
  const params = useParams();

  // ❗ GameID nunca cambia
  const gameId = useMemo(() => {
    const raw = (params?.id as string | string[] | undefined) ?? null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  // ❗ Sesión
  const { data: session } = useSession();
  const email = session?.user?.email?.toLowerCase() ?? null;

  // ❗ Queries SIN CONDICIONALES (React seguro)
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

  // ❗ Si falta algo → pantalla de carga universal (simple & estable)
  if (!game || (email && !profile) || (email && !canPlay)) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-200">
        Cargando…
      </div>
    );
  }

  const title = game?.title ?? "Juego";
  const embedUrl = game?.embed_url ?? game?.embedUrl ?? null;

  // ❗ Caso: no logueado
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

  // ❗ Caso: juego no existe
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

  // ❗ Caso: no embebible
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

  // ❗ Caso: no tiene acceso
  if (!canPlay.canPlay) {
    let msg = "No tenés acceso a este juego.";
    let btn = "Volver";
    let href = `/juego/${gameId}`;

    if (canPlay.reason === "premium_required") {
      msg = "Este juego requiere ser Premium.";
      btn = "Hacerse Premium";
      href = "/premium";
    }

    if (canPlay.reason === "purchase_required") {
      msg = "Debes comprar este juego.";
      btn = "Comprar";
      href = `/checkout/compra/${gameId}`;
    }

    if (canPlay.reason === "rental_required") {
      msg = "Tu alquiler está vencido o no tienes uno activo.";
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

  // ❗ SI LLEGA ACÁ → EL USUARIO PUEDE JUGAR
  const qs =
    embedUrl.includes("?")
      ? "&" + new URLSearchParams({ email, gid: gameId! }).toString()
      : "?" + new URLSearchParams({ email, gid: gameId! }).toString();

  const finalSrc = embedUrl + qs;

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
