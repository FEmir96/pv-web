"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import VideoModal from "./video-modal";

type Props = {
  title: string;
  coverUrl?: string | null;
  trailerUrl?: string | null;   // <- viene de games.trailer_url
  genreLabel?: string;
};

type Media =
  | { kind: "image"; src: string }
  | { kind: "video"; thumb: string; src: string };

const nonEmpty = (s?: string | null) => Boolean(s && String(s).trim());

/** Normaliza URLs de trailers:
 * - Quita comillas sobrantes
 * - YouTube watch/youtu.be -> embed
 * - Vimeo -> player
 * - Deja cualquier otra URL tal cual
 */
function normalizeTrailerUrl(input?: string | null): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  // a veces queda guardado con comillas:  "\"https://...\""
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1).trim();

  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      return raw;
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\/+/, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
      return raw;
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
      return raw;
    }

    // si ya es /embed/ o es otro host, lo dejamos
    return raw;
  } catch {
    // si no parsea como URL, lo devolvemos crudo
    return raw;
  }
}

export default function GameMediaGallery({ title, coverUrl, trailerUrl, genreLabel }: Props) {
  const [shots, setShots] = useState<string[]>([]);
  const [igdbVideo, setIgdbVideo] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [openVideo, setOpenVideo] = useState(false);

  // Action IGDB (resolución robusta)
  const getIGDBScreenshots =
    (useAction as any)(
      (api as any)?.actions?.getIGDBScreenshots?.getIGDBScreenshots ??
        (api as any)?.actions?.getIGDBScreenshots ??
        (api as any)?.getIGDBScreenshots?.getIGDBScreenshots ??
        (api as any)?.getIGDBScreenshots
    ) || null;

  // Póster del video: cover o primera screenshot
  const videoPoster = useMemo(
    () => (nonEmpty(coverUrl) ? (coverUrl as string) : shots[0] || "/placeholder.svg"),
    [coverUrl, shots]
  );

  // Trailer de DB normalizado (PRIORIDAD)
  const dbTrailer = useMemo(() => normalizeTrailerUrl(trailerUrl), [trailerUrl]);

  // Si no hay trailer en DB, probamos IGDB
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!getIGDBScreenshots || !nonEmpty(title)) return;
        const res = await getIGDBScreenshots({
          title,
          limit: 6,
          size2x: true,
          minScore: 0.6,
          includeVideo: true,
        });
        if (ignore) return;

        const urls: string[] = Array.isArray(res?.urls) ? (res.urls as string[]) : [];
        setShots(urls);

        if (!nonEmpty(dbTrailer) && nonEmpty(res?.videoUrl)) {
          setIgdbVideo(String(res.videoUrl));
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Gallery] IGDB error:", err);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [getIGDBScreenshots, title, dbTrailer]);

  // trailer final: DB > IGDB
  const trailerFinal = useMemo(
    () => dbTrailer || normalizeTrailerUrl(igdbVideo),
    [dbTrailer, igdbVideo]
  );

  // ORDEN: cover → trailer → screenshots
  const media: Media[] = useMemo(() => {
    const arr: Media[] = [];
    if (nonEmpty(coverUrl)) arr.push({ kind: "image", src: coverUrl as string });
    if (nonEmpty(trailerFinal)) arr.push({ kind: "video", thumb: videoPoster, src: trailerFinal as string });
    for (const s of shots) if (nonEmpty(s)) arr.push({ kind: "image", src: s });
    if (arr.length === 0) arr.push({ kind: "image", src: "/placeholder.svg" });
    return arr;
  }, [coverUrl, trailerFinal, videoPoster, shots]);

  const canPrev = index > 0;
  const canNext = index < media.length - 1;

  return (
    <div className="space-y-3">
      {/* Principal */}
      <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={index}
            className="absolute inset-0"
            initial={{ opacity: 0.2, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.22 }}
          >
            {media[index].kind === "image" ? (
              <img
                src={media[index].src}
                alt={title}
                className="w-full h-full object-cover"
                draggable={false}
                loading="lazy"
              />
            ) : (
              <button
                type="button"
                className="group relative w-full h-full"
                onClick={() => setOpenVideo(true)}
                aria-label="Reproducir trailer"
              >
                <img
                  src={(media[index] as any).thumb}
                  alt={`${title} trailer`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/45 group-hover:bg-black/55 transition-colors" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="rounded-full bg-orange-400 text-slate-900 p-4 shadow-lg ring-2 ring-orange-300/40 group-hover:scale-105 transition-transform">
                    <Play className="w-7 h-7" />
                  </div>
                </div>
              </button>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Overlay inferior */}
        <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
          {genreLabel && (
            <div className="mt-2">
              <Badge className="bg-orange-400 text-slate-900 hover:bg-orange-500">{genreLabel}</Badge>
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
          <Button
            onClick={() => canPrev && setIndex((i) => i - 1)}
            size="icon"
            variant="outline"
            disabled={!canPrev}
            className="bg-black/35 border-white/30 text-white hover:bg-white/20 disabled:opacity-40"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => canNext && setIndex((i) => i + 1)}
            size="icon"
            variant="outline"
            disabled={!canNext}
            className="bg-black/35 border-white/30 text-white hover:bg-white/20 disabled:opacity-40"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-4 gap-2">
        {media.slice(0, 8).map((m, i) => {
          const active = i === index;
          const src = m.kind === "image" ? m.src : (m as any).thumb;
          return (
            <button
              key={`${m.kind}-${i}-${src}`}
              onClick={() => setIndex(i)}
              className={`relative aspect-video rounded-md overflow-hidden border ${
                active ? "border-orange-400" : "border-slate-700"
              }`}
              aria-label={`Miniatura ${i + 1}`}
            >
              <img src={src} alt={`${title} ${m.kind}`} className="w-full h-full object-cover" loading="lazy" />
              {m.kind === "video" && (
                <div className="absolute inset-0 grid place-items-center bg-black/20">
                  <Play className="w-5 h-5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal del trailer */}
      {nonEmpty(trailerFinal) && (
        <VideoModal open={openVideo} onClose={() => setOpenVideo(false)} url={trailerFinal as string} />
      )}
    </div>
  );
}
