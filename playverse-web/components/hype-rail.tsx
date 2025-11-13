"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import CarouselRail from "@/components/rails/carousel-rail";

const WANTED = [
  "Resident Evil: Requiem",
  "Resident Evil: Director's Cut",
  "Marvel's Spider-Man: Miles Morales",
  "Marvel's Spider-Man 2",
  "Star Wars Jedi Survivor",
  "Age of Empires IV",
  "Hello Neighbour 2",
  "Hi Fi Rush",
];

export default function HypeRail() {
  const list = useQuery(api.queries.getGames.getGames, {}) as Doc<"games">[] | undefined;
  const byTitle = new Map<string, Doc<"games">>();
  (list ?? []).forEach((g) => byTitle.set(String(g.title).toLowerCase().trim(), g));

  const selected = WANTED.map((t) => byTitle.get(t.toLowerCase().trim())).filter(Boolean) as Doc<"games">[];
  if (!selected.length) return null;

  return <CarouselRail title="Los más esperados" items={selected} />;
}
