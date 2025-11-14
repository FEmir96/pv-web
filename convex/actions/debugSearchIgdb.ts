"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

// ====== IGDB auth ======
function needEnv(...keys: string[]) {
  for (const k of keys) if (!process.env[k]) throw new Error(`Falta ${k} en env`);
}
async function getTwitchAppToken(): Promise<string> {
  const clientId = process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || "";
  const clientSecret = process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Faltan IGDB_CLIENT_ID / IGDB_CLIENT_SECRET en las env vars");
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&grant_type=client_credentials`,
  });
  if (!res.ok) throw new Error(`Twitch token error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return String(json.access_token);
}
async function igdb<T = any>(endpoint: string, query: string): Promise<T[]> {
  const token = await getTwitchAppToken();
  const clientId = process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID!;
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "text/plain",
    },
    body: query,
  });
  if (!res.ok) throw new Error(`IGDB error ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
}

// ====== Helpers ======
type GameRow = {
  id: number;
  name: string;
  parent_game?: number | null;
  version_parent?: number | null;
  age_ratings?: number[];
  alternative_names?: { name?: string }[];
};
type AgeRow = {
  id: number;
  category?: number | null; // 1 ESRB, 2 PEGI, 3 USK, 4 GRAC, 5 CERO, 6 ACB, 7 CLASS_IND, 8 OFLCNZ
  rating?: number | null;   // código del rating dentro del sistema
  content_descriptions?: number[]; // podemos ignorar detalle
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function fetchGamesBySearch(title: string, limit: number): Promise<GameRow[]> {
  const q = title.replace(/"/g, '\\"');
  return igdb<GameRow>(
    "games",
    `search "${q}"; fields id,name,parent_game,version_parent,alternative_names.name,age_ratings; limit ${limit};`
  );
}
async function fetchGamesByIds(ids: number[]): Promise<GameRow[]> {
  if (!ids.length) return [];
  // chunk por si acaso
  const out: GameRow[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const part = await igdb<GameRow>(
      "games",
      `where id = (${chunk.join(",")}); fields id,name,parent_game,version_parent,alternative_names.name,age_ratings; limit ${chunk.length};`
    );
    out.push(...part);
  }
  return out;
}
async function fetchAgeRatingsByIds(ids: number[]): Promise<Map<number, AgeRow>> {
  const map = new Map<number, AgeRow>();
  if (!ids.length) return map;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const part = await igdb<AgeRow>(
      "age_ratings",
      // OJO: nada de 'game' acá; sólo campos válidos de age_ratings
      `where id = (${chunk.join(",")}); fields id,category,rating,content_descriptions; limit ${chunk.length};`
    );
    for (const r of part) map.set(r.id, r);
  }
  return map;
}

function mapGameWithRatings(g: GameRow, ageMap: Map<number, AgeRow>) {
  const ageIds = Array.isArray(g.age_ratings) ? g.age_ratings.filter(n => typeof n === "number") : [];
  const ages = ageIds
    .map((id) => ageMap.get(id))
    .filter((a): a is AgeRow => !!a)
    .map((r) => ({
      id: r.id,
      category: r.category ?? null,
      rating: r.rating ?? null,
      desc: Array.isArray(r.content_descriptions) ? r.content_descriptions : [],
    }));
  return {
    id: g.id,
    name: g.name,
    parent_game: g.parent_game ?? null,
    version_parent: g.version_parent ?? null,
    alt: Array.isArray(g.alternative_names) ? g.alternative_names.map(a => a?.name).filter(Boolean) : [],
    hasAges: ages.length > 0,
    ages,
  };
}

// ====== Action ======
export const debugSearchIgdb = action({
  args: { title: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, args) => {
    needEnv("TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"); // o IGDB_* (la función usa cualquiera de los dos)
    const limit = Math.max(1, Math.min(50, args.limit ?? 5));

    // 1) Juegos por título
    const games = await fetchGamesBySearch(args.title, limit);

    // 2) Juntar TODOS los age_rating IDs de estos juegos
    let allAgeIds = games.flatMap((g) => (Array.isArray(g.age_ratings) ? g.age_ratings : []));
    allAgeIds = uniq(allAgeIds.filter((n): n is number => typeof n === "number"));

    // 3) Si alguno no trae ratings, intentar con sus padres/version_parent
    const missingParents: number[] = [];
    for (const g of games) {
      const has = Array.isArray(g.age_ratings) && g.age_ratings.length > 0;
      const p = g.parent_game || g.version_parent || null;
      if (!has && typeof p === "number") missingParents.push(p);
    }
    let parentAgesMap = new Map<number, AgeRow>();
    const parentGames = await fetchGamesByIds(uniq(missingParents));
    if (parentGames.length) {
      const parentAgeIds = uniq(
        parentGames.flatMap((pg) => (Array.isArray(pg.age_ratings) ? pg.age_ratings : []))
      );
      parentAgesMap = await fetchAgeRatingsByIds(parentAgeIds);
    }

    // 4) Resolver detalles de age_ratings por ID de los juegos buscados
    const mainAgesMap = await fetchAgeRatingsByIds(allAgeIds);

    // 5) Construir salida por juego; si no tiene, usar el mapa de los padres
    return games.map((g) => {
      const hasMain = Array.isArray(g.age_ratings) && g.age_ratings.length > 0;
      const ageMap = hasMain ? mainAgesMap : parentAgesMap;
      return mapGameWithRatings(g, ageMap);
    });
  },
});
