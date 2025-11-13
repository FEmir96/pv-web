// convex/functions/queries/getUserUpgrades.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserUpgrades = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    const upgrades = await ctx.db
      .query("upgrades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return upgrades.sort((a, b) => b.effectiveAt - a.effectiveAt);
  },
});
