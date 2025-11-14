import { query } from "../_generated/server";

export const listGamesMinimal = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("games").collect();
    return rows.map((g: any) => ({
      _id: g._id,
      title: g.title as string,
      igdbId: typeof g.igdbId === "number" ? g.igdbId : null,
      ageRatingLabel: g.ageRatingLabel ?? null,
    }));
  },
});
