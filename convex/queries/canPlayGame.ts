// convex/queries/canPlayGame.ts
import { query } from "../_generated/server";            // ajusta la ruta si tu árbol es distinto
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

    // Requiere login para evaluar (y para free embebidos pedimos login también)
    if (!userId) {
      return { canPlay: false, reason: "login" as const, expiresAt: null };
    }

    // Perfil (para ver rol)
    const profile = await ctx.db.get(userId);
    const role = (profile as any)?.role as "free" | "premium" | "admin" | undefined;

    // ✅ BYPASS ADMIN: siempre permitido
    if (role === "admin") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // Propiedad / alquiler
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

    // Plan free: si hay login, permitimos (aunque no exista transacción)
    if ((game as any).plan === "free") {
      return { canPlay: true, reason: null, expiresAt: null };
    }

    // Plan premium: necesita compra o alquiler vigente
    if ((game as any).plan === "premium") {
      if (hasPurchase || hasRental) {
        return { canPlay: true, reason: null, expiresAt: activeRental?.expiresAt ?? null };
      }
      // sin compra/alquiler
      return { canPlay: false, reason: "premium_required" as const, expiresAt: null };
    }

    // Fallback conservador
    return { canPlay: false, reason: "unknown" as const, expiresAt: null };
  },
});
