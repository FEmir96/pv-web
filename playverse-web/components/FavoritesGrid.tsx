"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type FavoriteRow = {
  _id: string;
  gameId?: Id<"games">;
  game?: { _id?: Id<"games">; title?: string; cover_url?: string };
};

export default function FavoritesGrid({ userId }: { userId?: Id<"profiles"> | null }) {
  const rows =
    (useQuery(
      api.queries.listFavoritesByUser.listFavoritesByUser as any,
      userId ? { userId } : "skip"
    ) as FavoriteRow[] | undefined) || [];

  if (!userId) {
    return <div className="text-slate-400">Cargando perfil…</div>;
  }
  if (rows === undefined) {
    return <div className="text-slate-400">Cargando favoritos…</div>;
  }
  if (!rows.length) {
    return <div className="text-slate-400">Aún no tienes favoritos.</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {rows.map((row) => {
        const gid = String(row.game?._id ?? row.gameId ?? "");
        const title = String(row.game?.title ?? "Juego").trim();
        const cover = row.game?.cover_url || "/placeholder.svg";
        const href = gid ? `/juego/${gid}` : undefined;

        const card = (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden transition-transform duration-150 group-hover:-translate-y-0.5">
            <div className="relative aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3 space-y-2">
              <h3 className="text-sm font-semibold text-white line-clamp-2">
                {title}
              </h3>
            </div>
          </div>
        );

        return href ? (
          <Link
            key={row._id}
            href={href}
            className="group block focus:outline-none focus:ring-2 focus:ring-orange-400 rounded-xl"
          >
            {card}
          </Link>
        ) : (
          <div key={row._id} className="group">
            {card}
          </div>
        );
      })}
    </div>
  );
}
