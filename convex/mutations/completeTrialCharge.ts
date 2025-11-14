// convex/mutations/completeTrialCharge.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

type Plan = "monthly" | "quarterly" | "annual" | "lifetime";

const PLAN_PRICES: Record<Plan, number> = {
  monthly: 9.99,
  quarterly: 24.99,
  annual: 89.99,
  lifetime: 239.99,
};

const PLAN_MONTHS: Record<Plan, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
  lifetime: 0,
};

export const completeTrialCharge = mutation({
  args: {
    userId: v.id("profiles"),
    plan: v.string(),
    trialEndsAt: v.number(),
    subscriptionId: v.optional(v.id("subscriptions")),
  },
  handler: async (ctx, { userId, plan, trialEndsAt, subscriptionId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return { ok: false as const, reason: "user_not_found" as const };

    if ((user as any)?.role !== "premium") {
      return { ok: false as const, reason: "not_premium" as const };
    }

    if ((user as any)?.premiumAutoRenew === false) {
      return { ok: false as const, reason: "auto_renew_disabled" as const };
    }

    if ((user as any)?.trialEndsAt !== trialEndsAt) {
      return { ok: false as const, reason: "trial_mismatch" as const };
    }

    const now = Date.now();
    if (now < trialEndsAt) {
      return { ok: false as const, reason: "trial_not_finished" as const };
    }

    const normalizedPlan = (["monthly", "quarterly", "annual", "lifetime"] as Plan[]).includes(
      plan as Plan
    )
      ? (plan as Plan)
      : "monthly";

    const amount = PLAN_PRICES[normalizedPlan];
    const paymentId = await ctx.db.insert("payments", {
      userId,
      amount,
      currency: "USD",
      status: "completed",
      provider: "auto-trial",
      createdAt: now,
    });

    const months = PLAN_MONTHS[normalizedPlan];
    let expiresAt: number | undefined = undefined;
    let autoRenew = normalizedPlan !== "lifetime";

    if (months > 0) {
      const startDate = new Date(trialEndsAt);
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + months);
      expiresAt = end.getTime();
    } else {
      autoRenew = false;
    }

    await ctx.db.patch(userId, {
      premiumPlan: normalizedPlan,
      premiumExpiresAt: expiresAt,
      premiumAutoRenew: autoRenew,
      trialEndsAt: undefined,
    });

    if (subscriptionId) {
      try {
        await ctx.db.patch(subscriptionId, { status: "expired", updatedAt: now });
      } catch {}
    }

    await ctx.db.insert("subscriptions", {
      userId,
      plan: normalizedPlan,
      startAt: trialEndsAt,
      expiresAt,
      autoRenew,
      status: "active",
      paymentId,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await (ctx.db as any).insert("upgrades", {
        userId,
        fromRole: "premium",
        toRole: "premium",
        status: "trial-charged",
        paymentId,
        createdAt: now,
        meta: { plan: normalizedPlan },
      });
    } catch {}

    return { ok: true as const, paymentId, plan: normalizedPlan, expiresAt };
  },
});
