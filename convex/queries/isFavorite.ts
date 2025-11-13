import { query } from "../_generated/server";
import { v } from "convex/values";

export const isFavorite = query({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async ({ db }, { userId, gameId }) => {
    const row = await db
      .query("favorites")
      .withIndex("by_user_game", q => q.eq("userId", userId).eq("gameId", gameId))
      .unique();
    return { isFavorite: !!row };
  },
});
