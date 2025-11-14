// convex/mutations/applyIgdbRating.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const applyIgdbRating = mutation({
  args: {
    id: v.id("games"),
    requesterId: v.optional(v.id("profiles")),
    data: v.object({
      igdbId: v.optional(v.number()),
      igdbSlug: v.optional(v.string()),
      igdbRating: v.optional(v.number()),
      igdbUserRating: v.optional(v.number()),
      igdbCriticRating: v.optional(v.number()),
      igdbRatingCount: v.optional(v.number()),
      igdbHypes: v.optional(v.number()),
      popscore: v.optional(v.number()),
      lastIgdbSyncAt: v.optional(v.number()),
      firstReleaseDate: v.optional(v.number()),
      developers: v.optional(v.array(v.string())),
      publishers: v.optional(v.array(v.string())),
      languages: v.optional(v.array(v.string())),
      ageRatingSystem: v.optional(v.string()),
      ageRatingCode: v.optional(v.string()),
      ageRatingLabel: v.optional(v.string()),
    }),
    auditDetails: v.optional(v.any()),
  },
  handler: async (ctx, { id, requesterId, data, auditDetails }) => {
    // 🔒 Blindaje: JAMÁS permitir que se parche `title` desde esta mutation
    const safe: Record<string, unknown> = { ...data };
    delete (safe as any).title;

    await ctx.db.patch(id, safe as any);

    if (requesterId) {
      await ctx.db.insert("audits", {
        action: "igdb.refresh",
        entity: "games",
        entityId: id as any,
        requesterId,
        timestamp: Date.now(),
        details: auditDetails ?? safe,
      });
    }
  },
});
