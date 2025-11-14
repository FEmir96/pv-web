// convex/actions/contact.ts
'use node';

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

import nodemailer from "nodemailer";
import { buildContactAdminEmail, buildContactUserEmail } from "../lib/emailTemplates";

// --- Mailer (permite override del "to") ---
async function sendWithNodemailer(opts: {
  subject: string;
  html: string;
  replyTo?: string;
  to?: string;
}): Promise<string> {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const from = process.env.MAIL_FROM || "no-reply@playverse.app";
  const defaultTo = process.env.CONTACT_TO || "playverse.ads@gmail.com";

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transport.sendMail({
    from,
    to: opts.to ?? defaultTo,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });

  return info.messageId;
}

/**
 * Acepta ambos formatos de payload:
 * - ES: { nombre, email, asunto, mensaje, userId?, userAgent?, appUrl? }
 * - EN: { name,   email, subject, message, profileId?: Id<"profiles"> | null, userAgent?, appUrl? }
 */
export const submitContact = action({
  args: {
    // Campos en ES (opcionales para tolerar el formato EN)
    nombre: v.optional(v.string()),
    asunto: v.optional(v.string()),
    mensaje: v.optional(v.string()),

    // Campos en EN (opcionales para tolerar el formato ES)
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    message: v.optional(v.string()),

    email: v.string(),

    // userId (preferido) o profileId (legacy / null)
    userId: v.optional(v.id("profiles")),
    profileId: v.optional(v.union(v.id("profiles"), v.null())),

    userAgent: v.optional(v.string()),
    appUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { ok: true; id: Id<"contactMessages">; messageId: string; receiptMessageId?: string }
    | { ok: false; id: Id<"contactMessages">; error: string }
  > => {
    // Normalizar nombres de campos
    const nombre  = (args.nombre  ?? args.name    ?? "").trim();
    const asunto  = (args.asunto  ?? args.subject ?? "").trim();
    const mensaje = (args.mensaje ?? args.message ?? "").trim();
    const email   = args.email.trim().toLowerCase();

    if (!nombre || !asunto || !mensaje || !email) {
      throw new Error("Faltan campos requeridos: nombre/asunto/mensaje/email.");
    }

    // Resolver profileId por email si no vino
    let resolvedProfileId: Id<"profiles"> | undefined =
      args.userId ?? (args.profileId ?? undefined);

    if (!resolvedProfileId) {
      try {
        const profile = await ctx.runQuery(
          api.queries.getUserByEmail.getUserByEmail,
          { email }
        );
        if (profile?._id) resolvedProfileId = profile._id as Id<"profiles">;
      } catch {
        // externo: sin profileId
      }
    }

    const createdAt = Date.now();

    // 1) Guardar contacto
    const id = await ctx.runMutation(api.mutations.contact.createMessage, {
      name: nombre,
      email,
      subject: asunto,
      message: mensaje,
      ...(resolvedProfileId ? { profileId: resolvedProfileId } : {}),
      ...(args.userAgent ? { userAgent: args.userAgent } : {}),
      createdAt,
    });

    // 2) Email a admin (SIN user-agent)
    const adminHtml = buildContactAdminEmail({
      name: nombre,
      email,
      subject: asunto,
      message: mensaje,
      createdAt,
      appUrl: args.appUrl ?? null,
    });

    try {
      const messageId = await sendWithNodemailer({
        subject: `[Contacto] ${asunto}`,
        html: adminHtml,
        replyTo: email,
      });

      await ctx.runMutation(api.mutations.contact.updateStatus, {
        id,
        status: "sent",
      });

      // 3) Acuse al usuario (best-effort)
      let receiptMessageId: string | undefined;
      try {
        const receiptHtml = buildContactUserEmail({
          name: nombre,
          subject: asunto,
          message: mensaje,
          appUrl: args.appUrl ?? null,
        });

        receiptMessageId = await sendWithNodemailer({
          to: email,
          subject: "¡Gracias por contactarte con PlayVerse!",
          html: receiptHtml,
          replyTo: process.env.CONTACT_TO ?? undefined,
        });
      } catch {
        // no corta el flujo
      }

      return { ok: true, id, messageId, receiptMessageId };
    } catch (e: any) {
      await ctx.runMutation(api.mutations.contact.updateStatus, {
        id,
        status: "queued",
      });
      return { ok: false, id, error: e?.message ?? "email_failed" };
    }
  },
});
