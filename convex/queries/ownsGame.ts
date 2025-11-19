// convex/queries/ownsGame.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const ownsGame = query({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    // Validamos que exista el perfil
    const user = await ctx.db.get(userId);
    if (!user) {
      return { owns: false, rentalExpiresAt: null as number | null, purchased: false };
    }

    const now = Date.now();

    // Todas las transacciones del usuario
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (!txs || txs.length === 0) {
      return { owns: false, rentalExpiresAt: null, purchased: false };
    }

    // Compra permanente
    const purchased = txs.some(
      (t) => t.gameId === gameId && t.type === "purchase"
    );

    // Alquiler vigente
    const rental = txs.find(
      (t) =>
        t.gameId === gameId &&
        t.type === "rental" &&
        (typeof t.expiresAt !== "number" || t.expiresAt > now)
    );

    const hasAccess = purchased || !!rental;

    return {
      owns: hasAccess,
      rentalExpiresAt: rental?.expiresAt ?? null,
      purchased,
    };
  },
});
