// convex/queries/games/getIdByEmbedUrl.ts
import { query } from "../../_generated/server";
import { v } from "convex/values";
import { findGameByEmbedUrl, normalizeEmbedUrl } from "../../lib/embed";

export const getIdByEmbedUrl = query({
  args: { embedUrl: v.string() },
  handler: async (ctx, { embedUrl }) => {
    const g = await findGameByEmbedUrl(ctx.db, embedUrl);
    if (!g) return null;
    const stored = g.embedUrl ?? embedUrl;
    return { id: g._id, title: g.title, embedUrl: normalizeEmbedUrl(stored) ?? stored };
  },
});
