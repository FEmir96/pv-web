import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Slot = "onLogin" | "prePlay";

function isNowActive(ad: any, now: number) {
  const { startAt, endAt, active } = ad ?? {};
  if (!active) return false;
  if (startAt && now < Number(startAt)) return false;
  if (endAt && now > Number(endAt)) return false;
  return true;
}

function pickWeighted<T extends { weight?: number }>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  const weights = items.map(i => Math.max(1, Number(i.weight ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function impressionsTodayForUserAd(db: any, userId: Id<"profiles">, adId: Id<"houseAds">) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const rows = await db
    .query("adEvents")
    .withIndex("by_user_time", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.gte(q.field("createdAt"), since))
    .collect();
  return rows.filter((e: any) => String(e.adId) === String(adId) && e.event === "impression").length;
}

/** Devuelve 1 anuncio elegible para un slot dado (sólo si el usuario es "free") */
export const getOneForSlot = query({
  args: {
    userId: v.id("profiles"),
    slot: v.union(v.literal("onLogin"), v.literal("prePlay")),
  },
  handler: async ({ db }, { userId, slot }) => {
    const user = await db.get(userId);
    if (!user || (user as any).role !== "free") {
      return { ok: false as const, reason: "not_free" as const };
    }

    const now = Date.now();
    const ads = await db
      .query("houseAds")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    const eligible: any[] = [];
    for (const ad of ads) {
      if (!isNowActive(ad, now)) continue;
      if (!Array.isArray(ad.slots) || !ad.slots.includes(slot)) continue;

      const freqCap = Number(ad.frequencyPerDay ?? 0);
      if (freqCap > 0) {
        const cnt = await impressionsTodayForUserAd(db, userId, ad._id);
        if (cnt >= freqCap) continue;
      }
      eligible.push(ad);
    }

    const chosen = pickWeighted(eligible);
    if (!chosen) return { ok: true as const, ad: null };

    // Top premium games para el carrusel (por popscore si existe)
    let featured: Array<{ _id: Id<"games">; title: string; cover_url?: string }> = [];
    try {
      const byScore = await db.query("games").withIndex("by_popscore").order("desc").take(20);
      featured = byScore
        .filter((g: any) => g.plan === "premium")
        .slice(0, 10)
        .map((g: any) => ({ _id: g._id, title: g.title, cover_url: g.cover_url }));
    } catch {
      const all = await db.query("games").collect();
      featured = all
        .filter((g: any) => g.plan === "premium")
        .sort((a: any, b: any) => Number(b.popscore ?? 0) - Number(a.popscore ?? 0))
        .slice(0, 10)
        .map((g: any) => ({ _id: g._id, title: g.title, cover_url: g.cover_url }));
    }

    const payload = {
      id: chosen._id as Id<"houseAds">,
      slot,
      title: chosen.title as string,
      subtitle: chosen.subtitle as string | undefined,
      body: chosen.body as string | undefined,
      ctaLabel: chosen.ctaLabel as string | undefined,
      ctaHref: chosen.ctaHref as string | undefined,
      imageUrl: chosen.imageUrl as string | undefined,
      videoUrl: chosen.videoUrl as string | undefined,
      theme: (chosen.theme as "dark" | "light" | undefined) ?? "dark",
      skipAfterSec: Number(chosen.skipAfterSec ?? 7),
      dismissible: chosen.dismissible !== false,
      featuredGames: featured,
    };

    return { ok: true as const, ad: payload };
  },
});

/** Tracking básico de eventos del anuncio */
export const trackEvent = mutation({
  args: {
    userId: v.id("profiles"),
    adId: v.id("houseAds"),
    slot: v.union(v.literal("onLogin"), v.literal("prePlay")),
    event: v.union(v.literal("impression"), v.literal("click"), v.literal("dismiss"), v.literal("complete")),
    gameId: v.optional(v.id("games")),
  },
  handler: async ({ db }, a) => {
    await db.insert("adEvents", {
      userId: a.userId,
      adId: a.adId,
      slot: a.slot,
      event: a.event,
      gameId: a.gameId,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Upsert admin de campañas */
export const adminUpsertAd = mutation({
  args: {
    key: v.string(),
    active: v.boolean(),
    slots: v.array(v.union(v.literal("onLogin"), v.literal("prePlay"))),
    title: v.string(),
    subtitle: v.optional(v.string()),
    body: v.optional(v.string()),
    ctaLabel: v.optional(v.string()),
    ctaHref: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    theme: v.optional(v.union(v.literal("dark"), v.literal("light"))),
    skipAfterSec: v.optional(v.number()),
    dismissible: v.optional(v.boolean()),
    weight: v.optional(v.number()),
    frequencyPerDay: v.optional(v.number()),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    createdBy: v.optional(v.id("profiles")),
  },
  handler: async ({ db }, a) => {
    const now = Date.now();
    const existing = await db.query("houseAds").withIndex("by_key", (q: any) => q.eq("key", a.key)).first();
    const doc = { ...a, createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing?._id) {
      await db.patch(existing._id, doc);
      return { ok: true as const, id: existing._id, updated: true as const };
    }
    const id = await db.insert("houseAds", doc);
    return { ok: true as const, id, created: true as const };
  },
});
