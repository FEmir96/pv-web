import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export const listGamesWithoutDetails = query({
  args: {},
  handler: async (ctx): Promise<Doc<"games">[]> => {
    const all = await ctx.db.query("games").collect();
    return all.filter((g) => {
      const missingDesc = !g.description || g.description.trim() === "";
      const missingGenres = !Array.isArray(g.genres) || g.genres.length === 0;
      return missingDesc || missingGenres;
    });
  },
});
