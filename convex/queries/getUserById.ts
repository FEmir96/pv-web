// convex/queries/getUserById.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserById = query({
  args: { id: v.id("profiles") },
  handler: async (ctx, { id }) => {
    const user = await ctx.db.get(id);
    return user ?? null;
  },
});
