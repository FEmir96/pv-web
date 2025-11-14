// convex/actions/getIGDBScreenshots.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/* ---------- utils de normalización / similitud ---------- */
const STOPWORDS = new Set([
  "the","of","and","edition","editions","deluxe","ultimate","definitive","remastered","remake",
  "goty","complete","collection","director","directors","cut","hd","enhanced","year","gold","platinum",
  "el","la","los","las","de","del","y","edicion","definitiva","remasterizado","remasterizada",
  "completa","coleccion","aniversario","juego","videojuego","videjuego","tm","©","®"
]);
const ROMAN_TO_INT: Record<string, number> = {
  i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10,xi:11,xii:12,xiii:13,
  xiv:14,xv:15,xvi:16,xvii:17,xviii:18,xix:19,xx:20
};
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .replace(/['’]/g,"").replace(/&/g," and ").toLowerCase();
const tok = (s: string) =>
  norm(s).replace(/[^a-z0-9\s]/g," ").split(/\s+/)
    .map((t) => (ROMAN_TO_INT[t] ? String(ROMAN_TO_INT[t]) : t))
    .filter((t) => !!t && !STOPWORDS.has(t));
const setOf = (arr: string[]) => new Set(arr);
function jaccard(A: Set<string>, B: Set<string>) {
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni === 0 ? 0 : inter / uni;
}
function baseVariants(original: string): string[] {
  const raw = original.trim();
  const out = new Set<string>([raw]);
  const cut = raw.split(/[:\-–—\|]/)[0].trim();
  if (cut && cut !== raw) out.add(cut);
  out.add(raw.replace(/[™©®]/g,"").trim());
  return Array.from(out);
}
function toSlug(title: string) {
  return title
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------- IGDB helpers ---------- */
async function getIgdbToken(): Promise<{ token: string; clientId: string }> {
  const clientId = process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || "";
  const clientSecret = process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Faltan IGDB_CLIENT_ID/IGDB_CLIENT_SECRET (o TWITCH_*) en Convex env.");
  }
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!r.ok) throw new Error(`Twitch token ${r.status}`);
  const j = await r.json() as { access_token: string };
  return { token: j.access_token, clientId };
}

type IGDBGame = {
  id: number; name?: string;
  alternative_names?: { name?: string }[];
};

async function igdb(clientId: string, token: string, q: string) {
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
    body: q,
  });
  if (!r.ok) return [];
  return (await r.json()) as IGDBGame[];
}
async function igdbById(clientId: string, token: string, id: number) {
  const arr = await igdb(clientId, token, `where id=${id}; fields id,name,alternative_names.name; limit 1;`);
  return arr[0] ?? null;
}

