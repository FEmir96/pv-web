// convex/queries/getGameById.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getGameById = query({
  args: { id: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
