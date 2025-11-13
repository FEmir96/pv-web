"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type MinimalGame = {
  _id: Id<"games">;
  title?: string | null;
  ageRatingLabel?: string | null;
};

type Result = { id: Id<"games">; ok: boolean; reason?: string };

export const refreshRAWGBatch = action({
  args: {
    ids: v.optional(v.array(v.id("games"))),
    limit: v.optional(v.number()),
    onlyMissing: v.optional(v.boolean()), // default true
    sleepMs: v.optional(v.number()),      // default 180
    // overrides (string->string para evitar TS7053)
    overrideSlugById: v.optional(v.record(v.string(), v.string())),
    overrideTitleById: v.optional(v.record(v.string(), v.string())),
    // fallbacks
    applyNRIfMissing: v.optional(v.boolean()),
    fallbackToRatingPending: v.optional(v.boolean()), // << NUEVO
  },
  handler: async (ctx, args) => {
    const onlyMissing = args.onlyMissing !== false;
    const sleepMs = typeof args.sleepMs === "number" ? args.sleepMs : 180;

    const slugFor = (id: Id<"games">): string | undefined =>
      args.overrideSlugById?.[(id as unknown as string)];
    const titleFor = (id: Id<"games">): string | undefined =>
      args.overrideTitleById?.[(id as unknown as string)];

    let list: MinimalGame[] = [];

    if (args.ids && args.ids.length) {
      const rows = await Promise.all(
        args.ids.map((id) => ctx.runQuery(api.queries.getGameById.getGameById, { id }))
      );
      list = rows
        .filter(Boolean)
        .map((g: any) => ({
          _id: g!._id as Id<"games">,
          title: String(g!.title ?? ""),
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

    const results: Result[] = [];

    for (const g of limited) {
      try {
        const out = (await ctx.runAction(
          api.actions.refreshRAWGRatingForGame.refreshRAWGRatingForGame,
          {
            gameId: g._id,
            rawgSlug: slugFor(g._id),
            titleOverride: titleFor(g._id),
            applyNRIfMissing: args.applyNRIfMissing === true,
            fallbackToRatingPending: args.fallbackToRatingPending === true,
          }
        )) as { ok: boolean; reason?: string };

        results.push({ id: g._id, ok: !!out?.ok, reason: out?.reason });
      } catch (e: any) {
        results.push({ id: g._id, ok: false, reason: String(e?.message || e) });
      }
      if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
    }

    const ok = results.filter((r) => r.ok).length;
    const errors = results.filter((r) => !r.ok);

    return {
      total: results.length,
      ok,
      errors,
      results,
      processedWithId: limited.length,
      processedWithoutId: 0,
    };
  },
});