/* ---------- screenshots & videos ---------- */
async function igdbScreens(clientId: string, token: string, gameId: number, limit: number, size2x: boolean) {
  const r = await fetch("https://api.igdb.com/v4/screenshots", {
    method: "POST",
    headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}`, "Accept":"application/json" },
    body: `fields image_id; where game=${gameId}; limit ${limit};`,
  });
  if (!r.ok) return [];
  const arr = (await r.json()) as Array<{ image_id?: string }>;
  const size = size2x ? "t_screenshot_huge_2x" : "t_screenshot_huge";
  return arr
    .map((s) => s.image_id ? `https://images.igdb.com/igdb/image/upload/${size}/${s.image_id}.jpg` : null)
    .filter((u): u is string => !!u);
}
async function igdbVideoUrl(clientId: string, token: string, gameId: number) {
  const r = await fetch("https://api.igdb.com/v4/game_videos", {
    method: "POST",
    headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}`, "Accept":"application/json" },
    body: `fields video_id; where game=${gameId}; limit 1;`,
  });
  if (!r.ok) return null;
  const arr = (await r.json()) as Array<{ video_id?: string }>;
  const id = arr?.[0]?.video_id;
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/* ---------- ACTION ---------- */
export const getIGDBScreenshots = action({
  args: {
    title: v.string(),
    limit: v.optional(v.number()),
    size2x: v.optional(v.boolean()),
    minScore: v.optional(v.number()),           // default 0.6
    minScoreFallback: v.optional(v.number()),   // default 0.45
    includeVideo: v.optional(v.boolean()),
    overrides: v.optional(v.array(v.object({
      title: v.string(),
      igdbTitle: v.optional(v.string()),
      igdbId: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 8, 20));
    const size2x = !!args.size2x;
    const minScore = args.minScore ?? 0.6;
    const minScoreFallback = args.minScoreFallback ?? 0.45;

    const { token, clientId } = await getIgdbToken();

    // Overrides por título
    const ov = (args.overrides ?? []).find(
      (o) => o.title.trim().toLowerCase() === args.title.trim().toLowerCase()
    );

    let chosen: IGDBGame | null = null;
    let score = 1;

    if (ov?.igdbId) {
      chosen = await igdbById(clientId, token, ov.igdbId);
    } else if (ov?.igdbTitle) {
      const arr = await igdb(
        clientId, token,
        `search "${ov.igdbTitle.replace(/"/g,'\\"')}"; fields id,name,alternative_names.name; limit 1;`
      );
      chosen = arr[0] ?? null;
    }

    // 🔎 NUEVO: buscar por slug exacto (p. ej. "gears-of-war-reloaded", "fortnite")
    if (!chosen) {
      const slug = toSlug(args.title);
      const bySlug = await igdb(
        clientId, token,
        `where slug="${slug}"; fields id,name,alternative_names.name; limit 1;`
      );
      if (bySlug[0]) {
        chosen = bySlug[0]; score = 1;
      }
    }

    // 🔎 NUEVO: intentar igualdad exacta de nombre antes del search difuso
    if (!chosen) {
      const baseName = args.title.trim().replace(/"/g, '\\"');
      const exact = await igdb(
        clientId, token,
        `where name="${baseName}"; fields id,name,alternative_names.name; limit 1;`
      );
      if (exact[0]) {
        chosen = exact[0]; score = 1;
      }
    }

    // Matching difuso (estricto y luego laxo)
    if (!chosen) {
      const variants = baseVariants(args.title);
      const tSet = setOf(tok(args.title));
      let best: { g: IGDBGame; score: number } | null = null;

      // Estricto
      for (const vt of variants) {
        const arr = await igdb(
          clientId, token,
          `search "${vt.replace(/"/g,'\\"')}"; fields id,name,alternative_names.name; limit 25;`
        );
        for (const g of arr) {
          const names = [g.name ?? "", ...(g.alternative_names?.map(a => a.name ?? "") ?? [])].filter(Boolean);
          const s = jaccard(tSet, setOf(tok(names.join(" "))));
          if (!best || s > best.score) best = { g, score: s };
        }
        if (best && best.score >= minScore) break;
      }

      // Laxo
      if (!best || best.score < minScore) {
        for (const vt of variants) {
          const arr = await igdb(
            clientId, token,
            `search "${vt.replace(/"/g,'\\"')}"; fields id,name,alternative_names.name; limit 50;`
          );
          for (const g of arr) {
            const names = [g.name ?? "", ...(g.alternative_names?.map(a => a.name ?? "") ?? [])].filter(Boolean);
            const s = jaccard(tSet, setOf(tok(names.join(" "))));
            if (!best || s > best.score) best = { g, score: s };
          }
          if (best && best.score >= minScoreFallback) break;
        }
      }

      if (best && (best.score >= minScoreFallback)) {
        chosen = best.g; score = best.score;
      }
    }

    if (!chosen) {
      return { matched: null as string | null, score: 0, urls: [] as string[], videoUrl: null as string | null, igdbId: null };
    }

    const urls = await igdbScreens(clientId, token, chosen.id, limit, size2x);
    const videoUrl = args.includeVideo ? await igdbVideoUrl(clientId, token, chosen.id) : null;

    return {
      matched: chosen.name ?? null,
      score,
      urls,
      videoUrl,
      igdbId: chosen.id,
    };
  },
});
