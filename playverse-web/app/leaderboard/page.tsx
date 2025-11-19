"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex/_generated/api";

// URLs desde env
const TETRIS_URL = process.env.NEXT_PUBLIC_TETRIS_URL || "";
const ARENA_URL = process.env.NEXT_PUBLIC_ARENA_URL || "";

// Juegos soportados
type GameKey = "snake" | "pulse-riders" | "tetris" | "arena";

const GAME_META: Record<GameKey, { title: string; embedUrl: string }> = {
  snake: { title: "Snake (Freeware)", embedUrl: "/static-games/snake" },
  "pulse-riders": { title: "Pulse Riders", embedUrl: "/static-games/pulse-riders" },
  tetris: { title: "Tetris (PlayVerse)", embedUrl: TETRIS_URL || "/tetris" },
  arena: { title: "Twin-Stick Arena", embedUrl: ARENA_URL || "/arena" },
};

// Convex refs
const topByGameRef = (
  (api as any)["queries/scores/topByGame"] as { topByGame: FunctionReference<"query"> }
).topByGame;

const getIdByEmbedUrlRef = (
  (api as any)["queries/games/getIdByEmbedUrl"] as { getIdByEmbedUrl: FunctionReference<"query"> }
).getIdByEmbedUrl;

const getUserByEmailRef =
  (api as any)["queries/getUserByEmail"].getUserByEmail as FunctionReference<"query">;

const ownsGameRef =
  (api as any)["queries/ownsGame"].ownsGame as FunctionReference<"query">;

