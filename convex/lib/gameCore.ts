// convex/lib/gameCore.ts
import type { Id } from "../_generated/dataModel";
import type { DatabaseWriter } from "../_generated/server";

/* ============ Config de notificaciones ============ */
// Si no hay watchers (favoritos/transacciones), avisar igual:
//  - juegos premium -> sólo premium (y opc. admins)
//  - juegos free    -> todos (free/premium/admin)
const NOTIFY_ALL_WHEN_NO_WATCHERS = true;
const INCLUDE_ADMINS_FOR_PREMIUM = false;
/* ================================================ */

/* ───────────────── helpers ───────────────── */
function cleanStr(input: string | null | undefined): string | undefined {
  if (input === null) return undefined;
  if (typeof input !== "string") return undefined;
  const t = input.trim();
  return t.length ? t : undefined;
}
function toNum(input: number | string | null | undefined): number | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  const n = Number(String(input).replace(",", ".").trim());
  return Number.isFinite(n) ? n : undefined;
}
function arraysEqual(a?: string[] | null, b?: string[] | null) {
  const A = Array.isArray(a) ? a : [];
  const B = Array.isArray(b) ? b : [];
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}
function nonEmptyList(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out = x.map(s => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  return out.length ? out : undefined;
}
async function ensureAdminIfProvided(
  db: DatabaseWriter,
  requesterId?: Id<"profiles"> | null
) {
  if (!requesterId) return; // compat: si no lo pasan, no rompemos
  const p = await db.get(requesterId);
  if (!p || (p as any).role !== "admin") {
    throw new Error("No autorizado. Se requiere rol admin.");
  }
}

/** Inserta en "notifications" omitiendo claves undefined para cumplir el schema */
async function safeInsertNotification(
  db: DatabaseWriter,
  doc: {
    userId: Id<"profiles">;
    type: "rental" | "new-game" | "discount" | "achievement" | "purchase" | "game-update" | "plan-expired" | "plan-renewed";
    title: string;
    message: string;
    gameId?: Id<"games"> | undefined;
    transactionId?: Id<"transactions"> | undefined;
    isRead?: boolean | undefined;
    readAt?: number | undefined;
    createdAt?: number | undefined;
    meta?: unknown;
  }
) {
  const toInsert: any = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) toInsert[k] = v;
  }
  // defaults
  if (toInsert.isRead === undefined) toInsert.isRead = false;
  if (toInsert.createdAt === undefined) toInsert.createdAt = Date.now();
  return db.insert("notifications", toInsert);
}

function buildUpdateMsg(
  changes: {
    title?: boolean;
    plan?: { before: string; after: string };
    description?: boolean;
    genres?: boolean;
    media?: { cover?: boolean; trailer?: boolean; extraTrailer?: boolean; images?: boolean };
    pricing?: {
      buy?: { before?: number; after?: number };
      rent?: { before?: number; after?: number };
    };
    removed?: boolean;
    restored?: boolean;
  },
  gameTitle: string
) {
  if (changes.removed) return `Se retiró del catálogo: ${gameTitle}.`;
  if (changes.restored) return `Se reincorporó al catálogo: ${gameTitle}.`;

  const parts: string[] = [];
  if (changes.title) parts.push("título");
  if (changes.plan) parts.push(`plan (${changes.plan.before} → ${changes.plan.after})`);
  if (changes.description) parts.push("descripción/sinopsis");
  if (changes.genres) parts.push("géneros");

  const m: string[] = [];
  if (changes.media?.cover) m.push("cover");
  if (changes.media?.trailer) m.push("trailer");
  if (changes.media?.extraTrailer) m.push("trailer extra");
  if (changes.media?.images) m.push("imágenes");
  if (m.length) parts.push(`contenido multimedia (${m.join(", ")})`);

  const p: string[] = [];
  if (changes.pricing?.buy) {
    const b = changes.pricing.buy;
    p.push(`compra ${b.before ?? "—"} → ${b.after ?? "—"}`);
  }
  if (changes.pricing?.rent) {
    const r = changes.pricing.rent;
    p.push(`alquiler ${r.before ?? "—"} → ${r.after ?? "—"}`);
  }
  if (p.length) parts.push(`precios (${p.join(" | ")})`);

  if (!parts.length) return `Se actualizaron detalles de ${gameTitle}.`;
  return `Se actualizaron: ${parts.join(", ")}.`;
}

