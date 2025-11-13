// convex/queries/admin/listGames.ts
import { query } from "../../_generated/server";

export const listGames = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("games").collect();
    return rows
      .map((g) => ({
        _id: g._id,
        title: g.title,
        plan: g.plan, // "free" | "premium"
        description: g.description ?? "",
        cover_url: g.cover_url,
        trailer_url: g.trailer_url,
        genres: g.genres ?? [],
        purchasePrice: g.purchasePrice,
        weeklyPrice: g.weeklyPrice,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  },
});
