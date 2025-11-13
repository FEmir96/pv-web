// convex/mutations/createGame.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { createGameCore } from "../lib/gameCore";

export const createGame = mutation({
  args: {
    requesterId: v.optional(v.id("profiles")), // opcional para compat

    title: v.string(),
    plan: v.union(v.literal("free"), v.literal("premium")),

    description: v.optional(v.union(v.string(), v.null())),
    cover_url: v.optional(v.union(v.string(), v.null())),
    trailer_url: v.optional(v.union(v.string(), v.null())),

    extraTrailerUrl: v.optional(v.union(v.string(), v.null())),
    extraImages: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),

    weeklyPrice: v.optional(v.union(v.number(), v.string(), v.null())),
    purchasePrice: v.optional(v.union(v.number(), v.string(), v.null())),

    embed_url: v.optional(v.union(v.string(), v.null())),
    embedUrl: v.optional(v.union(v.string(), v.null())),
    embed_allow: v.optional(v.union(v.string(), v.null())),
    embedAllow: v.optional(v.union(v.string(), v.null())),
    embed_sandbox: v.optional(v.union(v.string(), v.null())),
    embedSandbox: v.optional(v.union(v.string(), v.null())),
  },
  handler: async ({ db }, args) => {
    const res = await createGameCore(db, args);
    return res;
  },
});
