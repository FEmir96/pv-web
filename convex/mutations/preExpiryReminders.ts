// convex/mutations/preExpiryReminders.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysLeftRounded(expiresAt: number, now = Date.now()) {
  // Redondeo al día más cercano (±12h de tolerancia)
  return Math.round((expiresAt - now) / MS_PER_DAY);
}

async function alreadySentForWindow(
  db: any,
  userId: Id<"profiles">,
  expiresAt: number,
  dayWindow: number
) {
  // Intentamos usar el índice ["userId","createdAt"]; si no existe, hacemos fallback.
  let rows: any[] = [];
  try {
    rows = await db
      .query("notifications")
      .withIndex("by_user_createdAt", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(200);
  } catch {
    const all = await db.query("notifications").collect();
    rows = all
      .filter((n: any) => String(n.userId) === String(userId))
      .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 200);
  }

  return rows.some(
    (n: any) =>
      n.type === "plan-expiring" &&
      n.meta &&
      Number(n.meta.expiresAt) === Number(expiresAt) &&
      Number(n.meta.days) === Number(dayWindow)
  );
}

export const sendPreExpiryReminders = mutation({
  args: { days: v.optional(v.array(v.number())) },
  handler: async ({ db }, { days }) => {
    // Ventanas por defecto si no pasan nada
    const windows = (days && days.length ? days : [7, 3, 1])
      .map((d) => Math.floor(d))
      .filter((d) => d >= 0);

    const profiles = await db.query("profiles").collect();
    const now = Date.now();
    let sent = 0;

    for (const p of profiles) {
      // Consideramos perfiles premium no-lifetime
      if (p.role !== "premium") continue;
      if (p.premiumPlan === "lifetime") continue;

      // Candidatos de expiración: profile y/o subscriptions activas
      const expiries: number[] = [];
      if (p.premiumExpiresAt) expiries.push(Number(p.premiumExpiresAt));

      // Buscamos suscripciones activas del usuario (si hay tabla de subscriptions)
      try {
        const subsAll = await db.query("subscriptions").collect();
        const actives = subsAll.filter(
          (s: any) =>
            String(s.userId) === String(p._id) &&
            s.status === "active" &&
            s.plan !== "lifetime" &&
            s.expiresAt
        );
        for (const s of actives) expiries.push(Number(s.expiresAt));
      } catch {
        // Si no existe la tabla/índices, simplemente seguimos con premiumExpiresAt del perfil
      }

      if (!expiries.length) continue;

      // Tomamos el vencimiento más próximo (el menor mayor que 'now')
      const future = expiries.filter((ts) => ts > now);
      if (!future.length) continue;
      const expiresAt = Math.min(...future);

      const dl = daysLeftRounded(expiresAt, now); // redondeo al día más cercano
      if (!windows.includes(dl)) continue;

      // Evitar duplicados: si ya enviamos para este (user, expiresAt, window), no repetir
      const exists = await alreadySentForWindow(db, p._id, expiresAt, dl);
      if (exists) continue;

      await db.insert("notifications", {
        userId: p._id as Id<"profiles">,
        type: "plan-expiring",
        title: "Tu plan está por vencer",
        message:
          dl === 0
            ? "Tu suscripción vence hoy."
            : `Tu suscripción vence en ${dl} día${dl === 1 ? "" : "s"}.`,
        gameId: undefined,
        transactionId: undefined,
        isRead: false,
        readAt: undefined,
        createdAt: now,
        meta: { expiresAt, days: dl },
      });

      sent++;
    }

    return { ok: true as const, sent, windows };
  },
});
