// convex/functions/queries/getAvailableGames.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAvailableGames = query({
  args: {
    userId: v.id("profiles"),
  },
  handler: async ({ db }, { userId }) => {
    // Busco al usuario
    const user = await db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");

    // Si es premium → ve todos los juegos
    if (user.role === "premium") {
      return await db.query("games").collect();
    }

    // Si es free → solo ve juegos con plan "free"
    return await db.query("games").filter((q) => q.eq(q.field("plan"), "free")).collect();
  },
});
