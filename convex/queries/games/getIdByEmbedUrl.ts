// convex/queries/games/getIdByEmbedUrl.ts
import { query } from "../../_generated/server";
import { v } from "convex/values";

export const getIdByEmbedUrl = query({
  args: { embedUrl: v.string() },
  handler: async (ctx, { embedUrl }) => {
    const g = await ctx.db
      .query("games")
      .filter(q => q.eq(q.field("embed_url"), embedUrl))
      .first();
    if (!g) return null;
    return { id: g._id, title: g.title, embedUrl: g.embed_url };
  },
});
