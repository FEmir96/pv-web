// convex/lib/notifyTargets.ts
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";

/**
 * Devuelve los userIds a notificar para un juego:
 * - Usuarios que lo tienen en favoritos
 * - Usuarios con transacciones del juego
 * - Excluye (opcional) un userId (ej. admin que hizo el cambio)
 */
export async function collectTargetsForGame(
  db: DatabaseReader,
  gameId: Id<"games">,
  excludeUserId?: Id<"profiles">
): Promise<Id<"profiles">[]> {
  const targets = new Set<Id<"profiles">>();

  // Favoritos: no hay índice por gameId, filtramos en memoria
  const favs = await db.query("favorites").collect();
  for (const f of favs) {
    if (String(f.gameId) === String(gameId)) {
      targets.add(f.userId);
    }
  }

  // Transacciones: sí hay índice by_game
  const txs = await db
    .query("transactions")
    // Tipamos q como any para evitar el warning si la inferencia no entra
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  for (const t of txs) targets.add(t.userId);

  if (excludeUserId) targets.delete(excludeUserId);
  return Array.from(targets);
}

/**
 * Inserta notificaciones simples (una por usuario).
 */
export async function notifyUsers(
  db: DatabaseWriter,
  userIds: Id<"profiles">[],
  payload: {
    type:
      | "rental"
      | "new-game"
      | "discount"
      | "achievement"
      | "purchase"
      | "game-update";
    title: string;
    message: string;
    gameId?: Id<"games">;
    meta?: any;
  }
) {
  const now = Date.now();
  for (const userId of userIds) {
    await db.insert("notifications", {
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      gameId: payload.gameId,
      transactionId: undefined,
      isRead: false,
      readAt: undefined,
      createdAt: now,
      meta: payload.meta,
    });
  }
}
