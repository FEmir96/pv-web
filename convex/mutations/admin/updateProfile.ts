// convex/mutations/admin/updateProfile.ts
import { mutation } from "../../_generated/server";
import { v } from "convex/values";

export const updateProfile = mutation({
  args: {
    id: v.id("profiles"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("free"), v.literal("premium"), v.literal("admin"))),
    // status: NO existe en el schema -> no lo aceptamos ni lo guardamos
  },
  handler: async (ctx, args) => {
    const { id, name, email, role } = args;

    const current = await ctx.db.get(id);
    if (!current) throw new Error("Perfil no encontrado");

    const patch: Record<string, unknown> = {};
    if (typeof name === "string") patch.name = name;
    if (typeof email === "string") patch.email = email;
    if (role) patch.role = role;

    if (Object.keys(patch).length === 0) {
      return { ok: true, unchanged: true };
    }

    await ctx.db.patch(id, patch);
    return { ok: true };
  },
});
