// convex/functions/queries/getUserPayments.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserPayments = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return payments.sort((a, b) => b.createdAt - a.createdAt);
  },
});
