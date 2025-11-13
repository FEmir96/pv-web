"use node";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

type DevSweepResult = { ok: boolean; expiredCount?: number; details?: unknown };

export const devSweepNow = action({
  args: {},
  handler: async (ctx, _args): Promise<DevSweepResult> => {
    const deployment = process.env.CONVEX_DEPLOYMENT || "";
    const isProd = deployment.startsWith("prod:");
    if (isProd) throw new Error("devSweepNow está deshabilitado en producción");

    const res: unknown = await ctx.runMutation(
      api.mutations.sweepExpirations.sweepExpirations,
      {}
    );
    if (res && typeof res === "object") return res as DevSweepResult;
    return { ok: true };
  },
});
