"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { AgeSystem } from "../lib/igdb/ageRatings";

type MinimalGame = {
  _id: Id<"games">;
  title: string;
  igdbId?: number | null;
  ageRatingLabel?: string | null;
};

export const refreshIGDBBatch = action({
  args: {
    ids: v.optional(v.array(v.id("games"))),
    limit: v.optional(v.number()),
    onlyMissing: v.optional(v.boolean()), // default true
    sleepMs: v.optional(v.number()),      // default 180
    prefer: v.optional(
      v.array(
        v.union(
          v.literal("ESRB"), v.literal("PEGI"), v.literal("USK"),
          v.literal("CERO"), v.literal("ACB"), v.literal("GRAC"),
          v.literal("CLASS_IND"), v.literal("OFLCNZ")
        )
      )
    ),
  },
  handler: async (ctx, args) => {
    const onlyMissing = args.onlyMissing !== false;
    const sleepMs = typeof args.sleepMs === "number" ? args.sleepMs : 180;
    const prefer = args.prefer as AgeSystem[] | undefined;

    let list: MinimalGame[] = [];

    if (args.ids && args.ids.length) {
      const rows = await Promise.all(
        args.ids.map((id) => ctx.runQuery(api.queries.getGameById.getGameById, { id }))
      );
      list = rows.filter(Boolean).map((g: any) => ({
        _id: g!._id as Id<"games">,
        title: String(g!.title || ""),
        igdbId: typeof g!.igdbId === "number" ? (g!.igdbId as number) : null,
        ageRatingLabel: g!.ageRatingLabel ?? null,
      }));
    } else {
      list = (await ctx.runQuery(
        api.queries.listGamesMinimal.listGamesMinimal,
        {}
      )) as MinimalGame[];
    }

    const source = onlyMissing
      ? list.filter(
          (g) =>
            !g.ageRatingLabel ||
            g.ageRatingLabel === "Not Rated" ||
            g.ageRatingLabel === "NR"
        )
      : list;

    const limited =
      typeof args.limit === "number" && args.limit > 0
        ? source.slice(0, args.limit)
        : source;

    const results: Array<{ id: Id<"games">; ok: boolean; reason?: string }> = [];

    for (const g of limited) {
      try {
        const out = (await ctx.runAction(
          api.actions.refreshIGDBRatingForGame.refreshIGDBRatingForGame,
          {
            gameId: g._id,
            igdbId: typeof g.igdbId === "number" ? g.igdbId : undefined,
            forceByTitle: typeof g.igdbId !== "number",
            prefer,
          }
        )) as any;

        results.push({ id: g._id, ok: !!out?.ok, reason: out?.reason });
      } catch (e: any) {
        results.push({ id: g._id, ok: false, reason: String(e?.message || e) });
      }
      await new Promise((r) => setTimeout(r, sleepMs));
    }

    const ok = results.filter((r) => r.ok).length;
    const errors = results.filter((r) => !r.ok);
    return {
      total: results.length,
      ok,
      errors,
      processedWithId: limited.filter((g) => typeof g.igdbId === "number").length,
      processedWithoutId: limited.filter((g) => typeof g.igdbId !== "number").length,
      results,
    };
  },
});
