// convex/mutations/makePayment.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const makePayment = mutation({
  args: {
    userId: v.id("profiles"),
    amount: v.number(),
    currency: v.string(),            // ej: "USD" | "ARS"
    provider: v.optional(v.string()) // ej: "DummyPay" | "Stripe(sim)"
  },
  handler: async (ctx, { userId, amount, currency, provider }) => {
    const now = Date.now();
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");

    // Simulamos pago exitoso
    const paymentId = await ctx.db.insert("payments", {
      userId,
      amount,
      currency,
      status: "completed",
      provider,
      createdAt: now,
    });

    return { paymentId, status: "completed" as const };
  },
});
