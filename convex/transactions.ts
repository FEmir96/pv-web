// convex/transactions.ts
import { mutation, query as txQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  buildPurchaseEmail,
  buildRentalEmail,
  buildExtendEmail,
  buildCartEmail,
} from "./lib/emailTemplates";
import {
  getDiscountRateForUser,
  computePricing,
  combinePricing,
} from "./lib/pricing";

const APP_URL = process.env.APP_URL || "https://playverse.com";

/** Inicia alquiler */
export const startRental = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
    weeks: v.number(),
    weeklyPrice: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async ({ db, scheduler }, { userId, gameId, weeks, weeklyPrice, currency }) => {
    const now = Date.now();
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    const cur = currency || "USD";

    const existingRental = await db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "rental"))
      .filter((q) => q.eq(q.field("gameId"), gameId))
      .first();

    if (existingRental && typeof existingRental.expiresAt === "number" && existingRental.expiresAt > now) {
      throw new Error("ALREADY_RENTED_ACTIVE");
    }

    const user = await db.get(userId);
    const game = await db.get(gameId);

    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    const weeklyBase =
      typeof (game as any)?.weeklyPrice === "number"
        ? (game as any).weeklyPrice
        : typeof weeklyPrice === "number"
        ? weeklyPrice
        : 0;
    const baseAmount = weeklyBase * weeks;
    const discountRate = getDiscountRateForUser(user);
    const pricing = computePricing(baseAmount, discountRate);

    const expiresAt = now + weeks * MS_WEEK;

    await db.insert("transactions", {
      userId,
      gameId,
      type: "rental",
      createdAt: now,
      expiresAt,
      basePrice: pricing.basePrice,
      discountRate: pricing.discountRate,
      discountAmount: pricing.discountAmount,
      finalPrice: pricing.finalPrice,
    });

    if (pricing.finalPrice > 0) {
      await db.insert("payments", {
        userId,
        amount: pricing.finalPrice,
        currency: cur,
        status: "completed",
        provider: "manual",
        createdAt: now,
      });
    }

    if (user?.email) {
      const coverUrl = (game as any)?.cover_url ?? null;
      const amount = (weeklyPrice || 0) * weeks;

      await scheduler.runAfter(0, (api as any).actions.email.sendReceiptEmail, {
        to: user.email,
        subject: `PlayVerse – Alquiler confirmado: ${game?.title ?? "Juego"}`,
        html: buildRentalEmail({
          userName: user.name ?? "",
          gameTitle: (game as any)?.title ?? "",
          coverUrl,
          amount: pricing.finalPrice,
          basePrice: pricing.basePrice,
          discountAmount: pricing.discountAmount,
          finalPrice: pricing.finalPrice,
          currency: cur,
          method: "Tarjeta guardada",
          orderId: null,
          appUrl: APP_URL,
          weeks,
          expiresAt,
        }),
        replyTo: user.email,
      });
    }

    return { ok: true as const, expiresAt, finalPrice: pricing.finalPrice };
  },
});

