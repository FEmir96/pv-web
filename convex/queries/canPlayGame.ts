import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const canPlayGame = query({
  args: {
    userId: v.union(v.id("profiles"), v.null()),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) {
      return { canPlay: false, reason: "not_found" as const, expiresAt: null as number | null };
    }

    // Requiere login para evaluar
    if (!userId) {
      return { canPlay: false, reason: "login" as const, expiresAt: null };
    }

    // Perfil (para rol)
    const profile = await ctx.db.get(userId);
    const role = (profile as any)?.role as "free" | "premium" | "admin" | undefined;

    // Admin siempre permitido
    if (role === "admin") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    const now = Date.now();
    const userTx = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const hasPurchase = userTx.some((t) => t.gameId === gameId && t.type === "purchase");

    const activeRental = userTx.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        (typeof t.expiresAt !== "number" || t.expiresAt > now)
    );
    const hasRental = !!activeRental;

    const expiredRental = userTx.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        typeof t.expiresAt === "number" &&
        t.expiresAt <= now
    );

    const ownsGame = hasPurchase || hasRental;

    // Premium: requiere rol premium + compra o alquiler vigente
    if ((game as any).plan === "premium") {
      if (role !== "premium") {
        return { canPlay: false, reason: "premium_required" as const, expiresAt: null };
      }
      if (ownsGame) {
        return { canPlay: true, reason: null, expiresAt: activeRental?.expiresAt ?? null };
      }
      if (expiredRental) {
        return { canPlay: false, reason: "rental_required" as const, expiresAt: null };
      }
      return { canPlay: false, reason: "purchase_required" as const, expiresAt: null };
    }

    // Free: también necesita estar en biblioteca (compra o alquiler vigente)
    if (ownsGame) {
      return { canPlay: true, reason: null, expiresAt: activeRental?.expiresAt ?? null };
    }
    if (expiredRental) {
      return { canPlay: false, reason: "rental_required" as const, expiresAt: null };
    }
    return { canPlay: false, reason: "purchase_required" as const, expiresAt: null };
  },
});
