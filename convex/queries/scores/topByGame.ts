import { query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { findGameByEmbedUrl } from "../../lib/embed";

export const topByGame = query({
  args: {
    gameId: v.optional(v.id("games")),
    embedUrl: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let gameId: Id<"games"> | null = args.gameId ?? null;
    if (!gameId && args.embedUrl) {
      const g = await findGameByEmbedUrl(ctx.db, args.embedUrl);
      if (!g) return [];
      gameId = g._id;
    }
    if (!gameId) return [];

    const rows = await ctx.db
      .query("scores")
      .withIndex("by_game", (q) => q.eq("gameId", gameId!))
      .collect();

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });

    const lim = Math.min(Math.max(args.limit ?? 10, 1), 100);

    const out = await Promise.all(
      rows.slice(0, lim).map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return {
          _id: r._id,
          userId: r.userId,
          userEmail: r.userEmail,
          userName: u?.name ?? (r.userEmail.split("@")[0] || "Jugador"),
          gameId: r.gameId,
          gameTitle: r.gameTitle ?? null,
          score: r.score,
          updatedAt: r.updatedAt,
        };
      })
    );

    return out;
  },
});
