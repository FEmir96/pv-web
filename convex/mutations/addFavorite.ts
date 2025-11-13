import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const addFavorite = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async ({ db }, { userId, gameId }) => {
    const existing = await db
      .query("favorites")
      .withIndex("by_user_game", q => q.eq("userId", userId).eq("gameId", gameId))
      .unique();
    if (existing) return { status: "exists" };
    await db.insert("favorites", { userId, gameId, createdAt: Date.now() });
    return { status: "added" };
  },
});
