// playverse-web/lib/useGamepad.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GpEvent = {
  start?: boolean;   // Start / A (Cross) para iniciar
  pause?: boolean;   // Back/Select / B (Circle) para pausar
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
};

const BTN = { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, SELECT:8, START:9,
              LS:10, RS:11, D_UP:12, D_DOWN:13, D_LEFT:14, D_RIGHT:15, HOME:16 };

const DEADZONE = 0.28; // evita falsos positivos en sticks

export function useGamepad(onButtons: (e: GpEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const gpIndexRef = useRef<number | null>(null);
  const prevButtonsRef = useRef<number[]>([]);
  const prevAxesRef = useRef<number[]>([]);

  // conectar/desconectar
  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      gpIndexRef.current = e.gamepad.index;
      setConnected(true);
      setId(e.gamepad.id || "Gamepad");
    };
    const onDisconnect = (e: GamepadEvent) => {
      if (gpIndexRef.current === e.gamepad.index) {
        gpIndexRef.current = null;
        setConnected(false);
        setId(null);
      }
    };
    window.addEventListener("gamepadconnected", onConnect as any);
    window.addEventListener("gamepaddisconnected", onDisconnect as any);
    return () => {
      window.removeEventListener("gamepadconnected", onConnect as any);
      window.removeEventListener("gamepaddisconnected", onDisconnect as any);
    };
  }, []);

  // poll por frame
  const poll = useCallback(() => {
    const list = navigator.getGamepads?.();
    if (!list) return;

    let gp = gpIndexRef.current != null ? list[gpIndexRef.current] : null;
    if (!gp) {
      // algunos browsers no disparan el evento hasta que tocas algo
      for (const g of list) { if (g) { gp = g; gpIndexRef.current = g.index; break; } }
      if (!gp) return;
      setConnected(true);
      setId(gp.id || "Gamepad");
    }

    const b = gp.buttons.map(x => Number(x.pressed));
    const a = gp.axes.slice();

    const wasPressed = (i:number) => !!b[i] && !prevButtonsRef.current[i];
    const axisEdge = (ix:number, neg:boolean) => {
      const v = a[ix] ?? 0, pv = prevAxesRef.current[ix] ?? 0;
      const now = neg ? v < -DEADZONE : v > DEADZONE;
      const prev = neg ? pv < -DEADZONE : pv > DEADZONE;
      return now && !prev;
    };

    const ev: GpEvent = {
      start: wasPressed(BTN.START) || wasPressed(BTN.A),
      pause: wasPressed(BTN.SELECT) || wasPressed(BTN.B),
      up:    wasPressed(BTN.D_UP)    || axisEdge(1, true),
      down:  wasPressed(BTN.D_DOWN)  || axisEdge(1, false),
      left:  wasPressed(BTN.D_LEFT)  || axisEdge(0, true),
      right: wasPressed(BTN.D_RIGHT) || axisEdge(0, false),
    };

    if (ev.start || ev.pause || ev.up || ev.down || ev.left || ev.right) {
      onButtons(ev);
    }

    prevButtonsRef.current = b;
    prevAxesRef.current = a;
  }, [onButtons]);

  useEffect(() => {
    let raf = 0;
    const loop = () => { poll(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [poll]);

  // helper de vibración (si existe)
  const rumble = useCallback(async (ms = 120, weak = 0.4, strong = 0.8) => {
    const idx = gpIndexRef.current;
    if (idx == null) return;
    const gp = navigator.getGamepads?.()[idx];
    const va: any = (gp as any)?.vibrationActuator;
    if (va?.playEffect) {
      try { await va.playEffect("dual-rumble", { duration: ms, weakMagnitude: weak, strongMagnitude: strong }); } catch {}
    }
  }, []);

  return { connected, id, rumble };
}
