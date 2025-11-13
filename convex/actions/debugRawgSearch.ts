"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { rawgSearchGames, rawgGetGameBySlug } from "../lib/rawg/client";

export const debugRawgSearch = action({
  args: { q: v.string(), slug: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    if (args.slug) return await rawgGetGameBySlug(args.slug);
    return await rawgSearchGames(args.q, 10);
  },
});
