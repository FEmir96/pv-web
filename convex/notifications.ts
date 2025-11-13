// convex/notifications.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/* ─────────────────────────────────────────────
   Tipos y validadores compartidos
   ───────────────────────────────────────────── */
const NotificationTypeV = v.union(
  v.literal("rental"),
  v.literal("new-game"),
  v.literal("discount"),
  v.literal("achievement"),
  v.literal("purchase"),
  v.literal("game-update"),
  v.literal("plan-expired"),
  v.literal("plan-renewed")
);
export type NotificationType =
  | "rental"
  | "new-game"
  | "discount"
  | "achievement"
  | "purchase"
  | "game-update"
  | "plan-expired"
  | "plan-renewed";

/* ─────────────────────────────────────────────
   Helpers internos (índices y límites)
   ───────────────────────────────────────────── */
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Intenta enviar push vía actions/pushy.sendToProfile si hay scheduler disponible.
 * No debe bloquear la creación de la notificación en DB: cualquier fallo queda en try/catch.
 */
async function schedulePushNotification(
  scheduler: any,
  payload: {
    userId: Id<"profiles">;
    notificationId: Id<"notifications"> | undefined;
    title: string;
    message: string;
    type: NotificationType;
    meta?: unknown;
  }
) {
  if (!scheduler) return;
  try {
    await scheduler.runAfter(0, api.actions.pushy.sendToProfile, {
      profileId: payload.userId,
      title: payload.title,
      message: payload.message,
      data:
        payload.meta && typeof payload.meta === "object"
          ? { type: payload.type, meta: payload.meta }
          : { type: payload.type },
    });
  } catch (error) {
    // No rompemos el flujo si push falla
    console.error("schedulePushNotification error (pushy)", error);
  }
}

/* ─────────────────────────────────────────────
   notifyOnceServer: inserta notificación única (evita duplicados recientes)
   ───────────────────────────────────────────── */
export async function notifyOnceServer(
  ctx: { db: any; scheduler?: any },
  args: {
    userId: Id<"profiles">;
    type: NotificationType;
    title: string;
    message: string;
    meta?: unknown;
    dedupeWindowMs?: number; // 10 minutos por defecto
  }
) {
  const { db, scheduler } = ctx;
  const { userId, type, title, message, meta, dedupeWindowMs = 10 * 60 * 1000 } = args;
  const since = Date.now() - dedupeWindowMs;

  let recent: any | null = null;
  try {
    recent = await db
      .query("notifications")
      .withIndex("by_user_createdAt", (q: any) => q.eq("userId", userId).gte("createdAt", since))
      .filter((q: any) => q.eq(q.field("type"), type))
      .first();
  } catch {
    const scan = await db.query("notifications").collect();
    recent = scan
      .filter((n: any) => String(n.userId) === String(userId) && n.createdAt >= since && n.type === type)
      .sort((a: any, b: any) => b.createdAt - a.createdAt)[0];
  }

  if (recent) {
    return { ok: true as const, skipped: true as const, id: recent._id };
  }

  const id = await db.insert("notifications", {
    userId,
    type,
    title,
    message,
    gameId: undefined,
    transactionId: undefined,
    isRead: false,
    readAt: undefined,
    createdAt: Date.now(),
    meta,
  });

  // Intento de push asíncrono; no parcheamos profiles (evitamos schema-breaches)
  await schedulePushNotification(scheduler, {
    userId,
    notificationId: id,
    title,
    message,
    type,
    meta,
  });

  return { ok: true as const, skipped: false as const, id };
}

/* ─────────────────────────────────────────────
   Helpers de lectura
   ───────────────────────────────────────────── */
async function getRowsForUser(db: any, userId: Id<"profiles">, limit: number) {
  try {
    return await db
      .query("notifications")
      .withIndex("by_user_createdAt", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  } catch {
    const all = await db.query("notifications").collect();
    return all
      .filter((n: any) => String(n.userId) === String(userId))
      .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, limit);
  }
}

async function getUnreadForUser(db: any, userId: Id<"profiles">) {
  try {
    return await db
      .query("notifications")
      .withIndex("by_user_isRead", (q: any) => q.eq("userId", userId).eq("isRead", false))
      .collect();
  } catch {
    const all = await db.query("notifications").collect();
    return all.filter((n: any) => String(n.userId) === String(userId) && n.isRead === false);
  }
}

/* ─────────────────────────────────────────────
   Mutations públicas (API)
   ───────────────────────────────────────────── */

