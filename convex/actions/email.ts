"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import nodemailer from "nodemailer";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function normalizeFrom(raw?: string) {
  const s = (raw ?? "").trim().replace(/\s{2,}/g, " ");
  if (!s) return "";
  // "Nombre <mail@dominio>" o solo mail
  if (/^.+<[^>]+>$/.test(s) || /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(s)) return s;
  const parts = s.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  if (/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(last)) {
    const name = parts.slice(0, -1).join(" ").trim() || "PlayVerse";
    return `${name} <${last}>`;
  }
  return s;
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = (process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || "465");
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  if (!host || !port || !user || !pass) {
    throw new Error("Faltan variables SMTP_* en Convex (SMTP_HOST/PORT/USER/PASS)");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // Gmail: 465 = SSL
    auth: { user, pass },
  });

  return cachedTransporter;
}

function parseList(raw?: string) {
  return (raw || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveCopyRecipients(from: string) {
  const envSources = [
    process.env.MAIL_COPY,
    process.env.MAIL_BCC,
    process.env.MAIL_ADMIN,
  ];
  for (const source of envSources) {
    const parsed = parseList(source);
    if (parsed.length) return parsed;
  }

  const match = from.match(/<([^>]+)>/);
  const email = match ? match[1] : from;
  if (/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(email)) return [email];
  return [];
}

export const sendReceiptEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    replyTo: v.optional(v.string()),
  },
  handler: async (_ctx, { to, subject, html, replyTo }) => {
    const transporter = getTransporter();

    const from =
      normalizeFrom(process.env.MAIL_FROM) ||
      normalizeFrom(process.env.SMTP_USER) ||
      "PlayVerse <no-reply@playverse.com>";

    const copyRecipients = resolveCopyRecipients(from).filter(
      (addr) => addr.toLowerCase() !== to.toLowerCase()
    );

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      replyTo: replyTo?.trim() || undefined,
      bcc: copyRecipients.length ? copyRecipients : undefined,
    });

    return { ok: true as const, messageId: info.messageId, to, subject };
  },
});
