// convex/mutations/authLogin.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const authLogin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async ({ db }, { email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!user) {
      return { ok: false, error: "Usuario no encontrado" } as const;
    }

    if ((user as any).status === "Baneado") {
      return { ok: false, error: "ACCOUNT_BANNED" } as const;
    }

    if (!user.passwordHash) {
      return {
        ok: false,
        error:
          "La cuenta no tiene contrasena configurada. Prueba a ingresar con google/xbox o resetea tu contrasena.",
      } as const;
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      return { ok: false, error: "Credenciales invalidas" } as const;
    }

    const { _id, name, role, createdAt, status } = user as any;
    return {
      ok: true,
      profile: { _id, name, email: user.email, role, status: status ?? "Activo", createdAt },
    } as const;
  },
});
