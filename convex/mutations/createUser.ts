// convex/mutations/createUser.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("free"), v.literal("premium"), v.literal("admin")),
    status: v.optional(v.union(v.literal("Activo"), v.literal("Baneado"))),
  },
  handler: async ({ db }, { name, email, password, role, status }) => {
    const normalizedEmail = email.trim().toLowerCase();

    const exists = await db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    if (exists) {
      return { ok: false, error: "El email ya esta registrado" } as const;
    }

    // Uso sincrono para evitar setTimeout interno (Convex no lo permite en mutaciones)
    const passwordHash = bcrypt.hashSync(password, 10);
    const finalStatus = status ?? "Activo";
    const createdAt = Date.now();
    const baseProfile: Record<string, unknown> = {
      name,
      email: normalizedEmail,
      role,
      status: finalStatus,
      createdAt,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/8.x/bottts-neutral/png?seed=${encodeURIComponent(
        normalizedEmail
      )}&radius=50&format=png`,
    };

    if (role === "premium") {
      const now = Date.now();
      const expires = now + 30 * 24 * 60 * 60 * 1000; // 30 días
      baseProfile.premiumSince = now;
      baseProfile.premiumExpiresAt = expires;
      baseProfile.premiumPlan = "monthly";
      baseProfile.premiumAutoRenew = false;
    }

    const _id = await db.insert("profiles", baseProfile as any);

    return {
      ok: true,
      profile: { _id, name, email: normalizedEmail, role, status: finalStatus, createdAt },
    } as const;
  },
});
