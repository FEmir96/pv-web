// convex/mutations/sweepExpirations.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";

async function ensurePlanExpiredNotification(ctx: any, userId: Id<"profiles">) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  // Dedupe: buscar alguna notificación reciente de plan-expired (últimas 24h)
  const recent: Doc<"notifications">[] = await ctx.db
    .query("notifications")
    .withIndex("by_user_createdAt", (q: any) =>
      q.eq("userId", userId).gte("createdAt", dayAgo)
    )
    .take(50);

  const hasRecent = recent.some((n: Doc<"notifications">) => n.type === "plan-expired");
  if (hasRecent) return;

  await ctx.db.insert("notifications", {
    userId,
    type: "plan-expired",
    title: "Tu Premium venció",
    message: "Tu cuenta pasó a Free. Puedes reactivar cuando quieras.",
    gameId: undefined,
    transactionId: undefined,
    isRead: false,
    readAt: undefined,
    createdAt: now,
    meta: {},
  });
}

async function downgradeProfile(ctx: any, userId: Id<"profiles">) {
  await ctx.db.patch(userId, {
    role: "free" as const,
    premiumPlan: undefined,
    premiumExpiresAt: undefined,
    premiumAutoRenew: undefined,
    trialEndsAt: undefined,
  });
  await ensurePlanExpiredNotification(ctx, userId);
}

export const sweepExpirations = mutation({
  // Args opcionales para no romper crons que llaman {}
  args: {
    batchSize: v.optional(v.number()),
    now: v.optional(v.number()),
    cursor: v.optional(v.number()), // opcional para paginar por expiresAt
  },
  handler: async (ctx, { batchSize, now, cursor }) => {
    const isDev = (process.env.CONVEX_DEPLOYMENT ?? "").startsWith("dev:");
    const disabled = process.env.DISABLE_SWEEP === "1";
    if (disabled) return { ok: true as const, disabled: true };

    const effectiveNow = now ?? Date.now();
    const effectiveBatch = isDev ? Math.min(batchSize ?? 300, 50) : (batchSize ?? 300);

    // 1) Tomamos SOLO suscripciones con expiresAt <= now, en orden asc.
    //    Usa índice by_expiresAt para evitar table-scan.
    const expiredSubs: Doc<"subscriptions">[] = await ctx.db
      .query("subscriptions")
      .withIndex("by_expiresAt", (q: any) =>
        cursor != null
          ? q.gt("expiresAt", cursor).lte("expiresAt", effectiveNow)
          : q.lte("expiresAt", effectiveNow)
      )
      .take(effectiveBatch);

    if (expiredSubs.length === 0) {
      return { ok: true as const, expiredCount: 0, continued: false };
    }

    // 2) Marcamos "expired" solo las que aún estén "active"
    const affectedUsers = new Set<Id<"profiles">>();
    for (const sub of expiredSubs) {
      if (sub.status !== "active") continue;
      await ctx.db.patch(sub._id, { status: "expired", updatedAt: effectiveNow });
      affectedUsers.add(sub.userId);
    }

    // 3) Por cada usuario afectado, si no quedan subs activas -> bajar a free
    for (const userId of affectedUsers) {
      const stillActive = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_status", (q: any) =>
          q.eq("userId", userId).eq("status", "active")
        )
        .take(1);

      if (stillActive.length === 0) {
        await downgradeProfile(ctx, userId);
      }
    }

    // 4) Si llenamos el lote, podemos re-encolar siguiente chunk con cursor.
    const continued = expiredSubs.length === effectiveBatch;
    const nextCursor = expiredSubs[expiredSubs.length - 1]!.expiresAt ?? undefined;

    return {
      ok: true as const,
      expiredCount: affectedUsers.size,
      continued,
      nextCursor,
      batch: effectiveBatch,
      now: effectiveNow,
    };
  },
});
