import { query } from "../../_generated/server";
import { v } from "convex/values";

export const canPlayGame = query({
  args: {
    userId: v.union(v.id("profiles"), v.null()),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    console.log("🔥 Ejecutando canPlayGame v6", { userId, gameId });

    // 1) Validar juego existente
    const game = await ctx.db.get(gameId);
    if (!game) {
      return { canPlay: false, reason: "not_found", expiresAt: null };
    }

    // 2) Si no hay usuario → denegar
    if (!userId) {
      return { canPlay: false, reason: "login_required", expiresAt: null };
    }

    // 3) Obtener perfil SIEMPRE dentro del guard
    const profile = await ctx.db.get(userId);
    if (!profile) {
      return { canPlay: false, reason: "login_required", expiresAt: null };
    }

    const role = profile.role ?? "free";

    // 4) Admin juega todo
    if (role === "admin") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // 5) Juegos free → solo login
    if (game.plan === "free") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // 6) Premium juega premium SIN pagar adicional
    if (role === "premium") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // 7) Transacciones
    const now = Date.now();
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    const hasPurchase = txs.some(
      t => t.gameId === gameId && t.type === "purchase"
    );

    const activeRental = txs.find(
      t =>
        t.gameId === gameId &&
        t.type === "rental" &&
        (!t.expiresAt || t.expiresAt > now)
    );

    const expiredRental = txs.find(
      t =>
        t.gameId === gameId &&
        t.type === "rental" &&
        t.expiresAt &&
        t.expiresAt <= now
    );

    const owns = hasPurchase || !!activeRental;

    if (!owns) {
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
