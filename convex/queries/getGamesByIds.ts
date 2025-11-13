// convex/queries/getGamesByIds.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getGamesByIds = query({
  args: { ids: v.array(v.id("games")) },
  handler: async (ctx, { ids }) => {
    const out = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return out
      .filter(Boolean)
      .map((g: any) => ({
        _id: g._id,
        title: g.title ?? "Juego",
        cover_url: g.cover_url ?? null,
        price_buy: typeof g.price_buy === "number" ? g.price_buy : 49.99,
      }));
  },
});
