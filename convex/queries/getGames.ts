import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export const getGames = query({
  args: {},
  handler: async (ctx): Promise<Doc<"games">[]> => {
    return await ctx.db.query("games").collect();
  },
});
