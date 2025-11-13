import { query } from "../_generated/server";
import { v } from "convex/values";

export const countFavorites = query({
  args: { userId: v.id("profiles") },
  handler: async ({ db }, { userId }) => {
    const items = await db
      .query("favorites")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    return { total: items.length };
  },
});
