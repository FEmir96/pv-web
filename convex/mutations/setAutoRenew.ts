// convex/mutations/setAutoRenew.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

async function cancelActiveSubscriptions(ctx: any, userId: any, now: number) {
  try {
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", (q: any) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect();

    for (const sub of subs) {
      await ctx.db.patch(sub._id, { status: "canceled", updatedAt: now });
    }
  } catch {}
}

async function downgradeToFree(ctx: any, userId: any, now: number) {
  await cancelActiveSubscriptions(ctx, userId, now);
  await ctx.db.patch(userId, {
    role: "free" as const,
    premiumPlan: undefined,
    premiumExpiresAt: undefined,
    premiumAutoRenew: false,
    trialEndsAt: undefined,
  });
}

export const setAutoRenew = mutation({
  args: {
    userId: v.id("profiles"),
    autoRenew: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { userId, autoRenew, reason }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");

    const now = Date.now();
    const currentRole = (user as any)?.role ?? "free";
    const trialEndsAt =
      typeof (user as any)?.trialEndsAt === "number" ? (user as any).trialEndsAt : null;

    let downgraded = false;

    if (
      !autoRenew &&
      currentRole === "premium" &&
      trialEndsAt != null &&
      trialEndsAt > now
    ) {
      await downgradeToFree(ctx, userId, now);
      downgraded = true;
    } else {
      await ctx.db.patch(userId, { premiumAutoRenew: autoRenew });
    }

    try {
      const subs = await (ctx.db as any)
        .query("subscriptions")
        .filter((q: any) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.or(
              q.eq(q.field("status"), "active"),
              q.eq(q.field("status"), "canceled")
            )
          )
        )
        .collect();

      if (subs?.length) {
        const latest = subs.sort((a: any, b: any) => (b.startAt ?? 0) - (a.startAt ?? 0))[0];
        await (ctx.db as any).patch(latest._id, {
          autoRenew,
          updatedAt: now,
          ...(downgraded ? { status: "canceled" } : {}),
        });
      }
    } catch {}

    try {
      await (ctx.db as any).insert("upgrades", {
        userId,
        fromRole: currentRole,
        toRole: downgraded ? "free" : currentRole,
        status: autoRenew ? "auto-renew-activated" : "auto-renew-canceled",
        reason,
        createdAt: now,
        meta: { autoRenew, downgraded },
      });
    } catch {}

    return { ok: true, autoRenew, downgraded };
  },
});
