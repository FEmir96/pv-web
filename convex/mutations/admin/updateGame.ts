// convex/mutations/admin/updateGame.ts  (wrapper panel admin)
// Detecta cambios por campo y crea notificaciones en la tabla `notifications`
// para los roles correspondientes y para el admin que realizó el cambio.

import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { updateGameCore } from "../../lib/gameCore";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const PatchValidator = v.object({
  title: v.optional(v.union(v.string(), v.null())),
  description: v.optional(v.union(v.string(), v.null())),
  cover_url: v.optional(v.union(v.string(), v.null())),
  trailer_url: v.optional(v.union(v.string(), v.null())),
  extraTrailerUrl: v.optional(v.union(v.string(), v.null())),
  extraImages: v.optional(v.array(v.string())),
  genres: v.optional(v.array(v.string())),

  purchasePrice: v.optional(v.union(v.float64(), v.string(), v.null())),
  weeklyPrice: v.optional(v.union(v.float64(), v.string(), v.null())),

  embed_url: v.optional(v.union(v.string(), v.null())),
  embed_allow: v.optional(v.union(v.string(), v.null())),
  embed_sandbox: v.optional(v.union(v.string(), v.null())),

  plan: v.optional(v.union(v.literal("free"), v.literal("premium"))),
});

function equalish(a: any, b: any) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    try { return JSON.stringify(a || []) === JSON.stringify(b || []); } catch { return false; }
  }
  if (typeof a === "object" || typeof b === "object") {
    try { return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {}); } catch { return false; }
  }
  const an = Number(a), bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an === bn;
  return String(a ?? "") === String(b ?? "");
}

function moneyLabel(v: any) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  try { return n.toLocaleString("en-US", { style: "currency", currency: "USD" }); } catch { return `$${n.toFixed(2)}`; }
}

export const updateGame = mutation({
  args: {
    gameId: v.id("games"),
    requesterId: v.optional(v.id("profiles")),

    title: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    cover_url: v.optional(v.union(v.string(), v.null())),
    trailer_url: v.optional(v.union(v.string(), v.null())),
    extraTrailerUrl: v.optional(v.union(v.string(), v.null())),
    extraImages: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    purchasePrice: v.optional(v.union(v.float64(), v.string(), v.null())),
    weeklyPrice: v.optional(v.union(v.float64(), v.string(), v.null())),
    embed_url: v.optional(v.union(v.string(), v.null())),
    embed_allow: v.optional(v.union(v.string(), v.null())),
    embed_sandbox: v.optional(v.union(v.string(), v.null())),
    plan: v.optional(v.union(v.literal("free"), v.literal("premium"))),

    patch: v.optional(PatchValidator),
  },
  handler: async ({ db, scheduler }, args) => {
    const { patch, ...top } = args as any;
    const merged = patch ? { ...top, ...patch } : top;

    const before = await db.get(args.gameId);
    const result = await updateGameCore(db, merged);
    const after = await db.get(args.gameId);

    const watchedFields = [
      "title","description","cover_url","trailer_url","extraTrailerUrl","extraImages","genres",
      "purchasePrice","weeklyPrice","embed_url","embed_allow","embed_sandbox","plan"
    ];

    const changes = [];
    for (const f of watchedFields) {
      const b = before ? (before as any)[f] : undefined;
      const a = after ? (after as any)[f] : undefined;
      if (!equalish(b, a)) changes.push({ field: f, before: b, after: a });
    }

    if (changes.length === 0) return result;

    const now = Date.now();

    const planFinal = (after as any)?.plan ?? (before as any)?.plan ?? "free";
    const roleTargets = planFinal === "premium"
      ? ["premium", "admin"]
      : ["free", "premium", "admin"];

    // Obtenemos todos los usuarios con esos roles
    const usersToNotify = await db
      .query("profiles")
      .filter(q => q.or(...roleTargets.map(role => q.eq(q.field("role"), role))))
      .collect();

    for (const change of changes) {
      const f = change.field;
      let titleMsg = `Actualización: ${(after as any)?.title ?? (before as any)?.title ?? "Juego"}`;
      let message = `Se actualizó ${f}.`;

      if (f === "purchasePrice") {
        titleMsg = `Precio de compra actualizado: ${(after as any)?.title ?? (before as any)?.title ?? "Juego"}`;
        message = `Precio compra: ${moneyLabel(change.before)} → ${moneyLabel(change.after)}`;
      } else if (f === "weeklyPrice") {
        titleMsg = `Precio de alquiler actualizado: ${(after as any)?.title ?? (before as any)?.title ?? "Juego"}`;
        message = `Precio alquiler: ${moneyLabel(change.before)} → ${moneyLabel(change.after)}`;
      } else if (f === "description") {
        titleMsg = `Descripción actualizada: ${(after as any)?.title ?? (before as any)?.title ?? "Juego"}`;
        message = `Se actualizó la descripción del juego.`;
      }

      // ✅ Insertamos notificación para cada usuario del rol correspondiente
      for (const user of usersToNotify) {
        await db.insert("notifications", {
          userId: user._id,
          type: "game-update",
          title: titleMsg,
          message,
          gameId: args.gameId,
          transactionId: undefined,
          isRead: false,
          readAt: undefined,
          createdAt: now,
          meta: {
            field: f,
            before: change.before,
            after: change.after,
            updatedBy: args.requesterId ?? null,
          },
        });
      }

      // ✅ También insertamos notificación instantánea al ADMIN que hizo el cambio
      if (args.requesterId) {
        await db.insert("notifications", {
          userId: args.requesterId,
          type: "game-update",
          title: titleMsg,
          message,
          gameId: args.gameId,
          transactionId: undefined,
          isRead: false,
          readAt: undefined,
          createdAt: now,
          meta: {
            field: f,
            before: change.before,
            after: change.after,
            updatedBy: args.requesterId ?? null,
          },
        });

        // 📌 Opcional: enviar push instantáneo al admin
        if (scheduler) {
          scheduler.runAfter(0, api.actions.pushy.sendToProfile, {
            profileId: args.requesterId,
            title: titleMsg,
            message,
            data: { type: "game-update", meta: { gameId: String(args.gameId), field: f } },
          }).catch(err => console.error(err));
        }
      }
    }

    return result;
  },
});
