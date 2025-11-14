// convex/queries/getUpcomingGames.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUpcomingGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async ({ db }, { limit }) => {
    const rows = await db
      .query("upcomingGames")
      .withIndex("by_releaseAt")
      .order("asc")
      .take(limit ?? 8);

    // Fallback: si no hay cover en upcoming pero sí hay gameId, usa la del juego vinculado
    const result = await Promise.all(
      rows.map(async (u) => {
        if (!u.cover_url && u.gameId) {
          const g = await db.get(u.gameId);
          return { ...u, cover_url: g?.cover_url ?? u.cover_url };
        }
        return u;
      })
    );
    return result;
  },
});
