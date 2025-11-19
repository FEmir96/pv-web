// convex/queries/games/getIdByEmbedUrl.ts
import { query } from "../../_generated/server";
import { v } from "convex/values";

export const getIdByEmbedUrl = query({
  args: { embedUrl: v.string() },
  handler: async (ctx, { embedUrl }) => {
    const games = await ctx.db.query("games").collect();

    const norm = (s: string) =>
      s.trim().toLowerCase().replace(/\/+$/, "");

    const target = norm(embedUrl);

    const found = games.find((g: any) => {
      const a = g.embedUrl ? norm(g.embedUrl) : null;
      const b = g.embed_url ? norm(g.embed_url) : null;
      return a === target || b === target;
    });

    if (!found) return null;

    return {
      id: found._id,
      title: found.title,
      embedUrl: found.embedUrl ?? found.embed_url ?? embedUrl,
    };
  },
});
