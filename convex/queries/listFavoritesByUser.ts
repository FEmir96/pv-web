import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const listFavoritesByUser = query({
  args: {
    userId: v.id("profiles"),
  },
  handler: async ({ db }, { userId }) => {
    // Si no tenés índice by_user, este filter funciona igual
    const favs = await db
      .query("favorites")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    // Enriquecemos cada favorito con datos básicos del juego
    const enriched = await Promise.all(
      favs.map(async (f) => {
        const game = await db.get(f.gameId as Id<"games">);
        return {
          _id: f._id,
          userId: f.userId,
          gameId: f.gameId,
          createdAt: f.createdAt,
          game: game
            ? {
                _id: game._id,
                title: (game as any).title,
                cover_url: (game as any).cover_url,
                plan: (game as any).plan,
              }
            : null,
        };
      })
    );

    // Orden opcional por fecha (más nuevos primero)
    enriched.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return enriched;
  },
});
