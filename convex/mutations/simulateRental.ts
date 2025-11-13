// convex/functions/mutations/simulateRental.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const simulateRental = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
    type: v.union(v.literal("rental"), v.literal("purchase")),
    durationHours: v.optional(v.number()),
  },
  handler: async ({ db }, { userId, gameId, type, durationHours }) => {
    const now = Date.now();
    let expiresAt = undefined;
    if (type === "rental" && durationHours && durationHours > 0) {
      expiresAt = now + durationHours * 60 * 60 * 1000;
    }
    const id = await db.insert("transactions", {
      userId,
      gameId,
      type,
      expiresAt,
      createdAt: now,
    });
    return { id, expiresAt };
  },
});
