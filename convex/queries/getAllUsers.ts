// convex/functions/queries/getAllUsers.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAllUsers = query({
  args: {
    requesterId: v.id("profiles"), // el id del usuario que hace la consulta
  },
  handler: async ({ db }, { requesterId }) => {
    const requester = await db.get(requesterId);
    if (!requester) {
      throw new Error("Usuario no encontrado.");
    }
    if (requester.role !== "admin") {
      throw new Error("Acceso denegado. Solo administradores pueden ver la lista de usuarios.");
    }

    return await db.query("profiles").collect();
  },
});
