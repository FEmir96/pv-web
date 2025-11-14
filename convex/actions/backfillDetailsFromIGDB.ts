// convex/actions/backfillDetailsFromIGDB.ts
"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";
import type { FunctionReference } from "convex/server";

// 💡 triple nivel (carpeta → archivo → export)
const qGetGames =
  (api as any).queries.getGames.getGames as FunctionReference<"query">;
const mSetGameDetails =
  (api as any).mutations.setGameDetails
    .setGameDetails as FunctionReference<"mutation">;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const clamp = (s: string, max = 4000) => (s.length > max ? s.slice(0, max) : s);

/* ==================== Normalización & matching (igual que covers) ==================== */
const STOPWORDS = new Set([
  "the", "of", "and", "edition", "editions", "deluxe", "ultimate", "definitive", "remastered", "remake",
  "goty", "complete", "collection", "director", "directors", "cut", "hd", "enhanced", "year", "gold", "platinum",
  "el", "la", "los", "las", "de", "del", "y", "edicion", "definitiva", "remasterizado", "remasterizada",
  "completa", "coleccion", "aniversario", "juego", "videojuego", "videjuego", "tm", "©", "®"
]);
const ROMAN_TO_INT: Record<string, number> = {
  i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10,xi:11,xii:12,xiii:13,
  xiv:14,xv:15,xvi:16,xvii:17,xviii:18,xix:19,xx:20
};
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’]/g,"")
   .replace(/&/g," and ").toLowerCase();
const tok = (s: string) =>
  norm(s).replace(/[^a-z0-9\s]/g," ").split(/\s+/)
    .map(t => ROMAN_TO_INT[t] ? String(ROMAN_TO_INT[t]) : t)
    .filter(Boolean).filter(t => !STOPWORDS.has(t));
const set = (a: string[]) => new Set(a);
const jaccard = (A: Set<string>, B: Set<string>) => {
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter; return uni === 0 ? 0 : inter / uni;
};
function distinctiveTokens(title: string): string[] {
  const tks = tok(title);
  return tks.filter(t => t.length >= 4 || /^\d+$/.test(t));
}
function baseVariants(original: string): string[] {
  const raw = original.trim();
  const out = new Set<string>([raw]);
  const cut = raw.split(/[:\-–—\|]/)[0].trim(); if (cut && cut !== raw) out.add(cut);
  out.add(raw.replace(/[™©®]/g,"").trim());
  return Array.from(out);
}

/* ==================== Traducción ==================== */
function normalizeTitle(t: string) {
  return t
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
const TITLE_ALIASES: Record<string, string[]> = {
  "marvel's spiderman": ["marvel's spider-man"],
  "resident evil 8": ["resident evil village", "re8"],
};

async function translateToEs(text: string): Promise<string> {
  if (!text) return text;
  const base = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com";
  const url = `${base.replace(/\/$/, "")}/translate`;
  const payload: any = { q: text, source: "auto", target: "es", format: "text" };
  const apiKey = process.env.LIBRETRANSLATE_API_KEY;
  if (apiKey) payload.api_key = apiKey;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    const out = j?.translatedText ?? text;
    return clamp(out, 4000);
  } catch {
    return text;
  }
}

/* ==================== IGDB auth ==================== */
async function getIgdbToken(): Promise<{ token: string; clientId: string }> {
  const clientId =
    process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || "";
  const clientSecret =
    process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan IGDB_CLIENT_ID/IGDB_CLIENT_SECRET (o TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET) en Convex env"
    );
  }

  const resp = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const json = await resp.json();
  if (!json.access_token) throw new Error("No IGDB token (Twitch OAuth)");
  return { token: json.access_token as string, clientId };
}

/* ==================== IGDB búsqueda con scoring ==================== */
type IGDBGame = {
  id: number;
  name: string;
  summary?: string;
  genres?: { name: string }[];
  alternative_names?: { name?: string }[];
};

async function igdbQueryGames(
  clientId: string,
  token: string,
  q: string
): Promise<IGDBGame[]> {
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "text/plain",
    },
    body: q,
  });
  if (!r.ok) return [];
  return (await r.json()) as IGDBGame[];
}

