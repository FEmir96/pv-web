// convex/mutations/authLogin.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

const DEFAULT_STATUS = "Activo";
const BANNED_STATUS = "Baneado";

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

    const status = (user as any).status ?? DEFAULT_STATUS;
    if (status === BANNED_STATUS) {
      return { ok: false, error: "ACCOUNT_BANNED" } as const;
    }

    if (!user.passwordHash) {
      return {
        ok: false,
        error:
          "La cuenta no tiene contrasena configurada. Prueba a ingresar con google/xbox o resetea tu contrasena.",
      } as const;
    }

    const match = bcrypt.compareSync(password, user.passwordHash);

    if (!match) {
      return { ok: false, error: "Credenciales invalidas" } as const;
    }

    const { _id, name, role, createdAt } = user as any;
    return {
      ok: true,
      profile: { _id, name, email: user.email, role, status, createdAt },
    } as const;
  },
});
