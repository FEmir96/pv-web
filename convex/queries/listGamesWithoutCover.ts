// convex/queries/listGamesWithoutCover.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const listGamesWithoutCover = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("games").collect();
    const missing = all.filter(
      (g) => !g.cover_url || g.cover_url.trim() === ""
    );
    const rows = typeof limit === "number" ? missing.slice(0, limit) : missing;
    // devolvemos lo mínimo que usan las actions
    return rows.map((g) => ({ _id: g._id, title: g.title }));
  },
});
