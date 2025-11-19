import { query } from "../../_generated/server";
import { v } from "convex/values";

export const canPlayGame = query({
  args: {
    userId: v.union(v.id("profiles"), v.null()),
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
    const role = profile?.role ?? "free";

    const now = Date.now();
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const hasPurchase = txs.some(
      (t) => t.gameId === gameId && t.type === "purchase"
    );

    const activeRental = txs.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        (!t.expiresAt || t.expiresAt > now)
    );

    const expiredRental = txs.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        t.expiresAt &&
        t.expiresAt <= now
    );

    const owns = hasPurchase || !!activeRental;

    // 1) Juegos FREE: pasan sin validar
    if (game.plan === "free") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // 2) Si es Premium y el usuario también → pasa
    if (game.plan === "premium" && role === "premium") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // 3) Juegos de compra/alquiler: validar biblioteca
    if (!owns) {
      if (expiredRental) {
        return { canPlay: false, reason: "rental_required", expiresAt: null };
      }
      return { canPlay: false, reason: "purchase_required", expiresAt: null };
    }

    // 4) Si llegó hasta acá → tiene acceso
    return {
      canPlay: true,
      reason: null,
      expiresAt: activeRental?.expiresAt ?? null,
    };
  },
});
