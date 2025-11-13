// playverse-web/app/static-games/pulse-riders/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";
import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useGamepad } from "@/lib/useGamepad"; // 👈 soporte mando

type Vec = { x: number; y: number };
type Cell = { x: number; y: number };

const GRID_W = 40;
const GRID_H = 22;
const CELL = 30;
const CANVAS_W = GRID_W * CELL; // 1200
const CANVAS_H = GRID_H * CELL; //  660

const STORAGE_KEY_BASE = "pulse_riders_best_v1";
const EMBED_URL = "/static-games/pulse-riders";

type Screen = "menu" | "playing" | "over";
type Difficulty = "easy" | "normal" | "hard";

const DIRS: Record<string, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function inBounds(x: number, y: number) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}
function makeGrid(): number[][] {
  return Array.from({ length: GRID_H }, () => Array<number>(GRID_W).fill(0));
}

export default function PulseRidersPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Convex mutation (FunctionReference puro por path string)
  const submitScore = useMutation(
    (
      (api as any)["mutations/scores/submitScore"] as {
        submitScore: FunctionReference<"mutation">;
      }
    ).submitScore
  );

  // Usuario
  const { data: session } = useSession();
  const localUser = useAuthStore((s) => s.user);
  const userEmail = (session?.user?.email || localUser?.email || "")
    .toLowerCase()
    .trim();

  // Best local por usuario
  const storageKey = useMemo(
    () => (userEmail ? `${STORAGE_KEY_BASE}:${userEmail}` : STORAGE_KEY_BASE),
    [userEmail]
  );

  // Estado del juego
  const gridRef = useRef<number[][]>(makeGrid());
  const pPosRef = useRef<Cell>({ x: 4, y: Math.floor(GRID_H / 2) });
  const aPosRef = useRef<Cell>({ x: GRID_W - 5, y: Math.floor(GRID_H / 2) });
  const pDirRef = useRef<Vec>(DIRS.right);
  const aDirRef = useRef<Vec>(DIRS.left);

  const lastTsRef = useRef(0);
  const accRef = useRef(0);
  const stepMsRef = useRef(110);

  // UI
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [winner, setWinner] = useState<"player" | "ai" | "crash" | null>(null);

  // FX victoria
  const fxRef = useRef<{ x: number; y: number; r: number; alpha: number } | null>(null);

  // Evitar scroll
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Escala responsiva
  const [scale, setScale] = useState(1);
  const updateScale = useCallback(() => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const PADX = 28, PADY = 36, FOOT = 46;
    const s = Math.min((vw - PADX) / CANVAS_W, (vh - PADY - FOOT) / CANVAS_H, 0.96, 1);
    setScale(Math.max(0.6, s));
  }, []);
  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  // Best local
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setBest((b) => Math.max(b, parseInt(raw) || 0));
    } catch {}
  }, [storageKey]);
  const saveBest = useCallback((val: number) => {
    try { localStorage.setItem(storageKey, String(val)); } catch {}
  }, [storageKey]);

  // Reset
  const reset = useCallback(() => {
    gridRef.current = makeGrid();
    pPosRef.current = { x: 4, y: Math.floor(GRID_H / 2) };
    aPosRef.current = { x: GRID_W - 5, y: Math.floor(GRID_H / 2) };
    pDirRef.current = DIRS.right;
    aDirRef.current = DIRS.left;
    lastTsRef.current = 0;
    accRef.current = 0;
    fxRef.current = null;
    setScore(0);
    setPaused(false);
    setWinner(null);
    stepMsRef.current = difficulty === "easy" ? 130 : difficulty === "hard" ? 90 : 110;
  }, [difficulty]);

  const startGame = useCallback(() => {
    reset();
    setScreen("playing");
  }, [reset]);

  // 🔸 Gamepad: mapea direcciones, start/pause
  const { rumble } = useGamepad((ev) => {
    if (screen === "menu" && ev.start) { startGame(); return; }
    if (screen === "over" && ev.start) { startGame(); return; }
    if (screen === "playing" && ev.pause) { setPaused((p) => !p); return; }

    const cur = pDirRef.current;
    let nd = cur;
    if (ev.up) nd = DIRS.up;
    else if (ev.down) nd = DIRS.down;
    else if (ev.left) nd = DIRS.left;
    else if (ev.right) nd = DIRS.right;
    if (cur.x + nd.x === 0 && cur.y + nd.y === 0) return; // no 180°
    pDirRef.current = nd;
  });

  // Input teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([" ", "spacebar", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === "escape" && screen === "playing") { setPaused((p) => !p); return; }

      if (screen === "menu") { if (k === "enter") startGame(); return; }
      if (screen === "over") { if (k === "enter" || k === "r") startGame(); return; }
      if (k === " " || k === "spacebar") { setPaused((p) => !p); return; }

      const cur = pDirRef.current;
      let nd = cur;
      if (k === "arrowup" || k === "w") nd = DIRS.up;
      else if (k === "arrowdown" || k === "s") nd = DIRS.down;
      else if (k === "arrowleft" || k === "a") nd = DIRS.left;
      else if (k === "arrowright" || k === "d") nd = DIRS.right;
      if (cur.x + nd.x === 0 && cur.y + nd.y === 0) return; // no 180°
      pDirRef.current = nd;
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey as any);
  }, [screen, startGame]);

  // IA (elige pasillo más largo)
  const chooseAIDir = useCallback(() => {
    const head = aPosRef.current;
    const grid = gridRef.current;
    const options = [DIRS.left, DIRS.right, DIRS.up, DIRS.down];

    function scoreDir(d: Vec) {
      let steps = 0; let x = head.x, y = head.y;
      while (true) {
        x += d.x; y += d.y;
        if (!inBounds(x, y) || grid[y][x] !== 0) break;
        steps++;
      }
      return steps;
    }

    const cur = aDirRef.current;
    let bestD = cur, bestScore = -1;
    for (const d of options) {
      if (cur.x + d.x === 0 && cur.y + d.y === 0) continue;
      const s = scoreDir(d);
      if (s > bestScore) { bestScore = s; bestD = d; }
    }
    aDirRef.current = bestD;
  }, []);

  // Step
  const step = useCallback(() => {
    const grid = gridRef.current;
    chooseAIDir();

    const pd = pDirRef.current;
    let px = pPosRef.current.x + pd.x;
    let py = pPosRef.current.y + pd.y;

    const ad = aDirRef.current;
    let ax = aPosRef.current.x + ad.x;
    let ay = aPosRef.current.y + ad.y;

    const pCrash = !inBounds(px, py) || grid[py][px] !== 0;
    const aCrash = !inBounds(ax, ay) || grid[ay][ax] !== 0;

    if (pCrash && aCrash) { setWinner("crash"); setScreen("over"); rumble(180, 0.6, 0.9); return; }
    if (pCrash) { setWinner("ai"); setScreen("over"); rumble(220, 0.4, 1.0); return; }
    if (aCrash) { setWinner("player"); setScreen("over"); fxRef.current = { x: ax, y: ay, r: 0, alpha: 1 }; rumble(160, 0.2, 0.7); return; }

    grid[pPosRef.current.y][pPosRef.current.x] = 1; // trail player
    grid[aPosRef.current.y][aPosRef.current.x] = 2; // trail AI
    pPosRef.current = { x: px, y: py };
    aPosRef.current = { x: ax, y: ay };

    setScore((s) => {
      const ns = s + 1;
      if (ns % 10 === 0) stepMsRef.current = Math.max(70, stepMsRef.current - 2);
      if (ns > best) { setBest(ns); saveBest(ns); }
      return ns;
    });
  }, [best, saveBest, chooseAIDir, rumble]);

  // Draw
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, CANVAS_H); ctx.stroke(); }
    for (let y = 0; y <= GRID_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(CANVAS_W, y * CELL + 0.5); ctx.stroke(); }

    const grid = gridRef.current;
    ctx.save();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (grid[y][x] === 1) {
          ctx.shadowColor = "rgba(34,211,238,0.9)"; ctx.shadowBlur = 16; ctx.fillStyle = "rgba(34,211,238,0.95)";
          ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        } else if (grid[y][x] === 2) {
          ctx.shadowColor = "rgba(245,158,11,0.9)"; ctx.shadowBlur = 16; ctx.fillStyle = "rgba(245,158,11,0.95)";
          ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }
    ctx.restore();

    const p = pPosRef.current;
    const a = aPosRef.current;
    ctx.save();
    ctx.shadowColor = "rgba(34,211,238,1)"; ctx.shadowBlur = 28; ctx.fillStyle = "#22d3ee";
    ctx.fillRect(p.x * CELL + 3, p.y * CELL + 3, CELL - 6, CELL - 6);
    ctx.shadowColor = "rgba(245,158,11,1)"; ctx.shadowBlur = 28; ctx.fillStyle = "#f59e0b";
    ctx.fillRect(a.x * CELL + 3, a.y * CELL + 3, CELL - 6, CELL - 6);
    ctx.restore();

    if (screen === "playing") {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText(`Score: ${score}`, 12, 24);
      ctx.fillText(`Best: ${best}`, 120, 24);
      ctx.fillText(`Dificultad: ${difficulty}`, 220, 24);
    }

    if (screen === "menu") {
      ctx.fillStyle = "rgba(2,6,23,0.55)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 48px ui-sans-serif, system-ui";
      ctx.fillText("PULSE RIDERS", CANVAS_W / 2 - 180, CANVAS_H / 2 - 30);
      ctx.font = "20px ui-sans-serif, system-ui";
      ctx.fillText("Flechas/WASD para girar · Espacio/ESC = Pausa", CANVAS_W / 2 - 230, CANVAS_H / 2 + 8);
      ctx.fillText("ENTER para jugar", CANVAS_W / 2 - 80, CANVAS_H / 2 + 40);
      ctx.fillText(`Dificultad seleccionada: ${difficulty.toUpperCase()}`, CANVAS_W / 2 - 150, CANVAS_H / 2 + 70);
    }

    if (screen === "over") {
      ctx.fillStyle = "rgba(2,6,23,0.65)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 44px ui-sans-serif, system-ui";
      const wtxt = winner === "player" ? "¡Ganaste!" : winner === "ai" ? "Derrota..." : "Choque mutuo";
      ctx.fillText(wtxt, CANVAS_W / 2 - 110, CANVAS_H / 2 - 10);
      ctx.font = "22px ui-sans-serif, system-ui";
      ctx.fillText("ENTER o R para reiniciar", CANVAS_W / 2 - 130, CANVAS_H / 2 + 26);
    }

    const fx = fxRef.current;
    if (fx && fx.alpha > 0) {
      const cx = fx.x * CELL + CELL / 2;
      const cy = fx.y * CELL + CELL / 2;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, Math.min(1, fx.alpha));
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, fx.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [best, difficulty, screen, score, winner]);

  // Loop
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) { raf = requestAnimationFrame(tick); return; }

      if (screen === "playing" && !paused) {
        if (lastTsRef.current === 0) lastTsRef.current = ts;
        const dt = ts - lastTsRef.current;
        lastTsRef.current = ts;
        accRef.current += dt;

        const fx = fxRef.current;
        if (fx) { fx.r += dt * 0.5; fx.alpha -= dt / 600; if (fx.alpha <= 0) fxRef.current = null; }

        const stepMs = stepMsRef.current;
        while (accRef.current >= stepMs) { step(); accRef.current -= stepMs; }
      } else {
        lastTsRef.current = 0;
        accRef.current = 0;
      }

      draw(ctx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, paused, screen, step]);

  // Submit score
  const submittedOnce = useRef(false);
  useEffect(() => {
    if (screen !== "over" || !userEmail) return;
    if (submittedOnce.current) return;
    submittedOnce.current = true;
    (async () => {
      try { await submitScore({ score, embedUrl: EMBED_URL, userEmail }); }
      catch (e) { console.error("submitScore error", e); submittedOnce.current = false; }
    })();
  }, [screen, score, submitScore, userEmail]);

  // UI
  return (
    <main className="min-h-screen bg-slate-900 overflow-hidden flex flex-col items-center justify-start">


      {/* Canvas */}
      <div
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "center", willChange: "transform" }}
        className="shadow-xl ring-1 ring-slate-700 rounded-lg relative"
      >
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="rounded-lg block" />
        {screen === "menu" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-slate-800/70 border border-slate-700 rounded-md px-3 py-2 text-slate-200">
            <button onClick={() => setDifficulty("easy")}   className={`px-3 py-1 rounded ${difficulty==="easy"?"bg-cyan-500 text-slate-900":"bg-slate-700 hover:bg-slate-600"}`}>Fácil</button>
            <button onClick={() => setDifficulty("normal")} className={`px-3 py-1 rounded ${difficulty==="normal"?"bg-cyan-500 text-slate-900":"bg-slate-700 hover:bg-slate-600"}`}>Normal</button>
            <button onClick={() => setDifficulty("hard")}   className={`px-3 py-1 rounded ${difficulty==="hard"?"bg-cyan-500 text-slate-900":"bg-slate-700 hover:bg-slate-600"}`}>Difícil</button>
            <button onClick={() => startGame()} className="ml-2 px-4 py-1 rounded bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300">Nuevo juego</button>
          </div>
        )}
      </div>

      {/* Tip inferior */}
      <div className="mt-3 text-slate-300 text-xs sm:text-sm bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700">
        {screen === "menu"
          ? "ENTER para empezar · Elegí la dificultad abajo"
          : "Controles: Flechas / WASD · Espacio/ESC = Pausa · ENTER/R = Reiniciar"}
      </div>
    </main>
  );
}
