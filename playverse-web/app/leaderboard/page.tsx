"use client";

import React, { useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

const TETRIS_URL = process.env.NEXT_PUBLIC_TETRIS_URL || "";
const ARENA_URL = process.env.NEXT_PUBLIC_ARENA_URL || "";
const LIMIT = 25;

type GameKey = "snake" | "pulse-riders" | "tetris" | "arena";

const GAME_META: Record<GameKey, { title: string; embedUrl: string }> = {
  snake: { title: "Snake (Freeware)", embedUrl: "/static-games/snake" },
  "pulse-riders": { title: "Pulse Riders", embedUrl: "/static-games/pulse-riders" },
  tetris: { title: "Tetris (PlayVerse)", embedUrl: TETRIS_URL || "/tetris" },
  arena: { title: "Twin-Stick Arena", embedUrl: ARENA_URL || "/arena" },
};

const topByGameRef = api.queries.scores.topByGame.topByGame as any;

export default function LeaderboardPage() {
  const params = useSearchParams();
  const router = useRouter();

  const gameParam = (params.get("game") || "") as GameKey;
  const selected: GameKey = ["snake", "pulse-riders", "tetris", "arena"].includes(gameParam)
    ? gameParam
    : "snake";

  const meta = GAME_META[selected];

  const tetrisVariants = useMemo(() => {
    const set = new Set<string>();
    if (GAME_META.tetris.embedUrl) set.add(GAME_META.tetris.embedUrl);
    set.add("/tetris");
    set.add("https://playverse-demo-games.vercel.app/tetris");
    return Array.from(set);
  }, []);

  const arenaVariants = useMemo(() => {
    const set = new Set<string>();
    if (GAME_META.arena.embedUrl) set.add(GAME_META.arena.embedUrl);
    set.add("/arena");
    set.add("/static-games/arena");
    set.add("https://playverse-demo-games.vercel.app/arena");
    return Array.from(set);
  }, []);

  const variantPool = useMemo(() => {
    if (selected === "tetris") {
      return tetrisVariants.filter((url) => url && url !== meta.embedUrl);
    }
    if (selected === "arena") {
      return arenaVariants.filter((url) => url && url !== meta.embedUrl);
    }
    return [];
  }, [selected, meta.embedUrl, tetrisVariants, arenaVariants]);

  const rowsMain = useQuery(
    topByGameRef,
    meta.embedUrl ? { embedUrl: meta.embedUrl, limit: LIMIT } : "skip"
  ) as any[] | undefined;

  const rowsAlt1 = useQuery(
    topByGameRef,
    variantPool[0] ? { embedUrl: variantPool[0], limit: LIMIT } : "skip"
  ) as any[] | undefined;

  const rowsAlt2 = useQuery(
    topByGameRef,
    variantPool[1] ? { embedUrl: variantPool[1], limit: LIMIT } : "skip"
  ) as any[] | undefined;

  const rowsAlt3 = useQuery(
    topByGameRef,
    variantPool[2] ? { embedUrl: variantPool[2], limit: LIMIT } : "skip"
  ) as any[] | undefined;

  const isLoading =
    typeof rowsMain === "undefined" ||
    (variantPool[0] && typeof rowsAlt1 === "undefined") ||
    (variantPool[1] && typeof rowsAlt2 === "undefined") ||
    (variantPool[2] && typeof rowsAlt3 === "undefined");

  const leaderboardRows = useMemo(() => {
    const sources = [rowsMain, rowsAlt1, rowsAlt2, rowsAlt3].filter(
      (arr): arr is any[] => Array.isArray(arr)
    );
    const bestByUser = new Map<string, any>();

    for (const list of sources) {
      for (const entry of list) {
        const key = entry.userId ?? entry.userEmail;
        const current = bestByUser.get(key);
        if (
          !current ||
          entry.score > current.score ||
          (entry.score === current.score &&
            (entry.updatedAt ?? 0) > (current.updatedAt ?? 0))
        ) {
          bestByUser.set(key, entry);
        }
      }
    }

    return Array.from(bestByUser.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  }, [rowsMain, rowsAlt1, rowsAlt2, rowsAlt3]);

  const rowsToRender = isLoading ? [] : leaderboardRows;

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
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-400 drop-shadow-sm">
            Leaderboard
          </h1>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tab k="snake">Snake (Freeware)</Tab>
          <Tab k="pulse-riders">Pulse Riders</Tab>
          <Tab k="tetris">Tetris</Tab>
          <Tab k="arena">Twin-Stick Arena</Tab>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
          <div className="px-4 py-3 text-amber-300 font-semibold border-b border-slate-700">
            Top 25 - {meta.title}
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
                {isLoading && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                      Cargando tabla...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  rowsToRender.map(
                    (
                      row: {
                        _id: string;
                        userName: string;
                        userEmail: string;
                        score: number;
                        updatedAt?: number;
                      },
                      index: number
                    ) => (
                      <tr key={row._id} className="border-t border-slate-700/60">
                        <td className="px-4 py-2 text-slate-400">{index + 1}</td>
                        <td className="px-4 py-2">{row.userName}</td>
                        <td className="px-4 py-2 text-slate-300">{row.userEmail}</td>
                        <td className="px-4 py-2 font-semibold text-cyan-300">
                          {row.score}
                        </td>
                        <td className="px-4 py-2 text-slate-400">
                          {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    )
                  )}

                {!isLoading && rowsToRender.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                      Sin registros todavia.
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
