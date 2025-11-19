import { query } from "../../_generated/server";
import { v } from "convex/values";
import { findGameByEmbedUrl } from "../../lib/embed";

export const getIdByEmbedUrl = query({
  args: { embedUrl: v.string() },
  handler: async (ctx, { embedUrl }) => {
    const found = await findGameByEmbedUrl(ctx.db, embedUrl);
    if (!found) {
      return null;
    }

    return {
      id: found._id,
      title: found.title,
      embedUrl: found.embedUrl ?? embedUrl,
    };
  },
});
