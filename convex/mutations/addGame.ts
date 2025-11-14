// convex/mutations/addGame.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Helpers: convierten null/"" a undefined y parsean números/arrays
function s(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t.length ? t : undefined;
}
function n(x: unknown): number | undefined {
  if (x == null) return undefined;
  if (typeof x === "number") return Number.isFinite(x) ? x : undefined;
  if (typeof x === "string") {
    const v = Number(x.replace(",", ".").trim());
    return Number.isFinite(v) ? v : undefined;
  }
  return undefined;
}
function arr(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out = x.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  return out.length ? out : undefined;
}

export const addGame = mutation({
  args: {
    requesterId: v.id("profiles"), // quién ejecuta
    title: v.string(),
    plan: v.union(v.literal("free"), v.literal("premium")),
    // estos pueden venir null desde formularios → los coacheamos a undefined
    description: v.optional(v.union(v.string(), v.null())),
    cover_url: v.optional(v.union(v.string(), v.null())),
    trailer_url: v.optional(v.union(v.string(), v.null())),
    extraTrailerUrl: v.optional(v.union(v.string(), v.null())),
    extraImages: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    purchasePrice: v.optional(v.union(v.number(), v.string(), v.null())),
    weeklyPrice: v.optional(v.union(v.number(), v.string(), v.null())),
    embed_url: v.optional(v.union(v.string(), v.null())),
    embed_allow: v.optional(v.union(v.string(), v.null())),
    embed_sandbox: v.optional(v.union(v.string(), v.null())),
  },
  handler: async ({ db }, args) => {
    const now = Date.now();

    // 1) Validar admin
    const requester = await db.get(args.requesterId);
    if (!requester || requester.role !== "admin") {
      throw new Error("No autorizado. Solo un admin puede agregar juegos.");
    }

    // 2) Evitar duplicados por título (ajustá si usás unique index)
    const dup = await db
      .query("games")
      .filter((q) => q.eq(q.field("title"), args.title))
      .unique();
    if (dup) {
      return { status: "exists", message: `El juego "${args.title}" ya existe en el catálogo.` };
    }

    // 3) Armar doc: JAMÁS mandamos null; sólo seteamos si tenemos valor
    const doc: any = {
      title: args.title,
      plan: args.plan,
      createdAt: now,
      updatedAt: now,
    };

    // strings opcionales
    const optionalStrings = {
      description: s(args.description),
      cover_url: s(args.cover_url),
      trailer_url: s(args.trailer_url),
      extraTrailerUrl: s(args.extraTrailerUrl),
      embed_url: s(args.embed_url),
      embed_allow: s(args.embed_allow),
      embed_sandbox: s(args.embed_sandbox),
    };
    for (const [k, val] of Object.entries(optionalStrings)) {
      if (val !== undefined) doc[k] = val;
    }

    // números opcionales
    const optionalNumbers = {
      purchasePrice: n(args.purchasePrice),
      weeklyPrice: n(args.weeklyPrice),
    };
    for (const [k, val] of Object.entries(optionalNumbers)) {
      if (val !== undefined) doc[k] = val;
    }

    // arrays opcionales
    const optionalArrays = {
      extraImages: arr(args.extraImages),
      genres: arr(args.genres),
    };
    for (const [k, val] of Object.entries(optionalArrays)) {
      if (val !== undefined) doc[k] = val;
    }

    // 4) Insert
    const gameId = await db.insert("games", doc);

    // 5) Auditoría
    await db.insert("audits", {
      action: "add_game",
      entity: "game",
      entityId: gameId,
      requesterId: args.requesterId,
      timestamp: now,
      details: { title: args.title, plan: args.plan },
    });

    // 6) Notificación “nuevo juego” por usuario (independiente)
    try {
      const profiles = await db.query("profiles").collect();
      const rows = profiles
        .filter((p) => p._id !== args.requesterId)
        .map((p) => ({
          userId: p._id,
          type: "new-game" as const,
          title: "Nuevo juego agregado",
          message: `"${args.title}" ya está disponible en el catálogo.`,
          gameId,
          transactionId: undefined,
          isRead: false,
          readAt: undefined,
          createdAt: Date.now(),
          meta: { href: `/juego/${String(gameId)}` },
        }));
      for (const r of rows) await db.insert("notifications", r);
    } catch (e) {
      console.error("addGame notifications error", e);
    }

    return {
      status: "inserted",
      message: `Juego "${args.title}" agregado correctamente.`,
      gameId,
    };
  },
});
