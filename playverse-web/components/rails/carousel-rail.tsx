"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Doc } from "@convex/_generated/dataModel";
import GameCard from "@/components/game-card";

type Props = {
  title: string;
  items: Doc<"games">[];
  autoplayMs?: number;   // undefined = no autoplay
  itemMinW?: string;     // tailwind (ej: "min-w-[280px]")
};

export default function CarouselRail({
  title,
  items,
  autoplayMs,
  itemMinW = "min-w-[280px] sm:min-w-[300px] lg:min-w-[320px]",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const delta = dir === "left" ? -el.clientWidth : el.clientWidth;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  // autoplay suave + pausa en hover
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoplayMs) return;

    let hover = false;
    const onEnter = () => (hover = true);
    const onLeave = () => (hover = false);
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    const id = setInterval(() => {
      if (!el || hover) return;
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + el.clientWidth * 0.9;
      el.scrollTo({ left: next >= max - 4 ? 0 : next, behavior: "smooth" });
    }, autoplayMs);

    return () => {
      clearInterval(id);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [autoplayMs]);

  return (
    <div className="relative">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-orange-400">{title}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollBy("left")}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollBy("right")}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>


      {/* carrusel */}
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 no-scrollbar"
      >
        {items.map((g) => (
          <div key={g._id} className={`${itemMinW} snap-start`}>
            <GameCard game={g} />
          </div>
        ))}
      </div>
    </div>
  );
}
