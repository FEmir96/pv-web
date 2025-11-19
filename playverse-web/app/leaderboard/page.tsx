"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
const topByGameRef = api.queries.scores.topByGame.topByGame as any;

const getIdByEmbedUrlRef = api.queries.games.getIdByEmbedUrl.getIdByEmbedUrl as any;

// ======================================================
//                COMPONENTE PRINCIPAL
// ======================================================
export default function LeaderboardPage() {
  const params = useSearchParams();
  const router = useRouter();

  // Juego seleccionado
  const gameParam = (params.get("game") || "") as GameKey;
  const selected: GameKey = ["snake", "pulse-riders", "tetris", "arena"].includes(gameParam)
    ? gameParam
    : "snake";

  const meta = GAME_META[selected];

  // ======================================================
  //                SCORES QUERY
  // ======================================================
  const rows = useQuery(
    topByGameRef,
    { embedUrl: meta.embedUrl, limit: 25 }
  ) as any[] | undefined;

  // ======================================================
  //       RESOLVER /play/[id]
  // ======================================================
  const selectedInfo = useQuery(
    getIdByEmbedUrlRef,
    { embedUrl: meta.embedUrl } as any
  ) as { id: string } | null | undefined;
  const playHrefSelected = selectedInfo?.id ? `/play/${selectedInfo.id}` : undefined;

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

        {/* Título */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-400 drop-shadow-sm">
            Leaderboard
          </h1>
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
