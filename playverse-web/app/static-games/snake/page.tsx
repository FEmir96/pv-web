// playverse-web/app/static-games/snake/page.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";
import Link from "next/link";

type Cell = { x: number; y: number };
type Vec = { x: number; y: number };

const GRID_W = 32;
const GRID_H = 18;
const CELL = 40;
const CANVAS_W = GRID_W * CELL; // 1280
const CANVAS_H = GRID_H * CELL; // 720

const INITIAL_LEN = 4;
const STORAGE_KEY_BASE = "snake_highscore_v1";
const SNAKE_EMBED_URL = "/static-games/snake";

type Screen = "menu" | "playing" | "over";

function randInt(max: number) { return Math.floor(Math.random() * max); }
function randomFood(exclude: Cell[]): Cell {
  while (true) {
    const c = { x: randInt(GRID_W), y: randInt(GRID_H) };
    if (!exclude.some((s) => s.x === c.x && s.y === c.y)) return c;
  }
}

export default function SnakePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const submitScore = useMutation(
    (
      (api as any)["mutations/scores/submitScore"] as {
        submitScore: FunctionReference<"mutation">;
      }
    ).submitScore
  );
  const getMyBestByGameRef = (
    (api as any)["queries/scores/getMyBestByGame"] as {
      getMyBestByGame: FunctionReference<"query">;
    }
  ).getMyBestByGame;

  const { data: session } = useSession();
  const localUser = useAuthStore((s) => s.user);
  const userEmail = (session?.user?.email || localUser?.email || "")
    .toLowerCase()
    .trim();
  const isLogged = !!userEmail;

  const storageKey = useMemo(
    () => (isLogged ? `${STORAGE_KEY_BASE}:${userEmail}` : STORAGE_KEY_BASE),
    [isLogged, userEmail]
  );

  const snakeRef = useRef<Cell[]>(
    Array.from({ length: INITIAL_LEN }).map((_, i) => ({
      x: 8 - i,
      y: Math.floor(GRID_H / 2),
    }))
  );
  const dirRef = useRef<Vec>({ x: 1, y: 0 });
  const nextDirRef = useRef<Vec>({ x: 1, y: 0 });
  const foodRef = useRef<Cell>(randomFood(snakeRef.current));
  const lastTsRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const stepMsRef = useRef<number>(120);

  const eatFxRef = useRef<{ x: number; y: number; r: number; alpha: number } | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [paused, setPaused] = useState(false);
  const submittedRef = useRef(false);

// --- HAPTICS HELPERS (Gamepad + Vibrate) ---
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const rumble = useCallback((opts?: { duration?: number; strong?: number; weak?: number }) => {
  const duration = Math.max(1, Math.floor(opts?.duration ?? 80));
  const strongMagnitude = clamp01(opts?.strong ?? 1);
  const weakMagnitude = clamp01(opts?.weak ?? 1);

  try { (navigator as any).vibrate?.(duration); } catch {}

  try {
    const pads = (navigator as any).getGamepads?.() as (Gamepad | null)[];
    if (pads && pads.length) {
      for (const p of pads) {
        if (!p) continue;
        const va: any = (p as any).vibrationActuator || (p as any).hapticActuators?.[0];
        if (!va) continue;

        if (typeof va.playEffect === "function") {
          va.playEffect("dual-rumble", {
            duration,
            strongMagnitude,
            weakMagnitude,
            startDelay: 0
          }).catch?.(() => {});
        } else if (typeof va.pulse === "function") {
          va.pulse(Math.max(strongMagnitude, weakMagnitude), duration)?.catch?.(() => {});
        }
      }
    }
  } catch {}
}, []);

// ↑↑ Dejá rumble() igual. Solo cambiamos estos presets:

// Comer: más marcado, pero corto
const rumbleEat = useCallback(() => {
  // antes: 70 ms, strong 0.25 / weak 0.9
  rumble({ duration: 120, strong: 0.6, weak: 1.0 });
}, [rumble]);

