import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const deletePaymentMethod = mutation({
  args: { id: v.id("paymentMethods") },
  handler: async ({ db }, { id }) => {
    await db.delete(id);
    return { ok: true } as const;
  },
});
