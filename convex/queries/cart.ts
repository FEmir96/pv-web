// convex/queries/cart.ts
import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

/** Cantidad de ítems en el carrito (badge del header). */
export const getCartCount = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("cartItems")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    return rows.length;
  },
});

/** ¿Está un juego en el carrito? */
export const hasInCart = query({
  args: { userId: v.id("profiles"), gameId: v.id("games") },
  handler: async (ctx, { userId, gameId }) => {
    const row = await ctx.db
      .query("cartItems")
      .withIndex("by_user_game", q => q.eq("userId", userId).eq("gameId", gameId))
      .first();
    return !!row;
  },
});

/** Lista detallada para /checkout/carrito con precio normalizado. */
export const getCartDetailed = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    const out: Array<{
      cartItemId: Id<"cartItems">;
      gameId: Id<"games">;
      title: string;
      cover_url?: string | null;
      price_buy: number;
      currency: "USD";
    }> = [];

    for (const row of items) {
      const g = await ctx.db.get(row.gameId);
      if (!g) continue;

      const price =
        typeof (g as any).purchasePrice === "number" ? (g as any).purchasePrice :
        typeof (g as any).price_buy === "number"     ? (g as any).price_buy     :
        typeof (g as any).price === "number"         ? (g as any).price         : 0;

      out.push({
        cartItemId: row._id,
        gameId: row.gameId,
        title: g.title,
        cover_url: (g as any).cover_url ?? null,
        price_buy: price,
        currency: "USD",
      });
    }
    return out;
  },
});