// ======================================================
//                COMPONENTE PRINCIPAL
// ======================================================
export default function LeaderboardPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const email = session?.user?.email?.toLowerCase() ?? null;

  // Perfil Convex
  const profile = useQuery(
    getUserByEmailRef as any,
    email ? { email } : "skip"
  ) as { _id: string; role?: "free" | "premium" | "admin" } | null | undefined;

  const userId = profile?._id ?? null;

  // Juego seleccionado
  const gameParam = (params.get("game") || "") as GameKey;
  const selected: GameKey = ["snake", "pulse-riders", "tetris", "arena"].includes(gameParam)
    ? gameParam
    : "snake";

  const meta = GAME_META[selected];

  // Fallbacks
  const tetrisAbs = GAME_META.tetris.embedUrl;
  let tetrisRel = "/tetris";
  try {
    if (tetrisAbs) {
      const u = new URL(tetrisAbs, "https://example.org");
      tetrisRel = u.pathname || "/tetris";
    }
  } catch {}

  const arenaAbs = GAME_META.arena.embedUrl;
  let arenaMain = "/arena";
  try {
    if (arenaAbs) {
      const u = new URL(arenaAbs, "https://example.org");
      arenaMain = u.pathname || "/arena";
    }
  } catch {}
  const arenaStatic = "/static-games/arena";

  // ======================================================
  //                SCORES QUERY
  // ======================================================
  const rowsPrimary = useQuery(
    topByGameRef as any,
    { embedUrl: meta.embedUrl, limit: 25 } as any
  ) as any[] | undefined;

  const rowsTetrisFallback = useQuery(
    topByGameRef as any,
    { embedUrl: tetrisRel, limit: 25 } as any
  ) as any[] | undefined;

  const rowsArenaMain = useQuery(
    topByGameRef as any,
    { embedUrl: arenaMain, limit: 25 } as any
  ) as any[] | undefined;

  const rowsArenaStatic = useQuery(
    topByGameRef as any,
    { embedUrl: arenaStatic, limit: 25 } as any
  ) as any[] | undefined;

  const rows =
    selected === "tetris"
      ? (rowsPrimary?.length ? rowsPrimary : rowsTetrisFallback)
      : selected === "arena"
      ? rowsPrimary?.length
        ? rowsPrimary
        : rowsArenaMain?.length
        ? rowsArenaMain
        : rowsArenaStatic
      : rowsPrimary;

  // ======================================================
  //       RESOLVER /play/[id]
  // ======================================================
  const selectedInfoPrimary = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: meta.embedUrl } as any
  ) as { id: string } | null | undefined;

  const tetrisInfoAbs = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: tetrisAbs } as any
  ) as { id: string } | null | undefined;

  const tetrisInfoRel = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: tetrisRel } as any
  ) as { id: string } | null | undefined;

  const arenaInfoMain = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: arenaMain } as any
  ) as { id: string } | null | undefined;

  const arenaInfoStaticQ = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: arenaStatic } as any
  ) as { id: string } | null | undefined;

  const selectedInfo =
    selected === "tetris"
      ? tetrisInfoAbs ?? tetrisInfoRel ?? selectedInfoPrimary
      : selected === "arena"
      ? selectedInfoPrimary ?? arenaInfoMain ?? arenaInfoStaticQ
      : selectedInfoPrimary;

  const playHrefSelected = selectedInfo?.id ? `/play/${selectedInfo.id}` : undefined;

  // ======================================================
  //       VALIDAR SI POSEE EL JUEGO
  // ======================================================
  const owns =
    useQuery(
      ownsGameRef as any,
      userId && selectedInfo?.id
        ? { userId, gameId: selectedInfo.id }
        : "skip"
    ) as { owns: boolean } | null | undefined;

  const disabled =
    !playHrefSelected ||
    !userId ||
    owns === undefined ||
    owns === null ||
    owns.owns === false;

  // ======================================================
  // UI
  // ======================================================

  const Tab = ({ k, children }: { k: GameKey; children: React.ReactNode }) => {
    const active = selected === k;
    return (
      <button
        onClick={() => router.push(`/leaderboard?game=${k}`)}
        className={`px-4 py-2 rounded-full border transition ${
          active
            ? "bg-cyan-500 text-slate-900 border-cyan-300"
            : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
        }`}
      >
        {children}
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-12">

        {/* CTA */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-400 drop-shadow-sm">
            Leaderboard
          </h1>

          {playHrefSelected ? (
            <Link
              href={disabled ? "#" : playHrefSelected}
              className={`inline-flex items-center rounded-full font-semibold px-4 py-2 shadow ring-1 transition
                ${
                  disabled
                    ? "bg-slate-700 text-slate-400 ring-slate-600 cursor-not-allowed"
                    : "bg-amber-400 hover:bg-amber-300 text-slate-900 ring-amber-300/40"
                }
              `}
              onClick={(e) => {
                if (disabled) {
                  e.preventDefault();
                  alert("No tenés acceso a este juego. Compralo o alquilalo primero.");
                }
              }}
            >
              Jugar {meta.title}
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-700 text-slate-300 px-4 py-2 text-sm">
              Resolviendo acceso…
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tab k="snake">Snake (Freeware)</Tab>
          <Tab k="pulse-riders">Pulse Riders</Tab>
          <Tab k="tetris">Tetris</Tab>
          <Tab k="arena">Twin-Stick Arena</Tab>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
          <div className="px-4 py-3 text-amber-300 font-semibold border-b border-slate-700">
            Top 25 — {meta.title}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800/70 text-slate-300">
                <tr>
                  <th className="px-4 py-2 text-left w-12">#</th>
                  <th className="px-4 py-2 text-left">Jugador</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Score</th>
                  <th className="px-4 py-2 text-left">Actualizado</th>
                </tr>
              </thead>

              <tbody>
                {(rows ?? []).map(
                  (
                    r: {
                      _id: string;
                      userName: string;
                      userEmail: string;
                      score: number;
                      updatedAt?: number;
                    },
                    i: number
                  ) => (
                    <tr key={r._id} className="border-t border-slate-700/60">
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2">{r.userName}</td>
                      <td className="px-4 py-2 text-slate-300">{r.userEmail}</td>
                      <td className="px-4 py-2 font-semibold text-cyan-300">{r.score}</td>
                      <td className="px-4 py-2 text-slate-400">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  )
                )}

                {(!rows || rows.length === 0) && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                      Sin registros todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
