// convex/mutations/updateGame.ts  (wrapper público)
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { updateGameCore } from "../lib/gameCore";

export const updateGame = mutation({
  args: {
    gameId: v.id("games"),
    requesterId: v.optional(v.id("profiles")),

    title: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    cover_url: v.optional(v.union(v.string(), v.null())),
    trailer_url: v.optional(v.union(v.string(), v.null())),
    extraTrailerUrl: v.optional(v.union(v.string(), v.null())),
    extraImages: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),

    purchasePrice: v.optional(v.union(v.float64(), v.string(), v.null())),
    weeklyPrice: v.optional(v.union(v.float64(), v.string(), v.null())),

    embed_url: v.optional(v.union(v.string(), v.null())),
    embed_allow: v.optional(v.union(v.string(), v.null())),
    embed_sandbox: v.optional(v.union(v.string(), v.null())),

    plan: v.optional(v.union(v.literal("free"), v.literal("premium"))),
  },
  handler: async ({ db }, args) => {
    return updateGameCore(db, args);
  },
});
