// playverse-web/components/CoverBox.tsx
"use client";

import { useMemo, useRef, useState, useCallback } from "react";

type CoverBoxProps = {
  src?: string | null;
  alt?: string;
  /** Proporción del box: "16/9" | "2/3" | "1/1" | "3/4" ...  */
  ratio?: string;
  /**
   * "contain" (no recorta) | "cover" (recorta para llenar) | "smart"
   * - smart intenta evitar bandas automáticamente (por defecto).
   */
  fit?: "contain" | "cover" | "smart";
  /** Zoom sutil para esconder bordes blancos/transparencias del asset */
  bleed?: number; // 0.0 - 0.5 (default 0.08 => 8% de zoom)
  /** Marca el box como clickeable (puntero) */
  clickable?: boolean;
  className?: string;
};

/* ---------------- helpers ---------------- */
function parseRatio(ratio: string | undefined): number {
  if (!ratio) return 16 / 9;
  const m = ratio.split("/");
  const w = Number(m[0]);
  const h = Number(m[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return 16 / 9;
  return w / h;
}

export function CoverBox({
  src,
  alt = "Cover",
  ratio = "16/9",
  fit = "smart",
  bleed = 0.08,
  clickable = false,
  className = "",
}: CoverBoxProps) {
  const safe = src || "/placeholder.svg";
  const boxRatio = useMemo(() => parseRatio(ratio), [ratio]);

  // Cuando fit === "smart", elegimos en runtime si usar cover/contain
  const [smartFit, setSmartFit] = useState<"cover" | "contain">("cover");
  const decidedFit = fit === "smart" ? smartFit : fit;

  const onImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (fit !== "smart") return;
      const img = e.currentTarget;
      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      const imgRatio = iw / ih;

      // si la diferencia de ratios es notable, conviene "cover" para evitar bandas
      const diff = Math.abs(imgRatio - boxRatio) / boxRatio; // porcentaje de diferencia
      const shouldCover = diff > 0.03; // ~3% de tolerancia
      setSmartFit(shouldCover ? "cover" : "contain");
    },
    [fit, boxRatio]
  );

  // aseguramos bleed en [0..0.5]
  const bleedClamped = Math.max(0, Math.min(bleed ?? 0, 0.5));
  const scale = 1 + bleedClamped;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 ${
        clickable ? "cursor-pointer" : ""
      } ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {/* Fondo borroso que SIEMPRE cubre completo (no se ven bandas) */}
      <img
        src={safe}
        alt=""
        aria-hidden
        draggable={false}
        className="
          absolute inset-0 h-full w-full object-cover
          blur-xl scale-110 opacity-60
          will-change-transform
          pointer-events-none
        "
      />

      {/* Overlay sutil para integrar con el tema */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10 pointer-events-none" />

      {/* Imagen principal (smart/cover/contain) */}
      <img
        src={safe}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={onImgLoad}
        className={`
          absolute inset-0 h-full w-full
          ${decidedFit === "cover" ? "object-cover" : "object-contain"}
          will-change-transform
          pointer-events-none
          [backface-visibility:hidden]
        `}
        style={{
          transform: decidedFit === "cover" ? `scale(${scale})` : undefined,
          transformOrigin: "50% 50%",
        }}
      />
    </div>
  );
}
