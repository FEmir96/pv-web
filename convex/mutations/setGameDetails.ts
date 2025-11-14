import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const setGameDetails = mutation({
  args: {
    gameId: v.id("games"),
    description: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    overwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, { gameId, description, genres, overwrite = false }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");

    const patch: Record<string, any> = {};

    // Descripción (sinopsis)
    if (typeof description === "string" && description.trim() !== "") {
      if (!overwrite && game.description && game.description.trim() !== "") {
        return { ok: true, skipped: true };
      }
      patch.description = description.slice(0, 4000);
    }

    // Géneros (si querés que también los establezca cuando falten)
    if (Array.isArray(genres) && genres.length > 0) {
      const hadGenres = Array.isArray((game as any).genres) && (game as any).genres.length > 0;
      if (overwrite || !hadGenres) {
        patch.genres = genres;
      }
    }

    if (Object.keys(patch).length === 0) return { ok: true, skipped: true };
    await ctx.db.patch(gameId as Id<"games">, patch);
    return { ok: true, updated: true };
  },
});
