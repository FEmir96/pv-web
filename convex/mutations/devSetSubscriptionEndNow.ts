import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const devSetSubscriptionEndNow = mutation({
  args: {
    userId: v.id("profiles"),
    /**
     * Opcional: segundos desde ahora para fijar el vencimiento.
     * Ej.: 30 => expira en 30s (útil para probar el sweep).
     * Si no lo pasas, expira "ahora".
     */
    offsetSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Guard para que NO se ejecute en producción real
    const deployment = process.env.CONVEX_DEPLOYMENT || "";
    const isProd = deployment.startsWith("prod:");
    if (isProd) {
      throw new Error("devSetSubscriptionEndNow está deshabilitado en producción");
    }

    const now = Date.now();
    const expiresAt = now + (args.offsetSeconds ?? 0) * 1000;

    // Asegura que el usuario existe
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error(`Usuario ${args.userId} no existe`);
    }

    // Busca una suscripción ACTIVA del usuario
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", q =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (!sub) {
      return { ok: false, reason: "No active subscription found" as const };
    }

    // Marca el vencimiento y desactiva autorenovación
    await ctx.db.patch(sub._id, {
      expiresAt,
      status: expiresAt <= now ? "expired" : "active",
      autoRenew: false,
      updatedAt: now,
    });

    // Refleja en el perfil (campos cacheados)
    await ctx.db.patch(args.userId, {
      premiumPlan: sub.plan,
      premiumExpiresAt: expiresAt,
      premiumAutoRenew: false,
    });

    // Notificación amistosa
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "plan-expired",
      title: "Tu plan fue marcado para expirar",
      message:
        expiresAt <= now
          ? "Tu suscripción fue marcada como expirada."
          : "Tu suscripción fue marcada para expirar pronto.",
      isRead: false,
      createdAt: now,
      meta: { plan: sub.plan, expiresAt },
    });

    return { ok: true, expiresAt };
  },
});
