"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import type { FunctionReference } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";

// Usa tus funciones (carpeta → archivo → export)
const qGetGames = (api as any).queries.getGames.getGames as FunctionReference<"query">;
const mSetGameDetails =
  (api as any).mutations.setGameDetails.setGameDetails as FunctionReference<"mutation">;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Forzamos inglés → español
const SOURCE_LANG = (process.env.TRANSLATE_SOURCE_LANG || "en").toLowerCase();
const TARGET_LANG = "es";

function chunkText(s: string, max = 450): string[] {
  if (!s) return [];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    const punct = s.lastIndexOf(". ", end);
    const space = s.lastIndexOf(" ", end);
    if (end - i > 200 && (punct > i || space > i)) {
      end = Math.max(punct, space);
      if (end <= i) end = Math.min(i + max, s.length);
    }
    out.push(s.slice(i, end));
    i = end;
  }
  return out.map(t => t.trim()).filter(Boolean);
}

function isErrorLike(t: string): boolean {
  return /error|invalid|missing|parameter|auto/i.test(t) || /<\/?[a-z]+>/i.test(t);
}
function hasSpanishChars(t: string): boolean {
  return /[áéíóúñü¡¿]/i.test(t);
}
function spanishStopwordScore(t: string): number {
  const words = t.toLowerCase().split(/\W+/);
  const stop = new Set([
    "de","la","que","el","en","y","a","los","del","se","las","por","un",
    "para","con","no","una","su","al","lo","como","más","pero","sus","le",
    "ya","o","fue","este","ha","sí","porque","esta","son","entre","cuando","muy"
  ]);
  let c = 0;
  for (const w of words) if (stop.has(w)) c++;
  return c / Math.max(words.length, 1);
}
function isLikelySpanish(t: string): boolean {
  // Bajamos un poco el umbral para no ser tan estrictos
  return hasSpanishChars(t) || spanishStopwordScore(t) >= 0.04;
}

async function translateWithLibre(c: string): Promise<string> {
  const base = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com";
  const url = `${base.replace(/\/$/, "")}/translate`;
  const payload: any = { q: c, source: SOURCE_LANG, target: TARGET_LANG, format: "text" };
  const apiKey = process.env.LIBRETRANSLATE_API_KEY;
  if (apiKey) payload.api_key = apiKey;

  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`LibreTranslate HTTP ${r.status}`);
  const j: any = await r.json();
  const t = j?.translatedText ?? (Array.isArray(j) && j[0]?.translatedText) ?? null;
  if (!t) throw new Error("LibreTranslate sin translatedText");
  return String(t);
}

async function translateWithMyMemory(c: string): Promise<string> {
  const email = process.env.MYMEMORY_EMAIL || "user@example.com";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=${SOURCE_LANG}|${TARGET_LANG}&mt=1&de=${encodeURIComponent(email)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`MyMemory HTTP ${r.status}`);
  const j: any = await r.json();
  const t: string | undefined = j?.responseData?.translatedText;
  if (!t) throw new Error("MyMemory sin translatedText");
  return String(t);
}

async function translateChunkStrong(c: string): Promise<string> {
  try { return await translateWithLibre(c); }
  catch {
    try { return await translateWithMyMemory(c); }
    catch { return c; } // último recurso: no frenamos el batch
  }
}

async function translateToEsStrong(text: string): Promise<{ out: string; ok: boolean; reason?: string }> {
  if (!text) return { out: text, ok: false, reason: "empty" };
  const chunks = chunkText(text, 450);
  const outs: string[] = [];
  for (const c of chunks) {
    const out = await translateChunkStrong(c);
    outs.push(out);
    await sleep(250);
  }
  let joined = outs.join(" ");
  if (joined.length > 4000) joined = joined.slice(0, 4000);

  if (isErrorLike(joined)) return { out: text, ok: false, reason: "error_like_output" };
  if (!isLikelySpanish(joined)) return { out: text, ok: false, reason: "not_spanish" };

  return { out: joined, ok: true };
}

export const translateExistingDescriptions = action({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { dryRun, limit }) => {
    const all = (await ctx.runQuery(qGetGames, {} as any)) as Doc<"games">[];

    // Vamos a traducir SOLO las que ya tienen description (en inglés)
    const candidates = all.filter((g) => !!(g.description && g.description.trim().length));
    const batch = typeof limit === "number" ? candidates.slice(0, Math.max(0, limit)) : candidates;

    const res = { candidates: candidates.length, processed: 0, updated: 0, skipped: 0, sample: [] as any[] };

    for (const g of batch) {
      const source = (g.description ?? "").trim();
      if (!source) { res.skipped++; continue; }

      const tr = await translateToEsStrong(source);

      if (dryRun) {
        res.sample.push({
          title: g.title,
          ok: tr.ok,
          reason: tr.ok ? "ok" : tr.reason,
          preview_from: source.slice(0, 100),
          preview_to: tr.out.slice(0, 100),
        });
      } else {
        if (tr.ok) {
          await ctx.runMutation(mSetGameDetails, {
            gameId: g._id as Id<"games">,
            description: tr.out,
            overwrite: true,
          });
          res.updated++;
        } else {
          res.skipped++;
        }
      }

      res.processed++;
      await sleep(150);
    }

    return res;
  },
});