/* ─────────────── CREATE ─────────────── */
export type CreateGameInput = {
  requesterId?: Id<"profiles"> | null;
  title: string;
  plan: "free" | "premium";
  description?: string | null;
  cover_url?: string | null;
  trailer_url?: string | null;
  extraTrailerUrl?: string | null;
  extraImages?: string[] | null;
  genres?: string[] | null;
  weeklyPrice?: number | string | null;
  purchasePrice?: number | string | null;
  embed_url?: string | null;
  embedUrl?: string | null;
  embed_allow?: string | null;
  embedAllow?: string | null;
  embed_sandbox?: string | null;
  embedSandbox?: string | null;
};

export async function createGameCore(db: DatabaseWriter, args: CreateGameInput) {
  await ensureAdminIfProvided(db, args.requesterId);
  const now = Date.now();

  const doc: any = {
    title: args.title,
    plan: args.plan,
    createdAt: now,
    updatedAt: now,
  };

  const optStrings = {
    description: cleanStr(args.description),
    cover_url: cleanStr(args.cover_url),
    trailer_url: cleanStr(args.trailer_url),
    extraTrailerUrl: cleanStr(args.extraTrailerUrl),
    embed_url: cleanStr(args.embed_url ?? args.embedUrl),
    embedUrl: cleanStr(args.embedUrl ?? args.embed_url),
    embed_allow: cleanStr(args.embed_allow ?? args.embedAllow),
    embedAllow: cleanStr(args.embedAllow ?? args.embed_allow),
    embed_sandbox: cleanStr(args.embed_sandbox ?? args.embedSandbox),
    embedSandbox: cleanStr(args.embedSandbox ?? args.embed_sandbox),
  };
  for (const [k, v] of Object.entries(optStrings)) if (v !== undefined) doc[k] = v;

  const optNumbers = {
    weeklyPrice: toNum(args.weeklyPrice),
    purchasePrice: toNum(args.purchasePrice),
  };
  for (const [k, v] of Object.entries(optNumbers)) if (v !== undefined) doc[k] = v;

  const optArrays = {
    extraImages: nonEmptyList(args.extraImages ?? undefined),
    genres: nonEmptyList(args.genres ?? undefined),
  };
  for (const [k, v] of Object.entries(optArrays)) if (v !== undefined) doc[k] = v;

  const gameId = await db.insert("games", doc);

  const allProfiles = await db.query("profiles").collect();
  const recipients = allProfiles.filter((p: any) => {
    if (args.requesterId && String(p._id) === String(args.requesterId)) return false;
    const role = p.role as "free" | "premium" | "admin" | undefined;
    if (args.plan === "premium") {
      if (role === "premium") return true;
      if (INCLUDE_ADMINS_FOR_PREMIUM && role === "admin") return true;
      return false;
    }
    return role === "free" || role === "premium" || role === "admin";
  });

  const message =
    args.plan === "premium"
      ? "Se agregó un nuevo juego al catálogo (Premium)."
      : "Se agregó un nuevo juego al catálogo.";

  for (const p of recipients) {
    await safeInsertNotification(db, {
      userId: p._id as Id<"profiles">,
      type: "new-game",
      title: `Nuevo juego: ${args.title}`,
      message,
      gameId,
      meta: { href: `/juego/${String(gameId)}` },
    });
  }

  await db.insert("audits", {
    action: "add_game",
    entity: "game",
    entityId: gameId,
    requesterId: (args.requesterId as Id<"profiles">) ?? allProfiles[0]?._id,
    timestamp: now,
    details: { title: args.title, plan: args.plan },
  });

  return { ok: true as const, id: gameId };
}

