// playverse-web/app/leaderboard/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";

// 👇 URL del Tetris hosteado en Vercel (de .env)
const TETRIS_URL = process.env.NEXT_PUBLIC_TETRIS_URL || "";
// 👇 URL del Arena (si lo servís fuera o querés forzar absoluta). Si no, cae a /arena
const ARENA_URL  = process.env.NEXT_PUBLIC_ARENA_URL  || "";

type GameKey = "snake" | "pulse-riders" | "tetris" | "arena";

const GAME_META: Record<GameKey, { title: string; embedUrl: string }> = {
  snake:          { title: "Snake (Freeware)",   embedUrl: "/static-games/snake" },
  "pulse-riders": { title: "Pulse Riders",       embedUrl: "/static-games/pulse-riders" },
  tetris:         { title: "Tetris (PlayVerse)", embedUrl: TETRIS_URL || "/tetris" },
  // 👉 por defecto apuntamos a /arena (tu ruta real en app/arena/page.tsx)
  //    Si en tu DB quedó /static-games/arena, abajo tenemos fallbacks para ambas.
  arena:          { title: "Twin-Stick Arena",   embedUrl: ARENA_URL || "/arena" },
};

// ✅ Query: top de scores
const topByGameRef = (
  (api as any)["queries/scores/topByGame"] as { topByGame: FunctionReference<"query"> }
).topByGame;

// ✅ Query: resolver id del juego por embedUrl (para armar /play/[id])
const getIdByEmbedUrlRef = (
  (api as any)["queries/games/getIdByEmbedUrl"] as { getIdByEmbedUrl: FunctionReference<"query"> }
).getIdByEmbedUrl;