/** Extiende alquiler */
export const extendRental = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
    weeks: v.number(),
    weeklyPrice: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async ({ db, scheduler }, { userId, gameId, weeks, weeklyPrice, currency }) => {
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const cur = currency || "USD";

    const tx = await db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "rental"))
      .filter((q) => q.eq(q.field("gameId"), gameId))
      .first();

    const user = await db.get(userId);
    const game = await db.get(gameId);

    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    const weeklyBase =
      typeof (game as any)?.weeklyPrice === "number"
        ? (game as any).weeklyPrice
        : typeof weeklyPrice === "number"
        ? weeklyPrice
        : 0;
    const extensionBase = weeklyBase * weeks;
    const discountRate = getDiscountRateForUser(user);
    const extensionPricing = computePricing(extensionBase, discountRate);

    const base = tx?.expiresAt && tx.expiresAt > now ? tx.expiresAt : now;
    const newExpiresAt = base + weeks * MS_WEEK;

    if (tx) {
      const merged = combinePricing(
        {
          basePrice: tx.basePrice ?? 0,
          discountRate: tx.discountRate ?? 0,
          discountAmount: tx.discountAmount ?? 0,
          finalPrice: tx.finalPrice ?? 0,
        },
        extensionPricing
      );
      await db.patch(tx._id, {
        expiresAt: newExpiresAt,
        basePrice: merged.basePrice,
        discountRate: merged.discountRate,
        discountAmount: merged.discountAmount,
        finalPrice: merged.finalPrice,
      });
    } else {
      await db.insert("transactions", {
        userId,
        gameId,
        type: "rental",
        createdAt: now,
        expiresAt: newExpiresAt,
        basePrice: extensionPricing.basePrice,
        discountRate: extensionPricing.discountRate,
        discountAmount: extensionPricing.discountAmount,
        finalPrice: extensionPricing.finalPrice,
      });
    }

    if (extensionPricing.finalPrice > 0) {
      await db.insert("payments", {
        userId,
        amount: extensionPricing.finalPrice,
        currency: cur,
        status: "completed",
        provider: "manual",
        createdAt: now,
      });
    }

    if (user?.email) {
      const coverUrl = (game as any)?.cover_url ?? null;
      const amount = (weeklyPrice || 0) * weeks;

      await scheduler.runAfter(0, (api as any).actions.email.sendReceiptEmail, {
        to: user.email,
        subject: `PlayVerse – Extensión de alquiler: ${game?.title ?? "Juego"}`,
        html: buildExtendEmail({
          userName: user.name ?? "",
          gameTitle: (game as any)?.title ?? "",
          coverUrl,
          amount: extensionPricing.finalPrice,
          basePrice: extensionPricing.basePrice,
          discountAmount: extensionPricing.discountAmount,
          finalPrice: extensionPricing.finalPrice,
          currency: cur,
          method: "Tarjeta guardada",
          orderId: null,
          appUrl: APP_URL,
          weeks,
          expiresAt: newExpiresAt,
        }),
        replyTo: user.email,
      });
    }

    return { ok: true as const, expiresAt: newExpiresAt, finalPrice: extensionPricing.finalPrice };
  },
});

/** Compra simple */
export const purchaseGame = mutation({
  args: {
    userId: v.id("profiles"),
    gameId: v.id("games"),
    amount: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async ({ db, scheduler }, { userId, gameId, amount, currency }) => {
    const now = Date.now();
    const cur = currency || "USD";

    const existingPurchase = await db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "purchase"))
      .filter((q) => q.eq(q.field("gameId"), gameId))
      .first();

    if (existingPurchase) throw new Error("ALREADY_OWNED");

    const user = await db.get(userId);
    const game = await db.get(gameId);

    if (!game) throw new Error("GAME_NOT_FOUND");

    const basePrice =
      typeof (game as any)?.purchasePrice === "number"
        ? (game as any).purchasePrice
        : typeof (game as any)?.price_buy === "number"
        ? (game as any).price_buy
        : amount;

    const discountRate = getDiscountRateForUser(user);
    const pricing = computePricing(basePrice, discountRate);

    await db.insert("transactions", {
      userId,
      gameId,
      type: "purchase",
      createdAt: now,
      basePrice: pricing.basePrice,
      discountRate: pricing.discountRate,
      discountAmount: pricing.discountAmount,
      finalPrice: pricing.finalPrice,
    });
    await db.insert("payments", {
      userId,
      amount: pricing.finalPrice,
      currency: cur,
      status: "completed",
      provider: "manual",
      createdAt: now,
    });

    // ⬇️ Limpieza: si ese juego estaba en el carrito, quitarlo
    try {
      const row = await db
        .query("cartItems")
        .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gameId))
        .first();
      if (row) await db.delete(row._id);
    } catch {}

    if (user?.email) {
      const coverUrl = (game as any)?.cover_url ?? null;
      await scheduler.runAfter(0, (api as any).actions.email.sendReceiptEmail, {
        to: user.email,
        subject: `PlayVerse – Compra confirmada: ${game?.title ?? "Juego"}`,
        html: buildPurchaseEmail({
          userName: user.name ?? "",
          gameTitle: (game as any)?.title ?? "",
          coverUrl,
          amount: pricing.finalPrice,
          basePrice: pricing.basePrice,
          discountAmount: pricing.discountAmount,
          finalPrice: pricing.finalPrice,
          currency: cur,
          method: "AMEX •••• 4542",
          orderId: null,
          appUrl: APP_URL,
        }),
        replyTo: user.email,
      });
    }

    return { ok: true as const, finalPrice: pricing.finalPrice };
  },
});

