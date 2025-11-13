"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import CarouselRail from "@/components/rails/carousel-rail";

function isFree(g: any) {
  return (
    g?.isFree === true ||
    (typeof g?.price === "number" && g.price <= 0) ||
    (typeof g?.plan === "string" && g.plan.toLowerCase() === "free") ||
    (Array.isArray(g?.tags) && g.tags.some((t: string) => String(t).toLowerCase().includes("free")))
  );
}

export default function FreeRail() {
  const list = useQuery(api.queries.getGames.getGames, {}) as Doc<"games">[] | undefined;
  const free = (list ?? []).filter(isFree).slice(0, 12);

  if (!free.length) return null; // si no hay, no mostramos nada
  return <CarouselRail title="Más populares del plan Free" items={free} />;
}