/* ─────────────── UPDATE ─────────────── */
export type UpdateGameInput = {
  gameId: Id<"games">;
  requesterId?: Id<"profiles"> | null;

  title?: string | null;
  description?: string | null;
  cover_url?: string | null;
  trailer_url?: string | null;
  extraTrailerUrl?: string | null;
  extraImages?: string[] | null;
  genres?: string[] | null;

  purchasePrice?: number | string | null;
  weeklyPrice?: number | string | null;

  embed_url?: string | null;
  embed_allow?: string | null;
  embed_sandbox?: string | null;

  plan?: "free" | "premium";
};

export async function updateGameCore(db: DatabaseWriter, args: UpdateGameInput) {
  await ensureAdminIfProvided(db, args.requesterId);

  const existing = await db.get(args.gameId);
  if (!existing) throw new Error("Juego no encontrado.");

  const updates: Record<string, any> = {};
  const before: Record<string, any> = {};

  const setField = (
    key: keyof typeof existing,
    incoming: any,
    transform: (x: any) => any
  ) => {
    if (incoming === undefined) return;
    const next = transform(incoming);
    const prev = (existing as any)[key];
    const changed =
      Array.isArray(next) && Array.isArray(prev) ? !arraysEqual(next, prev) : next !== prev;
    if (changed) {
      updates[key as string] = next;
      before[key as string] = prev;
    }
  };

  setField("title", args.title, cleanStr);
  setField("description", args.description, cleanStr);
  setField("cover_url", args.cover_url, cleanStr);
  setField("trailer_url", args.trailer_url, cleanStr);
  setField("extraTrailerUrl", args.extraTrailerUrl, cleanStr);
  setField("extraImages", args.extraImages, nonEmptyList);
  setField("genres", args.genres, nonEmptyList);
  setField("purchasePrice", args.purchasePrice, toNum);
  setField("weeklyPrice", args.weeklyPrice, toNum);

  setField("embed_url", args.embed_url, cleanStr);
  setField("embed_allow", args.embed_allow, cleanStr);
  setField("embed_sandbox", args.embed_sandbox, cleanStr);

  if (args.plan !== undefined && args.plan !== (existing as any).plan) {
    updates.plan = args.plan;
    before.plan = (existing as any).plan;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No se realizaron cambios.");
  }

  updates.updatedAt = Date.now();
  await db.patch(args.gameId, updates);

  // Auditoría con fallback de requesterId si no vino
  let requesterId: Id<"profiles"> | undefined = args.requesterId ?? undefined;
  if (!requesterId) {
    const some = await db.query("profiles").collect();
    requesterId = some[0]?._id as Id<"profiles"> | undefined;
  }
  await db.insert("audits", {
    action: "update_game",
    entity: "game",
    entityId: args.gameId,
    requesterId: requesterId!,
    timestamp: Date.now(),
    details: { before, after: updates },
  });

  // Notificaciones
  try {
    const changes = {
      title: "title" in updates,
      plan:
        "plan" in updates ? { before: before.plan as string, after: updates.plan as string } : undefined,
      description: "description" in updates,
      genres: "genres" in updates,
      media: {
        cover: "cover_url" in updates,
        trailer: "trailer_url" in updates,
        extraTrailer: "extraTrailerUrl" in updates,
        images: "extraImages" in updates,
      },
      pricing: {
        buy: "purchasePrice" in updates
          ? { before: before.purchasePrice as number | undefined, after: updates.purchasePrice as number | undefined }
          : undefined,
        rent: "weeklyPrice" in updates
          ? { before: before.weeklyPrice as number | undefined, after: updates.weeklyPrice as number | undefined }
          : undefined,
      },
    } as const;

    const msg = buildUpdateMsg(changes as any, (existing as any).title ?? "Juego");

    // 1) WATCHERS: favoritos + transacciones
    const targets = new Set<Id<"profiles">>();

    // favoritos (usar índice si existe)
    try {
      const favs = await (db as any)
        .query("favorites")
        .withIndex?.("by_game", (q: any) => q.eq("gameId", args.gameId))
        .collect();
      for (const f of favs ?? []) targets.add((f as any).userId);
    } catch {
      const favs = await db.query("favorites").collect();
      for (const f of favs) {
        if (String((f as any).gameId) === String(args.gameId)) targets.add((f as any).userId);
      }
    }

    // transacciones (usar índice si existe)
    try {
      const txs = await (db as any)
        .query("transactions")
        .withIndex?.("by_game", (q: any) => q.eq("gameId", args.gameId))
        .collect();
      for (const t of txs ?? []) targets.add((t as any).userId);
    } catch {
      const txs = await db.query("transactions").collect();
      for (const t of txs) {
        if (String((t as any).gameId) === String(args.gameId)) targets.add((t as any).userId);
      }
    }

    // No notificar al admin que hizo el cambio
    if (args.requesterId) targets.delete(args.requesterId);

    // 2) Fallback opcional si no hay watchers
    if (NOTIFY_ALL_WHEN_NO_WATCHERS && targets.size === 0) {
      const everyone = await db.query("profiles").collect();
      const plan = (updates.plan ?? (existing as any).plan) as "free" | "premium";

      for (const p of everyone as any[]) {
        const role = p.role as "free" | "premium" | "admin" | undefined;
        if (plan === "premium") {
          if (role === "premium" || (INCLUDE_ADMINS_FOR_PREMIUM && role === "admin")) {
            targets.add(p._id);
          }
        } else {
          if (role === "free" || role === "premium" || role === "admin") {
            targets.add(p._id);
          }
        }
      }
      if (args.requesterId) targets.delete(args.requesterId);
    }

    // 3) Insertar notificaciones (sin undefined)
    const now = Date.now();
    for (const userId of targets) {
      await safeInsertNotification(db, {
        userId,
        type: "game-update",
        title: (existing as any).title ?? "Juego actualizado",
        message: msg,
        gameId: args.gameId,
        createdAt: now,
        meta: { href: `/juego/${String(args.gameId)}`, fields: Object.keys(updates) },
      });
    }
  } catch (e) {
    console.error("updateGameCore: notifications error", e);
  }

  return {
    status: "updated" as const,
    gameId: args.gameId,
    planChanged: "plan" in updates,
    updates,
    message: "Juego actualizado con éxito",
  };
}

