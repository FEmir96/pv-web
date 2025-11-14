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
  },
  handler: async ({ db }, { name, email, password, role }) => {
    const normalizedEmail = email.trim().toLowerCase();

    const exists = await db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    if (exists) {
      return { ok: false, error: "El email ya está registrado" } as const;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const _id = await db.insert("profiles", {
      name,
      email: normalizedEmail,
      role,
      createdAt: Date.now(),
      passwordHash, // ✅ ahora sí
    });

    return {
      ok: true,
      profile: { _id, name, email: normalizedEmail, role, createdAt: Date.now() },
    } as const;
  },
});
