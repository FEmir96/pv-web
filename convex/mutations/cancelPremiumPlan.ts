// convex/mutations/cancelPremiumPlan.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Desactiva la renovación automática manteniendo el acceso premium vigente.
 */
export const cancelPremiumPlan = mutation({
  args: {
    userId: v.id("profiles"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { userId, reason }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");

    const now = Date.now();
    const currentRole = (user as any)?.role ?? "free";

    // Ajustar suscripción activa (solo marca auto-renew en falso)
    try {
      const actives = await (ctx.db as any)
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

      if (actives?.length) {
        const latest = actives.sort(
          (a: any, b: any) => (b.startAt ?? 0) - (a.startAt ?? 0)
        )[0];
        await (ctx.db as any).patch(latest._id, {
          autoRenew: false,
          updatedAt: now,
        });
      }
    } catch {}

    // Desactivar la renovación automática en el perfil
    await ctx.db.patch(userId, {
      premiumAutoRenew: false,
      trialEndsAt: undefined,
    });

    // Registrar evento en upgrades (sin cambiar rol)
    try {
      await (ctx.db as any).insert("upgrades", {
        userId,
        fromRole: currentRole,
        toRole: currentRole,
        status: "auto-renew-canceled",
        reason,
        createdAt: now,
        meta: { autoRenew: false },
      });
    } catch {}

    return {
      ok: true as const,
      role: currentRole as "free" | "premium" | "admin",
      autoRenew: false as const,
    };
  },
});
