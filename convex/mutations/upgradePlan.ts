// convex/mutations/upgradePlan.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

type Plan = "monthly" | "quarterly" | "annual" | "lifetime";

export const upgradePlan = mutation({
  args: {
    userId: v.id("profiles"),
    toRole: v.union(v.literal("premium"), v.literal("free")),
    plan: v.optional(v.string()),           // "monthly" | "quarterly" | "annual" | "lifetime"
    trial: v.optional(v.boolean()),         // 7 días si true
    paymentId: v.optional(v.id("payments")) // link opcional
  },
  handler: async (ctx, { userId, toRole, plan, trial, paymentId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");

    const now = Date.now();
    const alreadyUsedTrial = Boolean((user as any)?.freeTrialUsed);
    const applyTrial = Boolean(trial && !alreadyUsedTrial);

    // 1) Cambiar rol si es distinto
    if (user.role !== toRole) {
      await ctx.db.patch(userId, { role: toRole });
    }

    // 2) Si toRole === "premium", setear expiración y registrar suscripción
    if (toRole === "premium") {
      const p: Plan = (plan as Plan) || "monthly";

      // Trial => +7 días antes de empezar el período
      const trialMs = applyTrial ? 7 * 24 * 60 * 60 * 1000 : 0;
      const trialEndsAt = applyTrial ? now + trialMs : undefined;
      const start = new Date(now);

      let expiresAt: number | undefined = undefined;
      let autoRenew = true;

      if (applyTrial && trialEndsAt) {
        expiresAt = trialEndsAt;
      } else if (p !== "lifetime") {
        const months = p === "annual" ? 12 : p === "quarterly" ? 3 : 1;
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        expiresAt = end.getTime();
      } else {
        autoRenew = false;
      }

      // Guardar en perfil (opcionales en schema)
      const profilePatch: Record<string, unknown> = {
        premiumPlan: p,
        premiumAutoRenew: autoRenew,
        premiumExpiresAt: expiresAt,
        trialEndsAt: trialEndsAt,
      };
      if (applyTrial) {
        profilePatch.freeTrialUsed = true;
      } else {
        profilePatch.trialEndsAt = undefined;
      }
      await (ctx.db as any).patch(userId, profilePatch);

      // Registrar suscripción (histórico)
      const subscriptionId = await (ctx.db as any).insert("subscriptions", {
        userId,
        plan: p,
        startAt: start.getTime(),
        expiresAt,
        autoRenew,
        status: "active",
        paymentId,
        createdAt: now,
        ...(trialMs > 0 ? { updatedAt: now } : {}),
      });

      // Dejar rastro en upgrades
      try {
        await (ctx.db as any).insert("upgrades", {
          userId,
          fromRole: user.role,
          toRole: "premium",
          effectiveAt: now,
          paymentId,
          status: "upgraded",
          createdAt: now,
          ...(applyTrial ? { meta: { trial: true } } : {}),
        });
      } catch {}

      if (applyTrial && trialEndsAt) {
        try {
          await ctx.scheduler?.runAt(
            trialEndsAt,
            (api as any).mutations.completeTrialCharge,
            { userId, plan: p, trialEndsAt, subscriptionId }
          );
        } catch {}
      }
    }

    return { ok: true, role: toRole, trialApplied: applyTrial };
  },
});