export default function LeaderboardPage() {
  const params = useSearchParams();
  const router = useRouter();

  const gameParam = (params.get("game") || "") as GameKey;
  const selected: GameKey = ["snake", "pulse-riders", "tetris", "arena"].includes(gameParam)
    ? gameParam
    : "snake";

  const meta = GAME_META[selected];

  // ---------- Fallbacks de rutas ----------
  // TETRIS: absoluta (env) + relativa (/tetris)
  const tetrisAbs = GAME_META.tetris.embedUrl; // puede estar vacío si falta el .env
  let tetrisRel = "/tetris";
  try {
    if (tetrisAbs) {
      const u = new URL(tetrisAbs, "https://example.org");
      tetrisRel = u.pathname || "/tetris";
    }
  } catch {}

  // ARENA: absoluta (env) ó relativa principal (usamos pathname) + fallback /arena + /static-games/arena
  const arenaAbs = GAME_META.arena.embedUrl || "";
  let arenaMain = "/arena";
  try {
    if (arenaAbs) {
      const u = new URL(arenaAbs, "https://example.org");
      arenaMain = u.pathname || "/arena";
    }
  } catch {}
  const arenaStatic = "/static-games/arena";

  // ---------- TOP SCORES ----------
  const rowsPrimary = useQuery(
    topByGameRef as any,
    { embedUrl: meta.embedUrl, limit: 25 } as any
  ) as Array<{ _id: string; userName: string; userEmail: string; score: number; updatedAt?: number }> | undefined;

  const rowsTetrisFallback = useQuery(
    topByGameRef as any,
    { embedUrl: tetrisRel, limit: 25 } as any
  ) as Array<{ _id: string; userName: string; userEmail: string; score: number; updatedAt?: number }> | undefined;

  // Fallbacks de Arena: prueba principal (arenaMain) y la estática
  const rowsArenaMain = useQuery(
    topByGameRef as any,
    { embedUrl: arenaMain, limit: 25 } as any
  ) as Array<{ _id: string; userName: string; userEmail: string; score: number; updatedAt?: number }> | undefined;

  const rowsArenaStatic = useQuery(
    topByGameRef as any,
    { embedUrl: arenaStatic, limit: 25 } as any
  ) as Array<{ _id: string; userName: string; userEmail: string; score: number; updatedAt?: number }> | undefined;

  const rows =
    selected === "tetris"
      ? (rowsPrimary && rowsPrimary.length > 0 ? rowsPrimary : rowsTetrisFallback)
      : selected === "arena"
      ? // 👇 Arena: elegimos el primero que tenga datos
        (rowsPrimary && rowsPrimary.length > 0
          ? rowsPrimary
          : rowsArenaMain && rowsArenaMain.length > 0
          ? rowsArenaMain
          : rowsArenaStatic)
      : rowsPrimary;

  // ---------- RESOLVER /play/[id] ----------
  const selectedInfoPrimary = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: meta.embedUrl } as any
  ) as { id: string; title: string; embedUrl: string } | null | undefined;

  // Tetris fallbacks
  const tetrisInfoAbs = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: tetrisAbs } as any
  ) as { id: string } | null | undefined;

  const tetrisInfoRel = useQuery(
    getIdByEmbedUrlRef as any,
    { embedUrl: tetrisRel } as any
  ) as { id: string } | null | undefined;

  // Arena fallbacks
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
      ? (tetrisInfoAbs ?? tetrisInfoRel ?? selectedInfoPrimary)
      : selected === "arena"
      ? (selectedInfoPrimary ?? arenaInfoMain ?? arenaInfoStaticQ)
      : selectedInfoPrimary;

  // Enlaces directos extra (para ver estado de todos)
  const snakeInfo = useQuery(getIdByEmbedUrlRef as any, { embedUrl: GAME_META.snake.embedUrl } as any) as { id: string } | null | undefined;
  const prInfo    = useQuery(getIdByEmbedUrlRef as any, { embedUrl: GAME_META["pulse-riders"].embedUrl } as any) as { id: string } | null | undefined;
  const arenaInfo = useQuery(getIdByEmbedUrlRef as any, { embedUrl: GAME_META.arena.embedUrl } as any) as { id: string } | null | undefined;

  const playHrefSelected = selectedInfo?.id ? `/play/${selectedInfo.id}` : undefined;
  const playHrefSnake    = snakeInfo?.id ? `/play/${snakeInfo.id}` : undefined;
  const playHrefPR       = prInfo?.id ? `/play/${prInfo.id}` : undefined;
  const playHrefArena    = (arenaInfo?.id || arenaInfoMain?.id || arenaInfoStaticQ?.id)
    ? `/play/${(arenaInfo?.id || arenaInfoMain?.id || arenaInfoStaticQ?.id)!}`
    : undefined;
  const playHrefTetris   = (tetrisInfoAbs ?? tetrisInfoRel)?.id ? `/play/${(tetrisInfoAbs ?? tetrisInfoRel)!.id}` : undefined;

  const when = (t?: number) => (t ? new Date(t).toLocaleString() : "-");

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

  // Qué string mostrar al costado del tab (útil para debug)
  const debugPath =
    selected === "tetris"
      ? (tetrisInfoAbs?.id ? tetrisAbs : tetrisRel)
      : selected === "arena"
      ? (arenaInfo?.id
          ? GAME_META.arena.embedUrl
          : arenaInfoMain?.id
          ? arenaMain
          : arenaStatic)
      : meta.embedUrl;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-12">
        {/* Título + CTA */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-400 drop-shadow-sm">
            Leaderboard
          </h1>

          {/* CTA → /play/[id] del juego seleccionado */}
          {playHrefSelected ? (
            <Link
              href={playHrefSelected}
              className="inline-flex items-center rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-4 py-2 shadow ring-1 ring-amber-300/40 transition"
            >
              Jugar {meta.title}
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-700 text-slate-300 px-4 py-2 text-sm">
              Resolviendo acceso…
            </span>
          )}
        </div>

        {/* Tabs de juego */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tab k="snake">Snake (Freeware)</Tab>
          <Tab k="pulse-riders">Pulse Riders</Tab>
          <Tab k="tetris">Tetris</Tab>
          <Tab k="arena">Twin-Stick Arena</Tab>

          {/* Muestra del destino al costado (para ver qué ruta está usando) */}
          <span className="ml-2 text-xs text-slate-400 hidden sm:inline">
            {playHrefSelected ? playHrefSelected : debugPath}
          </span>
          <span className="ml-auto text-xs text-slate-400">
            Fuente: Convex · query <code>scores/topByGame</code>
          </span>
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
                {(rows ?? []).map((r, i) => (
                  <tr key={r._id} className="border-t border-slate-700/60">
                    <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2">{r.userName}</td>
                    <td className="px-4 py-2 text-slate-300">{r.userEmail}</td>
                    <td className="px-4 py-2 font-semibold text-cyan-300">{r.score}</td>
                    <td className="px-4 py-2 text-slate-400">{when(r.updatedAt)}</td>
                  </tr>
                ))}
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

          {/* Enlaces directos → /play/[id] */}
          <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-700/60">
            Enlaces directos:&nbsp;
            {playHrefSnake ? (
              <Link href={playHrefSnake} className="underline decoration-slate-600 hover:text-slate-300">
                {playHrefSnake}
              </Link>
            ) : (
              <span className="opacity-60">/play/[id] (Snake)</span>
            )}
            &nbsp;·&nbsp;
            {playHrefPR ? (
              <Link href={playHrefPR} className="underline decoration-slate-600 hover:text-slate-300">
                {playHrefPR}
              </Link>
            ) : (
              <span className="opacity-60">/play/[id] (Pulse Riders)</span>
            )}
            &nbsp;·&nbsp;
            {playHrefTetris ? (
              <Link href={playHrefTetris} className="underline decoration-slate-600 hover:text-slate-300">
                {playHrefTetris}
              </Link>
            ) : (
              <span className="opacity-60">/play/[id] (Tetris)</span>
            )}
            &nbsp;·&nbsp;
            {playHrefArena ? (
              <Link href={playHrefArena} className="underline decoration-slate-600 hover:text-slate-300">
                {playHrefArena}
              </Link>
            ) : (
              <span className="opacity-60">/play/[id] (Arena)</span>
            )}
            &nbsp;· Tamaño: &amp;limit=25.
          </div>
        </div>
      </div>
    </main>
  );
}