/** Búsqueda inteligente: variantes + tokens distintivos + Jaccard + minScore */
async function igdbFindByTitleSmart(
  clientId: string,
  token: string,
  title: string,
  minScore = 0.55
): Promise<{ game: IGDBGame; score: number } | null> {
  const base = normalizeTitle(title);
  const simple = base.split(":")[0].split("-")[0].trim();
  const aliases = TITLE_ALIASES[base.toLowerCase()] ?? [];
  const variants = [...new Set([base, simple, ...aliases, ...baseVariants(base)])];

  const need = new Set(distinctiveTokens(base));
  const titleTokens = set(tok(base));

  let best: { game: IGDBGame; score: number } | null = null;

  for (const v of variants) {
    const q = `search "${v.replace(/"/g, '\\"')}";
      fields name,summary,genres.name,alternative_names.name,version_parent;
      where version_parent = null;
      limit 10;`;

    const arr = await igdbQueryGames(clientId, token, q);

    for (const g of arr) {
      const names = [
        g.name ?? "",
        ...(g.alternative_names?.map(a => a.name ?? "") ?? []),
      ].filter(Boolean);

      const candTokens = set(tok(names.join(" ")));

      // exigir tokens distintivos, si los hay
      let missing = false;
      for (const t of need) if (!candTokens.has(t)) { missing = true; break; }
      if (missing) continue;

      const score = jaccard(titleTokens, candTokens);
      if (score >= minScore && (!best || score > best.score)) {
        best = { game: g, score };
        if (score >= 0.75) return best; // match fuerte → corto
      }
    }

    await sleep(150);
  }

  return best;
}

/* ==================== Mapeo de géneros a PlayVerse ==================== */
function mapGenresToPlayVerse(igdbNames: string[] = []): string[] {
  const MAP = new Map<string, string>([
    ["Action", "Acción"],
    ["Adventure", "Acción"],
    ["Fighting", "Acción"],
    ["Platform", "Acción"],
    ["Hack and slash/Beat 'em up", "Acción"],
    ["Role-playing (RPG)", "RPG"],
    ["Racing", "Carreras"],
    ["Shooter", "Shooter"],
    ["Strategy", "Estrategia"],
    ["Tactical", "Estrategia"],
    ["Real Time Strategy (RTS)", "Estrategia"],
    ["Turn-based strategy (TBS)", "Estrategia"],
    ["Simulator", "Sandbox"],
    ["Indie", "Sandbox"],
    ["Puzzle", "Sandbox"],
    ["Sport", "Deportes"],
    ["Sports", "Deportes"],
  ]);
  const out = new Set<string>();
  for (const g of igdbNames) {
    const m = MAP.get(g);
    if (m) out.add(m);
  }
  return [...out];
}

/* ==================== Action principal ==================== */
type DetailsResult = {
  candidates: number;
  processed: number;
  updated: number;
  dryRun: boolean;
  overwrite: boolean;
  minScore: number;
  sample: any[];
};

export const backfillDetailsFromIGDB = action({
  args: {
    dryRun: v.boolean(),
    overwrite: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    /** nuevo: umbral de similitud (0-1). Recomendado: 0.55–0.70 */
    minScore: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { dryRun, overwrite = false, limit, minScore = 0.6 }
  ): Promise<DetailsResult> => {
    // 1) Cargar todos los juegos (tu query)
    const all: Doc<"games">[] = (await ctx.runQuery(qGetGames, {} as any)) as Doc<"games">[];

    // 2) Filtrar pendientes (o forzar con overwrite)
    const pending = all.filter((g: any) => {
      const missingDesc = overwrite || !g.description || g.description.trim() === "";
      const missingGenres = overwrite || !Array.isArray(g.genres) || g.genres.length === 0;
      return missingDesc || missingGenres;
    });
    const batch = typeof limit === "number" ? pending.slice(0, Math.max(0, limit)) : pending;

    // 3) Auth IGDB (una sola vez)
    const { token, clientId } = await getIgdbToken();

    let updated = 0;
    const sample: any[] = [];

    // 4) Procesar
    for (const game of batch) {
      const smart = await igdbFindByTitleSmart(clientId, token, game.title, minScore);

      if (!smart) {
        sample.push({ title: game.title, note: "Sin match IGDB (score < minScore)" });
        continue;
      }

      const found = smart.game;
      const score = smart.score;

      const igdbGenres = found.genres?.map((g) => g.name) ?? [];
      const genresPV = mapGenresToPlayVerse(igdbGenres);

      const descEn = (found.summary ?? "").trim();
      const descEs = descEn ? await translateToEs(descEn) : undefined;

      if (dryRun) {
        sample.push({
          title: game.title,
          igdbMatch: found.name,
          score: Number(score.toFixed(3)),
          genresIGDB: igdbGenres,
          genresPlayVerse: genresPV,
          descriptionPreview:
            (descEs ?? "").slice(0, 160) + ((descEs?.length ?? 0) > 160 ? "…" : ""),
        });
      } else {
        await ctx.runMutation(mSetGameDetails, {
          gameId: game._id as Id<"games">,
          description: descEs,
          genres: genresPV,
          overwrite,
        });
        updated++;
      }

      await sleep(300); // Rate limiting suave
    }

    return {
      candidates: all.length,
      processed: batch.length,
      updated,
      dryRun,
      overwrite,
      minScore,
      sample: sample.slice(0, 10),
    };
  },
});
