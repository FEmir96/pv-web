import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const toggleFavorite = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async ({ db }, { userId, gameId }) => {
    const existing = await db
      .query("favorites")
      .withIndex("by_user_game", q => q.eq("userId", userId).eq("gameId", gameId))
      .unique();

    if (existing) {
      await db.delete(existing._id);
      return { status: "removed" as const };
    } else {
      await db.insert("favorites", { userId, gameId, createdAt: Date.now() });
      return { status: "added" as const };
    }
  },
});
