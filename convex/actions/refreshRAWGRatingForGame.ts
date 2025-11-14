"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

import type { RawgGame } from "../lib/rawg/client";
import { rawgGetGameBySlug, rawgSearchGames } from "../lib/rawg/client";

import type { AgeOut } from "../lib/rawg/age";
import { esrbFromRawgName } from "../lib/rawg/age";

type DbGameMinimal = { _id: Id<"games">; title?: string | null };

type ActionResult = {
  ok: boolean;
  reason?: string;
  rawg?: { id: number; slug: string; name: string; esrb?: string | null };
  applied?: AgeOut;
};

export const refreshRAWGRatingForGame = action({
  args: {
    gameId: v.id("games"),
    rawgSlug: v.optional(v.string()),
    titleOverride: v.optional(v.string()),
    applyNRIfMissing: v.optional(v.boolean()),
    fallbackToRatingPending: v.optional(v.boolean()), // << NUEVO
  },
  handler: async (ctx, args): Promise<ActionResult> => {
    // 1) título
    let title: string | undefined = args.titleOverride?.trim();
    if (!title) {
      const g = (await ctx.runQuery(api.queries.getGameById.getGameById, {
        id: args.gameId,
      })) as DbGameMinimal | null;
      if (!g) return { ok: false, reason: "Juego no encontrado en DB" };
      title = String(g.title ?? "").trim();
    }
    if (!title) return { ok: false, reason: "Sin título para buscar en RAWG" };

    // 2) elegir juego RAWG
    let picked:
      | { id: number; slug: string; name: string; esrb?: string | null }
      | null = null;

    if (args.rawgSlug) {
      const g = await rawgGetGameBySlug(args.rawgSlug);
      if (g) picked = { id: g.id, slug: g.slug, name: g.name, esrb: g.esrb_rating?.name ?? null };
    } else {
      const results: RawgGame[] = await rawgSearchGames(title, 8);
      const exact = results.find(
        (r) => (r.name ?? "").trim().toLowerCase() === title!.toLowerCase()
      );
      const best = exact || results[0];
      if (best) picked = { id: best.id, slug: best.slug, name: best.name, esrb: best.esrb_rating?.name ?? null };
    }
    if (!picked) return { ok: false, reason: "No se encontró juego en RAWG" };

    // 3) mapear ESRB
    const mapped: AgeOut | null = esrbFromRawgName(picked.esrb ?? null);

    // 3.a) sin ESRB → aplicar fallback si corresponde
    if (!mapped) {
      if (args.fallbackToRatingPending) {
        const RP: AgeOut = { ageRatingSystem: "ESRB", ageRatingCode: "RP", ageRatingLabel: "Rating Pending" };
        await ctx.runMutation(api.mutations.applyAgeRating.applyAgeRating, {
          gameId: args.gameId as Id<"games">,
          ageRatingSystem: RP.ageRatingSystem,
          ageRatingCode: RP.ageRatingCode,
          ageRatingLabel: RP.ageRatingLabel,
        });
        return { ok: true, rawg: picked, applied: RP };
      }
      if (args.applyNRIfMissing) {
        const NR: AgeOut = { ageRatingSystem: "ESRB", ageRatingCode: "NR", ageRatingLabel: "Not Rated" };
        await ctx.runMutation(api.mutations.applyAgeRating.applyAgeRating, {
          gameId: args.gameId as Id<"games">,
          ageRatingSystem: NR.ageRatingSystem,
          ageRatingCode: NR.ageRatingCode,
          ageRatingLabel: NR.ageRatingLabel,
        });
        return { ok: true, rawg: picked, applied: NR };
      }
      return { ok: false, reason: "RAWG sin esrb_rating", rawg: picked };
    }

    // 4) guardar mapeo ESRB
    await ctx.runMutation(api.mutations.applyAgeRating.applyAgeRating, {
      gameId: args.gameId as Id<"games">,
      ageRatingSystem: mapped.ageRatingSystem,
      ageRatingCode: mapped.ageRatingCode,
      ageRatingLabel: mapped.ageRatingLabel,
    });

    return { ok: true, rawg: picked, applied: mapped };
  },
});
