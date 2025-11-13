import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

export const getUserLibrary = query({
  // opcional para poder “skipear” desde el front sin romper
  args: { userId: v.optional(v.id("profiles")) },
  handler: async (ctx, { userId }): Promise<Doc<"games">[]> => {
    if (!userId) return [];

    // 1) Traemos todas las transacciones del usuario
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (txs.length === 0) return [];

    // 2) Dedupe por gameId quedándonos con la transacción más reciente
    //    (así no repetimos el mismo juego por compras/renovaciones previas)
    const latestByGame = new Map<Id<"games">, number>(); // gameId -> _creationTime
    for (const t of txs) {
      const ct = (t as any)._creationTime as number; // _creationTime siempre existe en Convex
      const prev = latestByGame.get(t.gameId);
      if (prev === undefined || ct > prev) {
        latestByGame.set(t.gameId, ct);
      }
    }

    // 3) Ordenamos por transacción más reciente (opcional, queda lindo en la UI)
    const uniqueGameIds = [...latestByGame.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // 4) Resolución de documentos de juegos (filtramos nulls por si alguno fue borrado)
    const games = await Promise.all(uniqueGameIds.map((id) => ctx.db.get(id)));
    return games.filter((g): g is Doc<"games"> => !!g);
  },
});
