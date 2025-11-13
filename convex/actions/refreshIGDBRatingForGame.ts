"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

import {
  pickAgeRating,
  buildLabel,
  systemShort,
  normalizeTitle,
} from "../lib/igdb/ageRatings";

type AgeSystem =
  | "ESRB" | "PEGI" | "USK" | "CERO" | "ACB" | "GRAC" | "CLASS_IND" | "OFLCNZ";

type IgdbAge = { category: number | null; rating: number | null };

type GameRow = {
  _id: Id<"games">;
  title: string;
  igdbId?: number | null;
};

function getenv(ctx: any, key: string): string | undefined {
  try {
    const v = ctx?.env?.get?.(key);
    if (v) return v;
  } catch {}
  return process.env[key];
}

async function getTwitchAppToken(ctx: any): Promise<string> {
  const clientId  = getenv(ctx, "IGDB_CLIENT_ID")  || getenv(ctx, "TWITCH_CLIENT_ID");
  const clientSec = getenv(ctx, "IGDB_CLIENT_SECRET") || getenv(ctx, "TWITCH_CLIENT_SECRET");
  if (!clientId || !clientSec) {
    throw new Error("Faltan IGDB_CLIENT_ID / IGDB_CLIENT_SECRET en las env vars");
  }
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSec)}&grant_type=client_credentials`,
  });
  if (!res.ok) throw new Error(`Twitch token error ${res.status}: ${await res.text().catch(()=> "")}`);
  const json = await res.json();
  return json.access_token as string;
}

async function igdb<T = any>(ctx: any, endpoint: string, query: string): Promise<T[]> {
  const token = await getTwitchAppToken(ctx);
  const clientId =
    getenv(ctx, "IGDB_CLIENT_ID") || getenv(ctx, "TWITCH_CLIENT_ID");
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": String(clientId),
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "text/plain",
    },
    body: query,
  });
  if (!res.ok) throw new Error(`IGDB error ${res.status}: ${await res.text().catch(()=> "")}`);
  return (await res.json()) as T[];
}

type IgdbGame = {
  id: number;
  name: string;
  age_ratings?: IgdbAge[];
  parent_game?: number | null;
  version_parent?: number | null;
  alternative_names?: { name: string }[];
};

async function getGameWithAgesById(ctx: any, id: number): Promise<IgdbGame | null> {
  const fields =
    "fields id,name,age_ratings.category,age_ratings.rating,parent_game,version_parent,alternative_names.name;";
  const rows = await igdb<IgdbGame>(ctx, "games", `${fields}\nwhere id = ${id};\nlimit 1;`);
  return rows[0] ?? null;
}

async function getAgesFromGameOrParents(ctx: any, g: IgdbGame | null): Promise<IgdbAge[] | null> {
  if (!g) return null;
  if (g.age_ratings && g.age_ratings.length) return g.age_ratings;

  if (g.version_parent) {
    const vp = await getGameWithAgesById(ctx, g.version_parent);
    if (vp?.age_ratings?.length) return vp.age_ratings;
  }
  if (g.parent_game) {
    const pg = await getGameWithAgesById(ctx, g.parent_game);
    if (pg?.age_ratings?.length) return pg.age_ratings;
  }
  return null;
}

const norm = (s: string) =>
  (s || "").normalize("NFKD").replace(/[^\w]+/g, " ").trim().toLowerCase();

function titleScore(row: IgdbGame, target: string): number {
  const nName = norm(row.name);
  if (nName === target) return 0;
  if (nName.includes(target)) return 1;
  if (row.alternative_names?.some(a => norm(a.name) === target)) return 2;
  return 3;
}

async function searchBestByTitle(ctx: any, title: string): Promise<{ game: IgdbGame | null; ages: IgdbAge[] | null }> {
  const q = (title || "").trim();
  if (!q) return { game: null, ages: null };

  const fields =
    "fields id,name,age_ratings.category,age_ratings.rating,parent_game,version_parent,alternative_names.name;";
  // ❗️Sin filtro por category y con más resultados
  const rows = await igdb<IgdbGame>(
    ctx,
    "games",
    `search "${q.replace(/"/g, '\\"')}";\n${fields}\nlimit 50;`
  );

  if (!rows.length) return { game: null, ages: null };

  const tgt = norm(title);
  rows.sort((a, b) => titleScore(a, tgt) - titleScore(b, tgt));

  for (const r of rows) {
    const ages = await getAgesFromGameOrParents(ctx, r);
    if (ages?.length) return { game: r, ages };
  }
  return { game: rows[0] ?? null, ages: null };
}

export const refreshIGDBRatingForGame = action({
  args: {
    gameId: v.id("games"),
    igdbId: v.optional(v.number()),
    forceByTitle: v.optional(v.boolean()),
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
    const local = (await ctx.runQuery(api.queries.getGameById.getGameById, {
      id: args.gameId as Id<"games">,
    })) as GameRow | null;
    if (!local) return { ok: false as const, reason: "Game local no encontrado" };

    const prefer = (args.prefer ?? []) as AgeSystem[];
    const byTitle = args.forceByTitle === true || typeof args.igdbId !== "number";

    let ages: IgdbAge[] | null = null;

    if (!byTitle) {
      const g = await getGameWithAgesById(ctx, Number(args.igdbId));
      ages = await getAgesFromGameOrParents(ctx, g);
    }
    if (!ages?.length) {
      const { ages: aa } = await searchBestByTitle(ctx, local.title || "");
      ages = aa ?? null;
    }

    if (!ages?.length) {
      return { ok: false as const, reason: "IGDB sin age_ratings (ni en el padre)" };
    }

    const choice = pickAgeRating(ages, prefer);
    if (!choice) return { ok: false as const, reason: "No se pudo elegir un age rating" };

    const label = buildLabel({ system: choice.system, code: choice.code });

    await ctx.runMutation(
      api.mutations.applyAgeRating.applyAgeRating,
      {
        gameId: args.gameId as Id<"games">,
        ageRatingSystem: systemShort(choice.system),
        ageRatingCode: String(choice.code),
        ageRatingLabel: label,
      }
    );

    return { ok: true as const, system: systemShort(choice.system), code: choice.code, label };
  },
});
