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
    // normalizar email (opcional pero recomendable)
    const normalizedEmail = email.trim().toLowerCase();

    const user = await db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!user) {
      return { ok: false, error: "Usuario no encontrado" } as const;
    }

    // 👇 Si el usuario no tiene passwordHash (era viejo o no migrado), devolvemos error claro
    if (!user.passwordHash) {
      return {
        ok: false,
        error:
          "La cuenta no tiene contraseña configurada. Prueba a ingresar con google/xbox o reseteá tu contraseña.",
      } as const;
    }

    // En este punto TS ya sabe que passwordHash es string
    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      return { ok: false, error: "Credenciales inválidas" } as const;
    }

    // devolver perfil "seguro"
    const { _id, name, role, createdAt } = user;
    return {
      ok: true,
      profile: { _id, name, email: user.email, role, createdAt },
    } as const;
  },
});