/* ─────────────── DELETE ─────────────── */
export async function deleteGameCore(
  db: DatabaseWriter,
  args: { requesterId?: Id<"profiles"> | null; gameId: Id<"games"> }
) {
  await ensureAdminIfProvided(db, args.requesterId);

  const game = await db.get(args.gameId);
  if (!game) throw new Error("Juego no encontrado.");

  await db.delete(args.gameId);

  const now = Date.now();
  const profiles = await db.query("profiles").collect();
  const recipients = args.requesterId
    ? profiles.filter((p) => p._id !== args.requesterId)
    : profiles;

  for (const p of recipients) {
    await safeInsertNotification(db, {
      userId: p._id,
      type: "game-update",
      title: `Juego retirado: ${(game as any).title}`,
      message: "Un juego fue retirado del catálogo.",
      createdAt: now,
    });
  }

  await db.insert("audits", {
    action: "delete_game",
    entity: "game",
    entityId: args.gameId,
    requesterId: (args.requesterId as Id<"profiles">) ?? profiles[0]?._id,
    timestamp: now,
    details: {
      deletedTitle: (game as any).title,
      snapshot: {
        title: (game as any).title,
        description: (game as any).description,
        cover_url: (game as any).cover_url,
        trailer_url: (game as any).trailer_url,
        plan: (game as any).plan,
        createdAt: (game as any).createdAt,
      },
    },
  });

  return { ok: true as const, deleted: true, id: args.gameId };
}
