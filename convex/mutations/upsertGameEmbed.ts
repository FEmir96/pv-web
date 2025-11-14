// convex/mutations/upsertGameEmbed.ts
import { mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";

export const upsertGameEmbed = mutation({
  args: {
    gameId: v.id("games"),
    embed_url: v.string(),
    embed_allow: v.optional(v.string()),
    embed_sandbox: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new ConvexError("Juego no encontrado en DB");

    await ctx.db.patch(args.gameId, {
      // snake_case (definido en schema)
      embed_url: args.embed_url,
      embed_allow: args.embed_allow,
      embed_sandbox: args.embed_sandbox,
      // camelCase por compat con tu frontend (opcionales)
      embedUrl: args.embed_url,
      embedAllow: args.embed_allow,
      embedSandbox: args.embed_sandbox,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});
