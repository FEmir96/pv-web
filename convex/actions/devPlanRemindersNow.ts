"use node";
// convex/actions/devPlanRemindersNow.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

type SendResult = { ok: true; sent: number; windows: number[] };

export const devPlanRemindersNow = action({
  args: { days: v.optional(v.array(v.number())) },
  handler: async (ctx, { days }): Promise<SendResult> => {
    const deployment = process.env.CONVEX_DEPLOYMENT || "";
    const isProd = deployment.startsWith("prod:");
    if (isProd) throw new Error("devPlanRemindersNow está deshabilitado en producción");

    const res = await ctx.runMutation(
      api.mutations.preExpiryReminders.sendPreExpiryReminders,
      { days }
    );
    return res as SendResult;
  },
});
