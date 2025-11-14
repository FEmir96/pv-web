// convex/games.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGameTitlesByIds = query({
  args: { ids: v.array(v.id("games")) },
  handler: async (ctx, { ids }) => {
    if (ids.length === 0) return [];
    const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return docs
      .map((g) => (g ? { _id: g._id, title: (g as any).title ?? "" } : null))
      .filter(Boolean) as { _id: any; title: string }[];
  },
});
