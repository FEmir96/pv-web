import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

export const submitScore = mutation({
  args: {
    userEmail: v.string(),
    score: v.number(),
    gameId: v.optional(v.id("games")),
    embedUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.userEmail.toLowerCase();
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return { status: "no_user", best: args.score };

    let game: { _id: Id<"games">; title: string } | null = null;
    if (args.gameId) {
      const g = await ctx.db.get(args.gameId);
      if (g) game = { _id: g._id, title: g.title };
    } else if (args.embedUrl) {
      const g = await ctx.db
        .query("games")
        .filter((q) => q.eq(q.field("embed_url"), args.embedUrl))
        .first();
      if (g) game = { _id: g._id, title: g.title };
    }
    if (!game) return { status: "no_game", best: args.score };

    const old = await ctx.db
      .query("scores")
      .withIndex("by_user_game", (q) =>
        q.eq("userId", user._id).eq("gameId", game!._id)
      )
      .first();

    const now = Date.now();

    if (!old) {
      await ctx.db.insert("scores", {
        userId: user._id,
        userEmail: user.email,
        gameId: game._id,
        gameTitle: game.title,
        score: args.score,
        createdAt: now,
        updatedAt: now,
      });
      return { status: "created", best: args.score };
    }

    if (args.score > (old.score ?? 0)) {
      await ctx.db.patch(old._id, { score: args.score, updatedAt: now });
      return { status: "updated", best: args.score };
    }

    return { status: "kept", best: old.score ?? args.score };
  },
});
