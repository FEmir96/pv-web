import { query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { findGameByEmbedUrl } from "../../lib/embed";

export const getMyBestByGame = query({
  args: {
    userEmail: v.string(),
    embedUrl: v.optional(v.string()),
    gameId: v.optional(v.id("games")),
  },
  handler: async (ctx, args) => {
    const email = args.userEmail.trim().toLowerCase();
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return null;

    let gid: Id<"games"> | undefined = args.gameId as any;
    if (!gid && args.embedUrl) {
      const g = await findGameByEmbedUrl(ctx.db, args.embedUrl);
      if (!g) return null;
      gid = g._id as Id<"games">;
    }
    if (!gid) return null;

    const row = await ctx.db
      .query("scores")
      .withIndex("by_user_game", (q) =>
        q.eq("userId", user._id).eq("gameId", gid!)
      )
      .first();

    return row ? { score: row.score, updatedAt: row.updatedAt } : null;
  },
});