/** ✅ Compra de carrito (varios juegos) — acepta paymentMethodId opcional y limpia carrito */
export const purchaseCart = mutation({
  args: {
    userId: v.id("profiles"),
    gameIds: v.array(v.id("games")),
    currency: v.optional(v.string()),
    paymentMethodId: v.optional(v.id("paymentMethods")), // ← aceptamos lo que manda el front
  },
  handler: async ({ db, scheduler }, { userId, gameIds, currency, paymentMethodId }) => {
    const cur = currency || "USD";
    const now = Date.now();
    const purchaser = await db.get(userId);
    const discountRate = getDiscountRateForUser(purchaser);

    // Método de pago sólo para mostrar en el email
    const pm = paymentMethodId ? await db.get(paymentMethodId) : null;
    const brand = String((pm as any)?.brand || "").toLowerCase();
    const last4 = String((pm as any)?.last4 || "").slice(-4);
    const brandLabel =
      brand.includes("visa") ? "VISA" :
      brand.includes("master") ? "MASTERCARD" :
      brand.includes("amex") ? "AMEX" :
      brand ? brand.toUpperCase() : "Tarjeta";
    const methodLabel = pm ? `${brandLabel} •••• ${last4}` : "Tarjeta guardada";

    // Únicos
    const ids = Array.from(new Set(gameIds.map((g) => g as Id<"games">)));

    // Filtrar ya comprados
    const already = await db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "purchase"))
      .collect();

    const alreadyIds = new Set(already.map((t) => String(t.gameId)));
    const toBuyIds = ids.filter((id) => !alreadyIds.has(String(id)));

    if (toBuyIds.length === 0) {
      // Igual limpiamos del carrito los ids intentados
      for (const gid of ids) {
        const row = await db
          .query("cartItems")
          .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gid))
          .first();
        if (row) await db.delete(row._id);
      }
      return { ok: true as const, purchased: 0, skipped: ids.length, total: 0 };
    }

    // Traer juegos y armar líneas con precio actual
    const games = await Promise.all(toBuyIds.map((id) => db.get(id)));
    const lines = games
      .filter(Boolean)
      .map((g: any) => {
        const basePrice =
          typeof g.purchasePrice === "number"
            ? g.purchasePrice
            : typeof g.price_buy === "number"
            ? g.price_buy
            : 49.99;
        const pricing = computePricing(basePrice, discountRate);
        return {
          id: g._id as Id<"games">,
          title: g.title ?? "Juego",
          cover: g.cover_url ?? null,
          pricing,
        };
      });

    const total = lines.reduce((a, l) => a + (l.pricing?.finalPrice || 0), 0);

    // Transacciones y pago único
    for (const line of lines) {
      await db.insert("transactions", {
        userId,
        gameId: line.id,
        type: "purchase",
        createdAt: now,
        basePrice: line.pricing.basePrice,
        discountRate: line.pricing.discountRate,
        discountAmount: line.pricing.discountAmount,
        finalPrice: line.pricing.finalPrice,
      });
    }
    await db.insert("payments", {
      userId, amount: total, currency: cur, status: "completed", provider: "manual", createdAt: now,
    });

    // ⬇️ Limpieza: quitar del carrito TODOS los ids intentados (comprados o ya poseídos)
    for (const gid of ids) {
      const row = await db
        .query("cartItems")
        .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gid))
        .first();
      if (row) await db.delete(row._id);
    }

    // Email de carrito
    if (purchaser?.email) {
      await scheduler.runAfter(0, (api as any).actions.email.sendReceiptEmail, {
        to: purchaser.email,
        subject: `PlayVerse – Compra confirmada (${lines.length} ítems)`,
        html: buildCartEmail({
          userName: purchaser.name ?? "",
          items: lines.map((l) => ({
            title: l.title,
            coverUrl: l.cover,
            amount: l.pricing.finalPrice,
            basePrice: l.pricing.basePrice,
            discountAmount: l.pricing.discountAmount,
            finalPrice: l.pricing.finalPrice,
          })),
          currency: cur,
          method: methodLabel,
          appUrl: APP_URL,
        }),
        replyTo: purchaser.email,
      });
    }

    return {
      ok: true as const,
      purchased: lines.length,
      skipped: ids.length - lines.length,
      total,
      finalPrice: total,
    };
  },
});

/** Lista alquileres por vencimiento (existente) */
export const listRentalsExpiring = txQuery({
  args: { now: v.number(), upTo: v.number() },
  handler: async (ctx, { now, upTo }) => {
    const all = await ctx.db.query("transactions").collect();
    return all
      .filter((t) => t.type === "rental")
      .filter((t) => typeof t.expiresAt === "number" && (t.expiresAt as number) >= now && (t.expiresAt as number) <= upTo)
      .map((t) => ({
        _id: t._id as Id<"transactions">,
        userId: t.userId as Id<"profiles">,
        gameId: t.gameId as Id<"games">,
        expiresAt: t.expiresAt as number,
      }));
  },
});
