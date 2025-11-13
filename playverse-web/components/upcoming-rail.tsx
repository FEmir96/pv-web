"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Star } from "lucide-react";
import Link from "next/link";

type UpcomingItem = {
  _id: string;
  title: string;
  genre?: string;
  releaseAt: number;
  cover_url?: string;
  gameId?: string;
};

export default function UpcomingRail({ limit = 8 }: { limit?: number }) {
  const getUpcomingFn =
    ((api as any).queries?.getUpcomingGames &&
      (((api as any).queries.getUpcomingGames as any).getUpcomingGames ||
        (api as any).queries.getUpcomingGames)) ||
    ((api as any).queries?.listUpcoming &&
      (((api as any).queries.listUpcoming as any).listUpcoming ||
        (api as any).queries.listUpcoming)) ||
    undefined;

  if (!getUpcomingFn && process.env.NODE_ENV !== "production") {
    console.warn(
      "[UpcomingRail] Falta queries.getUpcomingGames o queries.listUpcoming. " +
        "Corré `npx convex dev` en /convex y reiniciá Next."
    );
  }

  const items =
    (useQuery(getUpcomingFn as any, { limit }) as UpcomingItem[] | undefined) ??
    [];

  if (!items.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card
            key={i}
            className="bg-slate-800 border-slate-700 overflow-hidden animate-pulse"
          >
            <div className="relative aspect-[4/3] bg-slate-700" />
            <CardContent className="p-4">
              <div className="h-5 bg-slate-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-700 rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((u) => (
        <UpcomingCard key={u._id} item={u} />
      ))}
    </div>
  );
}

function UpcomingCard({ item }: { item: UpcomingItem }) {
  const cover = item.cover_url || "/placeholder_game.jpg";

  return (
    <Card className="bg-[#161f2e] border-slate-700 overflow-hidden p-0 gap-0">
      <div className="relative">
        {item.genre && (
          <Badge className="absolute top-3 left-3 bg-orange-400 text-slate-900 font-semibold z-10">
            {item.genre}
          </Badge>
        )}

        {/* PORTADA — Más alta (4/3) + imagen nítida (object-contain) */}
        <div className="relative aspect-[4/3] bg-slate-700 overflow-hidden">
          {/* Fondo borroso para no dejar franjas vacías */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover blur-sm scale-110 opacity-35"
            loading="lazy"
            decoding="async"
          />

          {/* Imagen principal sin recorte */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />

          {/* Degradado SOLO desde abajo para el chip (no “lava” toda la imagen) */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />

          {/* Chip de fecha */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-slate-800/95 px-3 py-1 rounded-full flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">
                Próximamente · {formatDate(item.releaseAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-2">
          <Star className="w-4 h-4 fill-orange-400 text-orange-400" />
          <span className="text-orange-400 font-semibold">4.5</span>
        </div>

        <h3 className="text-orange-400 font-semibold text-lg mb-2 line-clamp-1">
          {item.title}
        </h3>

        {item.gameId && (
          <Link
            href={`/juego/${item.gameId}`}
            className="text-cyan-400 hover:underline text-sm"
          >
            Ver ficha del juego
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(ms: number) {
  try {
    return new Date(ms).toLocaleDateString("es-AR", {

      year: "numeric",
    });
  } catch {
    return "pronto";
  }
}
