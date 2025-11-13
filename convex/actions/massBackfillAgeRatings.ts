"use node";

// convex/actions/massBackfillAgeRatings.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

type MinimalGame = {
  _id: Id<"games">;
  title: string;
  igdbId?: number | null;
  ageRatingLabel?: string | null;
};

type BatchResult = {
  total: number;
  ok: number;
  errors: Array<{ id: Id<"games">; ok: false; reason?: string }>;
  results: Array<{ id: Id<"games">; ok: boolean; reason?: string }>;
};

export const massBackfillAgeRatings = action({
  args: {
    ids: v.optional(v.array(v.id("games"))),
    onlyMissing: v.optional(v.boolean()), // default true
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BatchResult> => {
    const api: any = (await import("../_generated/api")).api;

    const onlyMissing = args.onlyMissing !== false;
    let list: MinimalGame[];

    if (args.ids && args.ids.length) {
      const rows = await Promise.all(
        args.ids.map((id) =>
          ctx.runQuery(api.queries.getGameById.getGameById, { id })
        )
      );
      list = rows
        .filter(Boolean)
        .map((g: any) => ({
          _id: g!._id as Id<"games">,
          title: g!.title as string,
          igdbId: (g as any).igdbId ?? null,
          ageRatingLabel: (g as any).ageRatingLabel ?? null,
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
          }
        )) as any;

        if (out?.ok) results.push({ id: g._id, ok: true });
        else results.push({ id: g._id, ok: false, reason: out?.reason || "fail" });
      } catch (e: any) {
        results.push({ id: g._id, ok: false, reason: String(e?.message || e) });
      }
      await sleep(160); // rate-limit friendly
    }

    const ok = results.filter((r) => r.ok).length;
    const errors = results.filter((r) => !r.ok) as Array<{
      id: Id<"games">;
      ok: false;
      reason?: string;
    }>;
    return { total: results.length, ok, errors, results };
  },
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
