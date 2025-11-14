import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertUpcoming = mutation({
  args: {
    title: v.string(),
    genre: v.optional(v.string()),
    releaseAt: v.number(),
    priority: v.optional(v.number()),
    cover_url: v.optional(v.string()),
    gameId: v.optional(v.id("games")),
  },
  handler: async ({ db }, args) => {
    const existing = await db
      .query("upcomingGames")
      .withIndex("by_title", (q) => q.eq("title", args.title))
      .unique();

    if (existing) {
      await db.patch(existing._id, {
        genre: args.genre ?? existing.genre,
        releaseAt: args.releaseAt,
        priority: args.priority ?? existing.priority,
        // si mandás cover_url o gameId los pisa, si no, deja como estaba
        ...(args.cover_url !== undefined ? { cover_url: args.cover_url } : {}),
        ...(args.gameId !== undefined ? { gameId: args.gameId } : {}),
      });
      return { updated: true as const, _id: existing._id };
    }

    const _id = await db.insert("upcomingGames", {
      title: args.title,
      genre: args.genre,
      releaseAt: args.releaseAt,
      priority: args.priority ?? 999,
      cover_url: args.cover_url,
      gameId: args.gameId,
      createdAt: Date.now(),
    });
    return { updated: false as const, _id };
  },
});
