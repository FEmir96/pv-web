// convex/mutations/emitPlanRenewed.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const emitPlanRenewed = mutation({
  args: {
    userId: v.id("profiles"),
    subscriptionId: v.id("subscriptions"),
    plan: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annual"),
      v.literal("lifetime")
    ),
    newExpiresAt: v.optional(v.number()), // undefined para lifetime
  },
  handler: async ({ db }, { userId, subscriptionId, plan, newExpiresAt }) => {
    const now = Date.now();

    await db.insert("notifications", {
      userId: userId as Id<"profiles">,
      type: "plan-renewed",
      title: "¡Suscripción renovada!",
      message:
        plan === "lifetime"
          ? "Tu plan Lifetime quedó activo permanentemente."
          : "Tu suscripción se renovó correctamente.",
      isRead: false,
      readAt: undefined,
      createdAt: now,
      meta: { subscriptionId, plan, newExpiresAt },
    });

    return { ok: true as const };
  },
});
