import { query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

export const getMyBestByGame = query({
  args: {
    userEmail: v.string(),
    embedUrl: v.optional(v.string()),
    gameId: v.optional(v.id("games")),
  },
  handler: async (ctx, args) => {
    const email = args.userEmail.toLowerCase();
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return null;

    let gid: Id<"games"> | undefined = args.gameId as any;
    if (!gid && args.embedUrl) {
      const g = await ctx.db
        .query("games")
        .filter((q) => q.eq(q.field("embed_url"), args.embedUrl))
        .first();
      if (!g) return null;
      gid = g._id;
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
