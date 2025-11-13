"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

/** Estructura que retorna api.transactions.listRentalsExpiring */
type RentalExpiring = {
  _id: Id<"transactions">;
  userId: Id<"profiles">;
  gameId: Id<"games">;
  expiresAt: number;
};

type Result = { ok: true; processed: number };

/**
 * Programa recordatorios de alquiler por vencer.
 * - Busca alquileres con expiresAt ∈ [now, now + hoursAhead]
 * - Emite una notificación por alquiler
 *
 * Nota: Mensaje genérico (sin título de juego) para evitar dependencias a consultas extra.
 * Si luego querés enriquecer con título, lo hacemos con una query dedicada (p.ej. games.getTitleById).
 */
export const scheduleRentalExpiryReminders = action({
  args: {
    hoursAhead: v.optional(v.number()), // por defecto 48
  },
  handler: async (ctx, { hoursAhead }): Promise<Result> => {
    const now = Date.now();
    const windowHours = hoursAhead ?? 48;
    const upTo = now + windowHours * 60 * 60 * 1000;

    // Trae alquileres que vencen dentro de la ventana
    const expiring = (await ctx.runQuery(api.transactions.listRentalsExpiring, {
      now,
      upTo,
    })) as RentalExpiring[];

    if (!expiring.length) {
      return { ok: true, processed: 0 };
    }

    // Crea 1 notificación por alquiler que vence
    await Promise.all(
      expiring.map(async (r: RentalExpiring) => {
        const hoursLeft = Math.max(0, Math.ceil((r.expiresAt - now) / (60 * 60 * 1000)));

        await ctx.runMutation(api.notifications.add, {
          userId: r.userId,
          type: "rental",
          title: "Alquiler por vencer",
          message:
            hoursLeft > 0
              ? `Tu alquiler vence en aproximadamente ${hoursLeft} ${hoursLeft === 1 ? "hora" : "horas"}.`
              : "Tu alquiler está por vencer.",
          gameId: r.gameId,
          transactionId: r._id,
          meta: { expiresAt: r.expiresAt, hoursLeft },
        });
      })
    );

    return { ok: true, processed: expiring.length };
  },
});
