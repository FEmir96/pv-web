"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

export const cleanupNotRated = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(api.queries.listGamesMinimal.listGamesMinimal, {});
    const target = (rows as any[])
      .filter(r => !r.ageRatingCode || r.ageRatingCode === "NR" || r.ageRatingLabel === "Not Rated")
      .slice(0, typeof args.limit === "number" ? args.limit : rows.length);

    const results: any[] = [];
    for (const g of target) {
      try {
        const out = await ctx.runAction(api.actions.refreshIGDBRatingForGame.refreshIGDBRatingForGame, {
          gameId: g._id as Id<"games">,
          igdbId: g.igdbId ?? undefined,
          forceByTitle: !g.igdbId,
          // Podés fijar preferencia si querés:
          // prefer: ["ESRB","PEGI","USK","CERO","ACB","CLASS_IND","GRAC"],
        });
        results.push({ id: g._id, ok: !!out?.ok, reason: out?.reason });
      } catch (e: any) {
        results.push({ id: g._id, ok: false, reason: String(e?.message || e) });
      }
      await new Promise(r => setTimeout(r, 160));
    }
    const ok = results.filter(r => r.ok).length;
    return { total: results.length, ok, results, errors: results.filter(r => !r.ok) };
  },
});