// Choque/Game Over: golpe fuerte + eco más contundente
const rumbleCrash = useCallback(() => {
  // antes: 220 ms + 120 ms suaves
  rumble({ duration: 320, strong: 1.0, weak: 1.0 });           // golpe principal
  setTimeout(() => rumble({ duration: 180, strong: 0.85, weak: 0.6 }), 180); // eco
  setTimeout(() => rumble({ duration: 90,  strong: 0.6,  weak: 0.3 }), 400); // cola corta
}, [rumble]);
// --- FIN HAPTICS ---


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
    const s = Math.min((vw - 32) / CANVAS_W, (vh - 40 - 44) / CANVAS_H, 0.96, 1);
    setScale(Math.max(0.5, s));
  }, []);
  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  // Invitado: best local
  useEffect(() => {
    if (isLogged) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setBest(raw ? parseInt(raw) || 0 : 0);
    } catch {}
  }, [isLogged, storageKey]);

  // Logueado: best desde Convex
  const myBestRow = useQuery(
    getMyBestByGameRef as any,
    isLogged ? ({ userEmail, embedUrl: SNAKE_EMBED_URL } as any) : "skip"
  ) as { score: number } | null | undefined;

  useEffect(() => {
    if (!isLogged) return;
    setBest(myBestRow?.score ?? 0);
    try {
      if (typeof myBestRow?.score === "number") {
        localStorage.setItem(storageKey, String(myBestRow.score));
      }
    } catch {}
  }, [isLogged, myBestRow?.score, storageKey]);

  const saveBestLocal = useCallback((val: number) => {
    try { localStorage.setItem(storageKey, String(val)); } catch {}
  }, [storageKey]);

  // Reset/start
  const restart = useCallback((stayPlaying = false) => {
    snakeRef.current = Array.from({ length: INITIAL_LEN }).map((_, i) => ({
      x: 8 - i,
      y: Math.floor(GRID_H / 2),
    }));
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    foodRef.current = randomFood(snakeRef.current);
    accRef.current = 0;
    stepMsRef.current = 120;
    lastTsRef.current = 0;
    eatFxRef.current = null;
    setScore(0);
    setPaused(false);
    submittedRef.current = false;
    if (!stayPlaying) setScreen("menu");
  }, []);

  const startGame = useCallback(() => { restart(true); setScreen("playing"); }, [restart]);

  // Teclado
  const applyNextDir = useCallback((nd: Vec) => {
    const cur = dirRef.current;
    if (cur.x + nd.x === 0 && cur.y + nd.y === 0) return; // evitar 180°
    nextDirRef.current = nd;
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([" ", "spacebar", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();

      if (k === "escape" && screen === "playing") { e.preventDefault(); setPaused((p) => !p); return; }
      if (screen === "menu") { if (k === "enter" || k === " " || k === "spacebar") startGame(); return; }
      if (screen === "over") {
        if (k === "r" || k === "enter" || k === " " || k === "spacebar") { restart(true); setScreen("playing"); }
        return;
      }
      if (k === " " || k === "spacebar") { setPaused((p) => !p); return; }

      if (k === "arrowup" || k === "w") applyNextDir({ x: 0, y: -1 });
      else if (k === "arrowdown" || k === "s") applyNextDir({ x: 0, y: 1 });
      else if (k === "arrowleft" || k === "a") applyNextDir({ x: -1, y: 0 });
      else if (k === "arrowright" || k === "d") applyNextDir({ x: 1, y: 0 });
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey as any);
  }, [screen, startGame, restart, applyNextDir]);

  // ---------- Integración Gamepad (Xbox/DualSense) ----------
  const prevButtonsRef = useRef<boolean[]>([]);
  const prevAxesRef = useRef<number[]>([]);
  useEffect(() => {
    let raf = 0;
    const DEAD = 0.5;

    const poll = () => {
      const pads = (navigator as any).getGamepads?.() as (Gamepad | null)[];
      const gp = pads?.find(p => p && (p.mapping === "standard" || p.mapping === "")) as Gamepad | undefined;
      if (gp) {
        const nowButtons = gp.buttons.map(b => !!b?.pressed);
        const just = (idx: number) => nowButtons[idx] && !prevButtonsRef.current[idx];

        // Start / A (Cross) para iniciar o pausar
        if (screen === "menu") {
          if (just(0) || just(9)) startGame();
        } else if (screen === "over") {
          if (just(0) || just(9)) { restart(true); setScreen("playing"); }
        } else if (screen === "playing") {
          if (just(9)) setPaused(p => !p); // Start toggle pausa

          // D-pad
          if (just(12)) applyNextDir({ x: 0, y: -1 });
          if (just(13)) applyNextDir({ x: 0, y: 1 });
          if (just(14)) applyNextDir({ x: -1, y: 0 });
          if (just(15)) applyNextDir({ x: 1, y: 0 });

          // Stick izquierdo con “edge detection”
          const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
          const pax = prevAxesRef.current[0] ?? 0, pay = prevAxesRef.current[1] ?? 0;
          const horNow = ax <= -DEAD ? -1 : ax >= DEAD ? 1 : 0;
          const verNow = ay <= -DEAD ? -1 : ay >= DEAD ? 1 : 0;
          const horPrev = pax <= -DEAD ? -1 : pax >= DEAD ? 1 : 0;
          const verPrev = pay <= -DEAD ? -1 : pay >= DEAD ? 1 : 0;

          if (horNow !== 0 && horPrev === 0) applyNextDir({ x: horNow, y: 0 });
          if (verNow !== 0 && verPrev === 0) applyNextDir({ x: 0, y: verNow });

          prevAxesRef.current = [ax, ay];
        }

        prevButtonsRef.current = nowButtons;
      }

      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [screen, startGame, restart, applyNextDir]);
  // ---------- Fin Integración Gamepad ----------

  // Step
  const step = useCallback(() => {
    const snake = snakeRef.current.slice();
    const dir = nextDirRef.current;
    dirRef.current = dir;

    const head = snake[0];
    const next: Cell = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.x >= GRID_W || next.y < 0 || next.y >= GRID_H) { rumbleCrash(); setScreen("over"); return; }
    if (snake.some((s) => s.x === next.x && s.y === next.y)) { rumbleCrash(); setScreen("over"); return; }

    snake.unshift(next);

    if (next.x === foodRef.current.x && next.y === foodRef.current.y) {
      const ns = score + 1; setScore(ns);
      if (ns % 4 === 0) stepMsRef.current = Math.max(70, stepMsRef.current - 5);
      eatFxRef.current = { x: next.x, y: next.y, r: 0, alpha: 1 };
      foodRef.current = randomFood(snake);
      if (ns > best) { setBest(ns); saveBestLocal(ns); }
      rumbleEat(); // vibración al comer
    } else {
      snake.pop();
    }
    snakeRef.current = snake;
  }, [best, saveBestLocal, score, rumbleCrash, rumbleEat]);

  // Draw
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = "rgba(148,163,184,0.08)"; ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, CANVAS_H); ctx.stroke(); }
    for (let y = 0; y <= GRID_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(CANVAS_W, y * CELL + 0.5); ctx.stroke(); }

    const f = foodRef.current;
    ctx.save(); ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 16; ctx.fillStyle = "#f59e0b";
    ctx.fillRect(f.x * CELL + 6, f.y * CELL + 6, CELL - 12, CELL - 12); ctx.restore();

    const s = snakeRef.current;
    ctx.save(); ctx.shadowColor = "rgba(34,211,238,0.95)";
    s.forEach((c, i) => {
      const alpha = i === 0 ? 1 : Math.max(0.7, 1 - i * 0.02);
      ctx.shadowBlur = i === 0 ? 28 : 14;
      ctx.fillStyle = `rgba(34,211,238,${alpha})`;
      ctx.fillRect(c.x * CELL + 4, c.y * CELL + 4, CELL - 8, CELL - 8);
    });
    ctx.restore();

    if (screen === "playing") {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText(`Score: ${score}`, 16, 28);
      ctx.fillText(`Best: ${best}`, 140, 28);
    }

    if (screen === "menu") {
      ctx.fillStyle = "rgba(2,6,23,0.55)"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#f8fafc"; ctx.font = "bold 54px ui-sans-serif, system-ui";
      ctx.fillText("SNAKE", CANVAS_W / 2 - 100, CANVAS_H / 2 - 40);
      ctx.font = "20px ui-sans-serif, system-ui"; ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Flechas/WASD para moverte", CANVAS_W / 2 - 150, CANVAS_H / 2 + 10);
      ctx.fillText("Espacio / ESC = Pausa", CANVAS_W / 2 - 120, CANVAS_H / 2 + 40);
      ctx.font = "bold 24px ui-sans-serif, system-ui"; ctx.fillStyle = "#fbbf24";
      ctx.fillText("ENTER o ESPACIO para JUGAR", CANVAS_W / 2 - 190, CANVAS_H / 2 + 90);
    }

    if (screen === "over") {
      ctx.fillStyle = "rgba(2,6,23,0.65)"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#f8fafc"; ctx.font = "bold 48px ui-sans-serif, system-ui";
      ctx.fillText("GAME OVER", CANVAS_W / 2 - 140, CANVAS_H / 2 - 10);
      ctx.font = "24px ui-sans-serif, system-ui";
      ctx.fillText("Presiona ENTER o R para reiniciar", CANVAS_W / 2 - 200, CANVAS_H / 2 + 28);
    }

    const fx = eatFxRef.current;
    if (fx && fx.alpha > 0) {
      const cx = fx.x * CELL + CELL / 2, cy = fx.y * CELL + CELL / 2;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, Math.min(1, fx.alpha));
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, fx.r, 0, Math.PI * 2); ctx.stroke();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, fx.r + 30);
      g.addColorStop(0, "rgba(245,158,11,0.35)"); g.addColorStop(1, "rgba(245,158,11,0.0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, fx.r + 30, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, [best, screen, score]);

  // Loop
  useEffect(() => {
    let rafId = 0;
    const tick = (ts: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) { rafId = requestAnimationFrame(tick); return; }

      if (screen === "playing" && !paused) {
        if (lastTsRef.current === 0) lastTsRef.current = ts;
        const dt = ts - lastTsRef.current; lastTsRef.current = ts; accRef.current += dt;

        const stepMs = stepMsRef.current;
        while (accRef.current >= stepMs) { step(); accRef.current -= stepMs; }

        const fx = eatFxRef.current;
        if (fx) { fx.r += dt * 0.45; fx.alpha -= dt / 520; if (fx.alpha <= 0) eatFxRef.current = null; }
      } else { lastTsRef.current = 0; accRef.current = 0; }

      draw(ctx);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [draw, paused, screen, step]);

  // Submit score
  useEffect(() => {
    if (screen !== "over" || !isLogged || submittedRef.current) return;
    submittedRef.current = true;
    (async () => {
      try {
        const res = (await submitScore({ score, embedUrl: SNAKE_EMBED_URL, userEmail })) as any;
        if (res && typeof res.best === "number") { setBest(res.best); saveBestLocal(res.best); }
      } catch (e) {
        console.error("submitScore error:", e);
        submittedRef.current = false;
      }
    })();
  }, [screen, score, isLogged, submitScore, userEmail, saveBestLocal]);

  return (
    <main className="min-h-screen bg-slate-900 overflow-hidden flex flex-col items-center justify-start">
      {/* Canvas */}
      <div
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "center", willChange: "transform" }}
        className="shadow-xl ring-1 ring-slate-700 rounded-lg"
        aria-label="Snake game board"
        role="img"
      >
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="rounded-lg block" />
      </div>

      <div className="mt-3 text-slate-300 text-xs sm:text-sm bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700">
        {screen === "menu"
          ? "ENTER/ESPACIO para empezar"
          : "Controles: Flechas / WASD · Espacio / ESC = Pausa · R/ENTER = Reiniciar"}
      </div>
    </main>
  );
}
