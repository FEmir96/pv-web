import { query } from "../../_generated/server";
import { v } from "convex/values";

export const ownsGame = query({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    const now = Date.now();

    const tx = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const purchased = tx.some(t => t.gameId === gameId && t.type === "purchase");

    const rental = tx.some(
      t =>
        t.gameId === gameId &&
        t.type === "rental" &&
        (typeof t.expiresAt !== "number" || t.expiresAt > now)
    );

    return purchased || rental;
  },
});
