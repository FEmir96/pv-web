import { query } from "../_generated/server";
import { v } from "convex/values";

export const getFeaturedByTitles = query({
  args: { titles: v.array(v.string()), size: v.optional(v.number()) },
  handler: async (ctx, { titles, size }) => {
    // traigo todos los games 1 vez y mapeo por título (case-insensitive)
    const all = await ctx.db.query("games").withIndex("by_title").collect();
    const map = new Map(all.map((g) => [g.title.toLowerCase(), g]));
    const ordered = titles
      .map((t) => map.get(t.toLowerCase()))
      .filter(Boolean);
    return size ? ordered.slice(0, size) : ordered;
  },
});
