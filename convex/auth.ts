// convex/auth.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { sha256Hex } from "./lib/hash";
import { randomAvatarUrl } from "./lib/avatars";

const MIN_PASSWORD_LENGTH = 6;

export const updateProfile = mutation({
  args: {
    userId: v.id("profiles"),
    name: v.optional(v.string()),
    newPassword: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async ({ db }, { userId, name, newPassword, avatarUrl }) => {
    const current = await db.get(userId);
    if (!current) throw new Error("Perfil no encontrado");

    const patch: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim() && name !== current.name) {
      patch.name = name.trim();
    }
    if (typeof avatarUrl === "string" && avatarUrl !== (current as any).avatarUrl) {
      patch.avatarUrl = avatarUrl;
    }
    if (typeof newPassword === "string" && newPassword.length > 0) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error("La contraseña debe tener al menos 6 caracteres");
      }
      patch.passwordHash = bcrypt.hashSync(newPassword, 10);
    }
    if (Object.keys(patch).length > 0) {
      await db.patch(current._id, patch);
    }
    return { ok: true } as const;
  },
});

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
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = Date.now();
    const avatarUrl = randomAvatarUrl(normalizedEmail);
    const _id = await db.insert("profiles", {
      name,
      email: normalizedEmail,
      role,
      createdAt: now,
      passwordHash,
      freeTrialUsed: false,
      avatarUrl,
    });
    return { ok: true, profile: { _id, name, email: normalizedEmail, role, createdAt: now } } as const;
  },
});

export const authLogin = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async ({ db }, { email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!user) return { ok: false, error: "Usuario no encontrado" } as const;
    if (!user.passwordHash) {
      return { ok: false, error: "La cuenta no tiene contraseña configurada. Prueba a ingresar con google/xbox o reseteá tu contraseña." } as const;
    }
    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) return { ok: false, error: "Credenciales inválidas" } as const;

    const { _id, name, role, createdAt } = user;
    return { ok: true, profile: { _id, name, email: user.email, role, createdAt } } as const;
  },
});

// OAuth (Google/Xbox) upsert
export const oauthUpsert = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    provider: v.string(),
    providerId: v.optional(v.string()),
  },
  handler: async ({ db }, args) => {
    const email = args.email.toLowerCase();
    const existing = await db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!existing) {
      const fallbackAvatar = args.avatarUrl ?? randomAvatarUrl(email);
      const _id = await db.insert("profiles", {
        name: args.name ?? "",
        email,
        role: "free",
        createdAt: Date.now(),
        passwordHash: undefined,
        avatarUrl: fallbackAvatar,
        freeTrialUsed: false,
      });
      return { created: true, _id };
    }

    const patch: Record<string, unknown> = {};
    if (args.name && args.name !== existing.name) patch.name = args.name;
    const hasAvatar = Boolean((existing as any).avatarUrl && String((existing as any).avatarUrl).trim() !== "");
    if (!hasAvatar) {
      patch.avatarUrl = args.avatarUrl ?? randomAvatarUrl(email);
    }

    if (Object.keys(patch).length) {
      await db.patch(existing._id, patch);
    }
    return { created: false, _id: existing._id };
  },
});

export const createPasswordResetToken = mutation({
  args: {
    profileId: v.id("profiles"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    requestIp: v.optional(v.string()),
    requestUserAgent: v.optional(v.string()),
  },
  handler: async ({ db }, { profileId, tokenHash, expiresAt, requestIp, requestUserAgent }) => {
    const profile = await db.get(profileId);
    if (!profile) throw new Error("Perfil no encontrado");

    const now = Date.now();

    let existing: any[] = [];
    try {
      existing = await db
        .query("passwordResetTokens")
        .withIndex("by_profile", (q: any) => q.eq("profileId", profileId))
        .collect();
    } catch {
      const all = await db.query("passwordResetTokens").collect();
      existing = all.filter((t: any) => String(t.profileId) === String(profileId));
    }

    for (const token of existing) {
      if (!token.usedAt && (token.expiresAt ?? 0) > now) {
        await db.patch(token._id, { expiresAt: now - 1 });
      }
    }

    const finalExpires = Math.max(expiresAt, now + 5 * 60 * 1000);

    const tokenId = await db.insert("passwordResetTokens", {
      profileId,
      tokenHash,
      expiresAt: finalExpires,
      createdAt: now,
      requestIp,
      requestUserAgent,
    });

    return { ok: true as const, tokenId, expiresAt: finalExpires };
  },
});

export const resetPasswordWithToken = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async ({ db }, { token, newPassword }) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { ok: false as const, error: "weak_password" as const };
    }

    const tokenHash = await sha256Hex(token);
    let stored: any | null = null;

    try {
      stored = await db
        .query("passwordResetTokens")
        .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
        .unique();
    } catch {
      const all = await db.query("passwordResetTokens").collect();
      stored =
        all.find((t: any) => String(t.tokenHash) === tokenHash) ?? null;
    }

    if (!stored) return { ok: false as const, error: "invalid_token" as const };
    if (stored.usedAt) return { ok: false as const, error: "token_used" as const };
    if (stored.expiresAt <= Date.now()) {
      return { ok: false as const, error: "token_expired" as const, expiresAt: stored.expiresAt };
    }

    const profile = await db.get(stored.profileId);
    if (!profile) return { ok: false as const, error: "user_not_found" as const };

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.patch(profile._id, { passwordHash });
    await db.patch(stored._id, { usedAt: Date.now() });

    return { ok: true as const };
  },
});

export const changePassword = mutation({
  args: {
    userId: v.id("profiles"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async ({ db }, { userId, currentPassword, newPassword }) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { ok: false as const, error: "weak_password" as const };
    }

    const profile = await db.get(userId);
    if (!profile) throw new Error("Perfil no encontrado");
    if (!profile.passwordHash) {
      return { ok: false as const, error: "no_password" as const };
    }

    const matches = bcrypt.compareSync(currentPassword, profile.passwordHash);
    if (!matches) {
      return { ok: false as const, error: "invalid_current" as const };
    }

    const samePassword = bcrypt.compareSync(newPassword, profile.passwordHash);
    if (samePassword) {
      return { ok: false as const, error: "same_password" as const };
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.patch(userId, { passwordHash });

    return { ok: true as const };
  },
});

