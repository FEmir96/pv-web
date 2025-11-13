// convex/mutations/ensurePlanConsistency.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { notifyOnceServer } from "../notifications";

// Lógica compartida para ambas mutaciones
async function ensureForUserImpl(ctx: any, userId: Id<"profiles">) {
  const now = Date.now();
  const user = await ctx.db.get(userId);
  if (!user) return { ok: false as const, reason: "user not found" };

  // Si no hay plan o es lifetime, no hay nada que expirar
  if (!user.premiumPlan || user.premiumPlan === "lifetime") {
    return { ok: true as const, changed: false as const };
  }

  // Si ya venció, bajamos a free y marcamos subs vencidas
  if (user.premiumExpiresAt && user.premiumExpiresAt <= now) {
    await ctx.db.patch(userId, {
      role: "free",
      premiumPlan: undefined,
      premiumExpiresAt: undefined,
      premiumAutoRenew: undefined,
      trialEndsAt: undefined,
    });

    const activeSubs = await ctx.db
      .query("subscriptions")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    for (const sub of activeSubs) {
      if (sub.expiresAt && sub.expiresAt <= now) {
        await ctx.db.patch(sub._id, { status: "expired", updatedAt: now });
      }
    }

    await notifyOnceServer(ctx, {
      userId,
      type: "plan-expired",
      title: "Tu Premium venció",
      message: "Tu cuenta pasó a Free. Puedes reactivar cuando quieras.",
      meta: { expiredAt: user.premiumExpiresAt ?? now },
    });

    return { ok: true as const, changed: true as const, to: "free" as const };
  }

  return { ok: true as const, changed: false as const };
}

export const ensureForUser = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => ensureForUserImpl(ctx, userId),
});

export const ensureForEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();

    if (!profile) return { ok: false as const, reason: "user not found" };
    return ensureForUserImpl(ctx, profile._id as Id<"profiles">);
  },
});
