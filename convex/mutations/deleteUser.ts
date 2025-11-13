// convex/functions/mutations/deleteUser.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const deleteUser = mutation({
  args: {
    requesterId: v.id("profiles"),     // debe ser admin
    userId: v.id("profiles"),          // usuario a eliminar
    force: v.optional(v.boolean()),    // si true, borra relaciones
  },
  handler: async ({ db }, { requesterId, userId, force }) => {
    // 1) Permisos
    const requester = await db.get(requesterId);
    if (!requester || requester.role !== "admin") {
      throw new Error("No autorizado. Solo admin puede eliminar usuarios.");
    }
    if (String(requesterId) === String(userId)) {
      throw new Error("Un admin no puede eliminarse a sí mismo.");
    }

    // 2) Usuario objetivo
    const user = await db.get(userId);
    if (!user) throw new Error("Usuario no encontrado.");

    // 3) Buscar referencias relacionadas
    const [txs, pays, ups] = await Promise.all([
      db.query("transactions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      db.query("payments").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      db.query("upgrades").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    const refs = {
      transactions: txs.length,
      payments: pays.length,
      upgrades: ups.length,
    };
    const hasRefs = refs.transactions + refs.payments + refs.upgrades > 0;

    if (hasRefs && !force) {
      return {
        deleted: false,
        needsForce: true,
        refs,
        message:
          "El usuario tiene registros relacionados. Reintenta con force=true para borrado definitivo.",
      };
    }

    // 4) Cascada si force === true
    if (force) {
      for (const r of txs) await db.delete(r._id);
      for (const r of pays) await db.delete(r._id);
      for (const r of ups) await db.delete(r._id);
    }

    // 5) Eliminar usuario
    await db.delete(userId);

    // 6) Auditoría
    await db.insert("audits", {
      action: "delete_user",
      entity: "user",
      entityId: userId, // <-- PASAMOS LA Id (NO string)
      requesterId,
      timestamp: Date.now(),
      details: {
        requesterName: requester.name,
        deletedUserEmail: user.email,
        forced: !!force,
        refs,
      },
    });

    return { deleted: true, userId };
  },
});
