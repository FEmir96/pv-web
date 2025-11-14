// convex/mutations/restoreGameTitles.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const restoreGameTitles = mutation({
  args: {
    fixes: v.array(v.object({
      id: v.id("games"),
      title: v.string(),
    })),
  },
  handler: async (ctx, { fixes }) => {
    for (const f of fixes) {
      await ctx.db.patch(f.id, { title: f.title });
    }
    return { updated: fixes.length };
  },
});
