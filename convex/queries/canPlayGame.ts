// convex/queries/canPlayGame.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const canPlayGame = query({
  args: {
    userId: v.union(v.id("profiles"), v.null()),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) {
      return {
        canPlay: false,
        reason: "not_found" as const,
        expiresAt: null as number | null,
      };
    }

    // 🔒 Requiere login SIEMPRE
    if (!userId) {
      return {
        canPlay: false,
        reason: "login" as const,
        expiresAt: null,
      };
    }

    const profile = await ctx.db.get(userId);
    const role = (profile as any)?.role as
      | "free"
      | "premium"
      | "admin"
      | undefined;

    // 👑 Admin siempre puede
    if (role === "admin") {
      return {
        canPlay: true,
        reason: null,
        expiresAt: null,
      };
    }

    const now = Date.now();
    const userTx = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const hasPurchase = userTx.some(
      (t) => t.gameId === gameId && t.type === "purchase"
    );

    const activeRental = userTx.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        (typeof t.expiresAt !== "number" || t.expiresAt > now)
    );

    const expiredRental = userTx.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        typeof t.expiresAt === "number" &&
        t.expiresAt <= now
    );

    const ownsGame = hasPurchase || !!activeRental;

    // 🎮 Modelo de negocio del juego
    const plan = (game as any).plan as "free" | "premium" | "paid" | undefined;

    const isFreeGame = plan === "free";

    // 1) Juegos realmente FREE → solo login
    if (isFreeGame) {
      return {
        canPlay: true,
        reason: null,
        expiresAt: null,
      };
    }

    // 2) Juegos incluidos en Premium (plan === "premium")
    if (plan === "premium") {
      if (role === "premium" || ownsGame) {
        return {
          canPlay: true,
          reason: null,
          expiresAt: activeRental?.expiresAt ?? null,
        };
      }

      if (expiredRental) {
        return {
          canPlay: false,
          reason: "rental_required" as const,
          expiresAt: null,
        };
      }

      return {
        canPlay: false,
        reason: "premium_required" as const,
        expiresAt: null,
      };
    }

    // 3) Juegos pago por título (plan "paid" o sin plan)
    if (ownsGame) {
      return {
        canPlay: true,
        reason: null,
        expiresAt: activeRental?.expiresAt ?? null,
      };
    }

    if (expiredRental) {
      return {
        canPlay: false,
        reason: "rental_required" as const,
        expiresAt: null,
      };
    }

    return {
      canPlay: false,
      reason: "purchase_required" as const,
      expiresAt: null,
    };
  },
});
