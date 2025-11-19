// convex/lib/embed.ts
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";

type DB = DatabaseReader | DatabaseWriter;

function normalizePath(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed, "https://placeholder.local");
    const path = u.pathname || "/";
    return path.replace(/\/+$/, "") || "/";
  } catch {
    const noHash = trimmed.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const prefixed = noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
    return prefixed.replace(/\/+$/, "") || "/";
  }
}

function candidates(raw?: string | null): string[] {
  const set = new Set<string>();
  const push = (val?: string | null) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    const noTrailing = trimmed.replace(/\/+$/, "");
    const base = noTrailing || "/";
    set.add(base);
    set.add(`${base}/`);
    set.add(trimmed);
  };
  push(raw);
  push(normalizePath(raw));
  return Array.from(set);
}

function normalizeStored(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, "https://placeholder.local");
    const path = u.pathname || "/";
    return path.replace(/\/+$/, "") || "/";
  } catch {
    return normalizePath(raw);
  }
}

export async function findGameByEmbedUrl(
  db: DB,
  embedUrl?: string | null
): Promise<{ _id: Id<"games">; title: string; embedUrl?: string | null } | null> {
  const normalizedTarget = normalizeStored(embedUrl);

  for (const cand of candidates(embedUrl)) {
    const snake = await db
      .query("games")
      .filter((q) => q.eq(q.field("embed_url"), cand))
      .first();
    if (snake) {
      const stored = (snake as any).embed_url ?? (snake as any).embedUrl ?? null;
      return { _id: snake._id, title: (snake as any).title, embedUrl: stored };
    }

    const camel = await db
      .query("games")
      .filter((q) => q.eq(q.field("embedUrl"), cand))
      .first();
    if (camel) {
      const stored = (camel as any).embed_url ?? (camel as any).embedUrl ?? null;
      return { _id: camel._id, title: (camel as any).title, embedUrl: stored };
    }
  }

  // Fallback: match por path normalizado si DB guardó URL absoluta
  if (normalizedTarget) {
    const all = await db.query("games").collect();
    const byPath = all.find((g: any) => normalizeStored(g.embed_url ?? g.embedUrl) === normalizedTarget);
    if (byPath) {
      const stored = (byPath as any).embed_url ?? (byPath as any).embedUrl ?? null;
      return { _id: (byPath as any)._id, title: (byPath as any).title, embedUrl: stored };
    }
  }

  return null;
}

export function normalizeEmbedUrl(raw?: string | null): string | null {
  return normalizePath(raw);
}
