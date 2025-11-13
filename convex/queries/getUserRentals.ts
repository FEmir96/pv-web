// convex/queries/getUserRentals.ts  (opcional, igual a la tuya pero con 2 passthrough defensivos)
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserRentals = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    const rentals = await ctx.db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "rental"))
      .collect();

    const rows = await Promise.all(
      rentals.map(async (r) => {
        const game = await ctx.db.get(r.gameId);
        return {
          _id: r._id,
          gameId: r.gameId,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt ?? null,
          // passthrough defensivo (si alguna vez agregás estos campos)
          status: (r as any).status ?? undefined,
          returnedAt: (r as any).returnedAt ?? (r as any).returned_at ?? undefined,

          title: (game as any)?.title,
          cover_url: (game as any)?.cover_url,
          game: game
            ? { _id: game._id, title: (game as any).title, cover_url: (game as any).cover_url }
            : undefined,
        };
      })
    );

    return rows;
  },
});
