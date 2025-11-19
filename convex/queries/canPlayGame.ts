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
      return { canPlay: false, reason: "not_found" as const, expiresAt: null };
    }

    // Requiere login
    if (!userId) {
      return { canPlay: false, reason: "login" as const, expiresAt: null };
    }

    // Perfil
    const profile = await ctx.db.get(userId);
    const role = (profile as any)?.role as "free" | "premium" | "admin" | undefined;

    // Admin entra siempre
    if (role === "admin") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    const now = Date.now();

    // Transacciones del usuario
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

    // ============================================================================
    // 🔥 PARCHE: JUEGO "FREE" PERO CON PRECIO = ES JUEGO DE PAGO
    // ============================================================================
    const hasPrice = typeof (game as any).price === "number" && (game as any).price > 0;

    // plan real = lo que está en DB, PERO si tiene precio => se fuerza a premium
    const effectivePlan: "free" | "premium" =
      hasPrice ? "premium" : ((game as any).plan ?? "free");

    // ============================================================================

    // 🎮 LÓGICA FINAL DE ACCESO
    if (effectivePlan === "premium") {
      // Premium requiere rol + compra/alquiler
      if (role !== "premium") {
        return { canPlay: false, reason: "premium_required" as const, expiresAt: null };
      }

      if (ownsGame) {
        return {
          canPlay: true,
          reason: null,
          expiresAt: activeRental?.expiresAt ?? null,
        };
      }

      if (expiredRental) {
        return { canPlay: false, reason: "rental_required" as const, expiresAt: null };
      }

      return { canPlay: false, reason: "purchase_required" as const, expiresAt: null };
    }

    // Free real
    return { canPlay: true, reason: null, expiresAt: null };
  },
});
