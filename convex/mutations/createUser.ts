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

    const passwordHash = await bcrypt.hash(password, 10);
    const finalStatus = status ?? "Activo";
    const createdAt = Date.now();

    const _id = await db.insert("profiles", {
      name,
      email: normalizedEmail,
      role,
      status: finalStatus,
      createdAt,
      passwordHash,
    });

    return {
      ok: true,
      profile: { _id, name, email: normalizedEmail, role, status: finalStatus, createdAt },
    } as const;
  },
});
