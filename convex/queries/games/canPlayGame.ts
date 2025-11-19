import { query } from "../../_generated/server";
import { v } from "convex/values";

export const canPlayGame = query({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) {
      return { canPlay: false, reason: "not_found", expiresAt: null };
    }

    if (!userId) {
      return { canPlay: false, reason: "login_required", expiresAt: null };
    }

    const profile = await ctx.db.get(userId);
    if (!profile) {
      return { canPlay: false, reason: "profile_not_found", expiresAt: null };
    }

    if (profile.role === "admin") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    const plan = (game as any).plan ?? "free";
    const isFreeGame = plan === "free";

    if (isFreeGame) {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    if (profile.role === "free") {
      return { canPlay: false, reason: "premium_required", expiresAt: null };
    }

    const now = Date.now();
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const hasPurchase = transactions.some(
      (tx) => tx.gameId === gameId && tx.type === "purchase"
    );

    const activeRental = transactions.find(
      (tx) =>
        tx.gameId === gameId &&
        tx.type === "rental" &&
        (!tx.expiresAt || tx.expiresAt > now)
    );

    const expiredRental = transactions.find(
      (tx) =>
        tx.gameId === gameId &&
        tx.type === "rental" &&
        tx.expiresAt &&
        tx.expiresAt <= now
    );

    const ownsGame = hasPurchase || Boolean(activeRental);

    if (!ownsGame) {
      if (expiredRental) {
        return { canPlay: false, reason: "rental_required", expiresAt: null };
      }

      return { canPlay: false, reason: "purchase_required", expiresAt: null };
    }

    return {
      canPlay: true,
      reason: null,
      expiresAt: activeRental?.expiresAt ?? null,
    };
  },
});
