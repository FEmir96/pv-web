// convex/queries/admin/listProfiles.ts
import { query } from "../../_generated/server";

export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("profiles").collect();
    return rows
      .map((p) => ({
        _id: p._id,
        name: (p as any).name ?? (p as any).username ?? "",
        email: p.email ?? "",
        role: p.role as "free" | "premium" | "admin",
        status: (p as any).status ?? "Activo",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
