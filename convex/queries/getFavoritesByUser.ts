import { query } from "../_generated/server";
import { v } from "convex/values";

export const getFavoritesByUser = query({
  args: { userId: v.id("profiles") },
  handler: async ({ db }, { userId }) => {
    const favorites = await db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (favorites.length === 0) return [];

    const gameDocs = await Promise.all(
      favorites.map((favorite) => db.get(favorite.gameId))
    );
    const gamesById = new Map(
      gameDocs.filter(Boolean).map((game) => [game!._id, game!])
    );

    return favorites
      .map((favorite) => {
        const game = gamesById.get(favorite.gameId) ?? null;
        return {
          _id: favorite._id,
          userId: favorite.userId,
          gameId: favorite.gameId,
          createdAt:
            typeof favorite.createdAt === "number"
              ? favorite.createdAt
              : Date.now(),
          game: game
            ? {
                _id: game._id,
                title: game.title ?? "Juego",
                cover_url: (game as any).cover_url ?? null,
                plan: (game as any).plan ?? "free",
                weeklyPrice:
                  (game as any).weeklyPrice ??
                  (game as any).weekly_price ??
                  null,
                purchasePrice:
                  (game as any).purchasePrice ??
                  (game as any).price_buy ??
                  null,
                igdbRating:
                  (game as any).igdbRating ??
                  (game as any).igdb_rating ??
                  null,
              }
            : null,
        };
      })
      .filter((row) => row.game);
  },
});
