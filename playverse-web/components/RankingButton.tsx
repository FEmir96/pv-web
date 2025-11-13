// playverse-web/components/RankingButton.tsx
"use client";

import Link from "next/link";

export default function RankingButton({ embedUrl }: { embedUrl?: string | null }) {
  // Inferimos el juego desde el embedUrl
  const game = embedUrl?.includes("pulse-riders") ? "pulse-riders" : "snake";

  return (
    <Link
      href={`/leaderboard?game=${game}`}
      className="inline-flex items-center rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold px-4 py-1.5 shadow ring-1 ring-cyan-300/40 transition"
    >
      Ranking
    </Link>
  );
}
