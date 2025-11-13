import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Devuelve las compras del usuario con datos mínimos del juego
 * (título y cover). Usa el mismo índice que ya tenés en `transactions`.
 */
export const getUserPurchases = query({
  args: { userId: v.id("profiles") },
  handler: async ({ db }, { userId }) => {
    // transactions: { userId, gameId, type: "purchase" | "rental", createdAt, ... }
    const txs = await db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "purchase"))
      .order("desc")
      .collect();

    const rows = await Promise.all(
      txs.map(async (t) => {
        const g = t.gameId ? await db.get(t.gameId) : null;
        return {
          _id: t._id,
          gameId: t.gameId ?? null,
          createdAt: t.createdAt,
          // por compatibilidad con el mapeo en React:
          game: g
            ? { _id: g._id, title: g.title ?? "", cover_url: (g as any).cover_url ?? "" }
            : undefined,
          title: g?.title ?? "",
          cover_url: (g as any)?.cover_url ?? "",
        };
      })
    );

    return rows;
  },
});
