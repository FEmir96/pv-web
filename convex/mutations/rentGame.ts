// convex/functions/mutations/rentGame.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const rentGame = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
  },
  handler: async (ctx, { userId, gameId }) => {
    const now = Date.now();

    const user = await ctx.db.get(userId);
    const game = await ctx.db.get(gameId);
    if (!user) throw new Error("Usuario no encontrado");
    if (!game) throw new Error("Juego no encontrado");

    // Free no puede alquilar juegos premium
    if (user.role === "free" && game.plan === "premium") {
      throw new Error("Este juego requiere plan Premium para alquilarse.");
    }

    // Evitar alquiler duplicado activo
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("gameId"), gameId))
      .filter((q) => q.eq(q.field("type"), "rental"))
      .first();

    if (existing && existing.expiresAt && existing.expiresAt > now) {
      throw new Error("Ya tenés este juego alquilado y activo.");
    }

    const EXPIRES_FREE_MS = 72 * 60 * 60 * 1000;        // 72hs
    const EXPIRES_PREMIUM_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
    const expiresAt = user.role === "premium" ? now + EXPIRES_PREMIUM_MS : now + EXPIRES_FREE_MS;

    const transactionId = await ctx.db.insert("transactions", {
      userId,
      gameId,
      type: "rental",
      createdAt: now,
      expiresAt,
    });

    return {
      transactionId,
      expiresAt,
      showAds: user.role === "free",
      message:
        user.role === "free"
          ? "Alquiler iniciado por 72hs (con anuncios)."
          : "Alquiler iniciado por 7 días (sin anuncios).",
    };
  },
});
