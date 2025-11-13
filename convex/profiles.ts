// convex/profiles.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Devuelve un perfil por email (o null si no existe)
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    return user; // puede ser null si no existe
  },
});