/** Crear una notificación personal */
export const add = mutation({
  args: {
    userId: v.id("profiles"),
    type: NotificationTypeV,
    title: v.string(),
    message: v.string(),
    gameId: v.optional(v.id("games")),
    transactionId: v.optional(v.id("transactions")),
    meta: v.optional(v.any()),
  },
  handler: async ({ db, scheduler }, a) => {
    const now = Date.now();
    const id = await db.insert("notifications", {
      userId: a.userId,
      type: a.type,
      title: a.title,
      message: a.message,
      gameId: a.gameId ?? undefined,
      transactionId: a.transactionId ?? undefined,
      isRead: false,
      readAt: undefined,
      createdAt: now,
      meta: a.meta,
    });

    // intentamos push (no obligatorio)
    try {
      await schedulePushNotification(scheduler, {
        userId: a.userId,
        notificationId: id,
        title: a.title,
        message: a.message,
        type: a.type,
        meta: a.meta,
      });
    } catch (err) {
      console.error("add notification schedulePush failed", err);
    }

    return { ok: true as const, id };
  },
});

/** notifyOnce wrapper */
export const notifyOnce = mutation({
  args: {
    userId: v.id("profiles"),
    type: NotificationTypeV,
    title: v.string(),
    message: v.string(),
    meta: v.optional(v.any()),
    dedupeWindowMs: v.optional(v.number()),
  },
  handler: async ({ db, scheduler }, args) => {
    const res = await notifyOnceServer({ db, scheduler }, args as any);
    return res;
  },
});

/** Marcar como leída.
 *  Si se pasa notificationId marca solo esa; si no, marca todas no leídas para el user.
 *  (Arregla error de validación que pasaba notificationId en la llamada)
 */
export const markAsRead = mutation({
  args: {
    userId: v.id("profiles"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async ({ db }, { userId, notificationId }) => {
    if (notificationId) {
      const n = await db.get(notificationId);
      if (!n) return { ok: false as const, reason: "not_found" as const };
      if (String(n.userId) !== String(userId)) return { ok: false as const, reason: "forbidden" as const };
      if (!n.isRead) {
        await db.patch(notificationId, { isRead: true, readAt: Date.now() });
        return { ok: true as const, updated: true };
      }
      return { ok: true as const, updated: false };
    }

    // Sin notificationId: marcar todas no leídas
    const unread = await getUnreadForUser(db, userId);
    let count = 0;
    for (const n of unread) {
      await db.patch(n._id, { isRead: true, readAt: Date.now() });
      count++;
    }
    return { ok: true as const, updated: count };
  },
});

/** Marcar todas como leídas (existía una llamada a esta mutación y faltaba) */
export const markAllAsRead = mutation({
  args: {
    userId: v.id("profiles"),
  },
  handler: async ({ db }, { userId }) => {
    const unread = await getUnreadForUser(db, userId);
    let count = 0;
    for (const n of unread) {
      await db.patch(n._id, { isRead: true, readAt: Date.now() });
      count++;
    }
    return { ok: true as const, updated: count };
  },
});

/** Limpiar todas las notificaciones del usuario */
export const clearAllForUser = mutation({
  args: { userId: v.id("profiles") },
  handler: async ({ db }, { userId }) => {
    let all: any[] = [];
    try {
      all = await db
        .query("notifications")
        .withIndex("by_user_createdAt", (q: any) => q.eq("userId", userId))
        .collect();
    } catch {
      const scan = await db.query("notifications").collect();
      all = scan.filter((n: any) => String(n.userId) === String(userId));
    }

    for (const n of all) {
      await db.delete(n._id);
    }
    return { ok: true as const, deleted: all.length };
  },
});

/** Eliminar una notificación puntual del usuario */
export const deleteById = mutation({
  args: { userId: v.id("profiles"), notificationId: v.id("notifications") },
  handler: async ({ db }, { userId, notificationId }) => {
    const n = await db.get(notificationId);
    if (!n) return { ok: false as const, reason: "not_found" as const };
    if (String(n.userId) !== String(userId)) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    await db.delete(notificationId);
    return { ok: true as const, deleted: true };
  },
});

/* ─────────────────────────────────────────────
   Queries
   ───────────────────────────────────────────── */

/** Trae notificaciones del usuario (desc por fecha) */
export const getForUser = query({
  args: {
    userId: v.id("profiles"),
    limit: v.optional(v.number()),
  },
  handler: async ({ db }, { userId, limit }) => {
    const take = clamp(limit ?? 50, 1, 200);
    const rows = await getRowsForUser(db, userId, take);
    return rows;
  },
});

/** Contador de no leídas */
export const getUnreadCount = query({
  args: { userId: v.id("profiles") },
  handler: async ({ db }, { userId }) => {
    const unread = await getUnreadForUser(db, userId);
    return unread.length;
  },
});