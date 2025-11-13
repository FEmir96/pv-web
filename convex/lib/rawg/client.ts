"use node";

const RAWG_BASE = "https://api.rawg.io/api";

function ensureEnv() {
  const key = process.env.RAWG_API_KEY;
  if (!key) throw new Error("Falta RAWG_API_KEY en las env vars");
  return key;
}

type FetchOpts = {
  path: string;
  params?: Record<string, string | number | boolean | undefined | null>;
};

export async function rawgGet<T = any>({ path, params = {} }: FetchOpts): Promise<T> {
  const key = ensureEnv();

  const url = new URL(RAWG_BASE + (path.startsWith("/") ? path : `/${path}`));
  url.searchParams.set("key", key);

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { method: "GET" });
  if (res.status === 429) {
    // cortito backoff por si el free plan nos estrangula
    await new Promise(r => setTimeout(r, 1200));
    const retry = await fetch(url.toString(), { method: "GET" });
    if (!retry.ok) throw new Error(`RAWG ${retry.status}: ${await retry.text()}`);
    return retry.json() as Promise<T>;
  }
  if (!res.ok) throw new Error(`RAWG ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ===== Tipos útiles RAWG =====
export type RawgEsrb = { id: number; name: string; slug: string };
export type RawgGame = {
  id: number;
  slug: string;
  name: string;
  released?: string | null;
  esrb_rating?: RawgEsrb | null;
};

export async function rawgGetGameBySlug(slug: string): Promise<RawgGame | null> {
  try {
    return await rawgGet<RawgGame>({ path: `/games/${encodeURIComponent(slug)}` });
  } catch {
    return null;
  }
}

export async function rawgSearchGames(q: string, pageSize = 5): Promise<RawgGame[]> {
  const out = await rawgGet<{ results: RawgGame[] }>({
    path: "/games",
    params: { search: q, page_size: Math.min(40, Math.max(1, pageSize)) },
  });
  return Array.isArray(out?.results) ? out.results : [];
}
