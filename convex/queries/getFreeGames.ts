import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export const getFreeGames = query({
  args: {},
  handler: async (ctx): Promise<Doc<"games">[]> => {
    const all = await ctx.db.query("games").collect();
    return all.filter(g => g.plan === "free");
  },
});
