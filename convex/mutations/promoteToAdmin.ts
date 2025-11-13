// convex/functions/mutations/promoteToAdmin.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const promoteToAdmin = mutation({
  args: {
    userId: v.id("profiles"),      // usuario a promover
    requesterId: v.id("profiles"), // quién hace la acción
  },
  handler: async (ctx, { userId, requesterId }) => {
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Solicitante no encontrado");

    // Validamos que el requester sea admin
    if (requester.role !== "admin") {
      throw new Error("Solo un administrador puede promover a otro usuario");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");

    // Guardamos rol anterior para auditoría
    const previousRole = user.role;

    // Actualizamos rol a admin
    await ctx.db.patch(userId, { role: "admin" });

    const now = Date.now();

    // Guardamos auditoría
    await ctx.db.insert("audits", {
      action: "promote_to_admin",
      entity: "user",
      entityId: userId,
      requesterId,
      timestamp: now,
      details: {
        requesterName: requester.name,
        promotedUserName: user.name,
        previousRole,
        newRole: "admin",
      },
    });

    return {
      success: true,
      message: `El usuario ${user.name} ahora es administrador`,
      userId,
    };
  },
});
