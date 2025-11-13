import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const removeFavorite = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async ({ db }, { userId, gameId }) => {
    const existing = await db
      .query("favorites")
      .withIndex("by_user_game", q => q.eq("userId", userId).eq("gameId", gameId))
      .unique();
    if (!existing) return { status: "not_found" };
    await db.delete(existing._id);
    return { status: "removed" };
  },
});
