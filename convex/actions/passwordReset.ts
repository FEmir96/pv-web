"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import { buildPasswordResetEmail } from "../lib/emailTemplates";

const RESET_EXPIRATION_MS = 60 * 60 * 1000; // 60 minutos

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP no configurado (faltan SMTP_HOST/PORT/USER/PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function resolveBaseUrl(appUrl?: string | null): string {
  const envUrl = (process.env.APP_URL || "").trim();
  const candidate = (appUrl || envUrl || "https://playverse.app").trim();
  if (!candidate) return "https://playverse.app";
  if (/^https?:\/\//i.test(candidate)) return candidate;
  return `https://${candidate.replace(/^\/+/, "")}`;
}

function randomToken(): string {
  return randomBytes(48)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export const requestPasswordReset = action({
  args: {
    email: v.string(),
    appUrl: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { email, appUrl, ip, userAgent }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { ok: false as const, error: "invalid_email" as const };
    }

    let profile: any = null;
    try {
      profile = await ctx.runQuery(api.queries.getUserByEmail.getUserByEmail, {
        email: normalizedEmail,
      });
    } catch {
      profile = null;
    }

    if (!profile?._id) {
      return { ok: false as const, error: "not_found" as const };
    }

    const token = randomToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = Date.now() + RESET_EXPIRATION_MS;

    await ctx.runMutation(api.auth.createPasswordResetToken, {
      profileId: profile._id,
      tokenHash,
      expiresAt,
      requestIp: ip,
      requestUserAgent: userAgent,
    });

    const baseUrl = resolveBaseUrl(appUrl);
    const resetUrl = new URL("/auth/reset-password", baseUrl);
    resetUrl.searchParams.set("token", token);
    resetUrl.searchParams.set("email", normalizedEmail);

    const html = buildPasswordResetEmail({
      name: profile.name,
      resetUrl: resetUrl.toString(),
      expiresMinutes: Math.round(RESET_EXPIRATION_MS / (60 * 1000)),
      appUrl: baseUrl,
    });

    const transporter = createTransport();
    const from =
      process.env.MAIL_FROM?.trim() ||
      process.env.SMTP_USER?.trim() ||
      "PlayVerse <no-reply@playverse.app>";

    try {
      await transporter.sendMail({
        from,
        to: normalizedEmail,
        subject: "Restablece tu contraseña de PlayVerse",
        html,
      });
      return { ok: true as const, expiresAt };
    } catch (error: any) {
      return {
        ok: false as const,
        error: error?.message ?? "send_failed",
      };
    }
  },
});
