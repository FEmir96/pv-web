// convex/functions/mutations/addGamesBatch.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const addGamesBatch = mutation({
  args: {
    games: v.array(
      v.object({
        title: v.string(),
        plan: v.union(v.literal("free"), v.literal("premium")),
        description: v.optional(v.string()),
        cover_url: v.optional(v.string()),
        trailer_url: v.optional(v.string()),
      })
    ),
  },
  handler: async ({ db }, { games }) => {
    let insertedCount = 0;

    for (const game of games) {
      // verificar si ya existe un juego con el mismo título
      const existing = await db
        .query("games")
        .withIndex("by_title", (q) => q.eq("title", game.title))
        .unique();

      if (!existing) {
        await db.insert("games", {
          ...game,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }

    return { inserted: insertedCount };
  },
});
