import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const applyAgeRating = mutation({
  args: {
    gameId: v.id("games"),
    ageRatingSystem: v.optional(v.string()),
    ageRatingCode: v.optional(v.string()),
    ageRatingLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.ageRatingSystem !== undefined) patch.ageRatingSystem = args.ageRatingSystem;
    if (args.ageRatingCode !== undefined) patch.ageRatingCode = args.ageRatingCode;
    if (args.ageRatingLabel !== undefined) patch.ageRatingLabel = args.ageRatingLabel;

    await ctx.db.patch(args.gameId as Id<"games">, patch);
    return { ok: true };
  },
});
