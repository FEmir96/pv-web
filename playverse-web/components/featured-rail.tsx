"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import CarouselRail from "@/components/rails/carousel-rail";

export default function FeaturedRail() {
  const list = useQuery(api.queries.getGames.getGames, {}) as Doc<"games">[] | undefined;

  if (!list) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 rounded-xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  const featured = [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  return <CarouselRail title="" items={featured} />;
}
