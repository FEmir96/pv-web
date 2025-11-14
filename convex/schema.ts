// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("free"), v.literal("premium"), v.literal("admin")),
    createdAt: v.number(),
    passwordHash: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    premiumSince: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),

    premiumPlan: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("annual"),
        v.literal("lifetime")
      )
    ),
    premiumExpiresAt: v.optional(v.number()),
    premiumAutoRenew: v.optional(v.boolean()),
    freeTrialUsed: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  games: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    cover_url: v.optional(v.string()),
    trailer_url: v.optional(v.string()),
    extraTrailerUrl: v.optional(v.string()),
    extraImages: v.optional(v.array(v.string())),
    plan: v.union(v.literal("free"), v.literal("premium")),
    createdAt: v.number(),
    genres: v.optional(v.array(v.string())),
    weeklyPrice: v.optional(v.number()),
    purchasePrice: v.optional(v.number()),

    igdbId: v.optional(v.number()),
    igdbSlug: v.optional(v.string()),
    igdbRating: v.optional(v.number()),
    igdbUserRating: v.optional(v.number()),
    igdbCriticRating: v.optional(v.number()),
    igdbRatingCount: v.optional(v.number()),
    igdbHypes: v.optional(v.number()),
    popscore: v.optional(v.number()),
    lastIgdbSyncAt: v.optional(v.number()),

    firstReleaseDate: v.optional(v.number()),
    developers: v.optional(v.array(v.string())),
    publishers: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),

    ageRatingSystem: v.optional(v.string()),
    ageRatingCode: v.optional(v.string()),
    ageRatingLabel: v.optional(v.string()),

    embed_url: v.optional(v.string()),
    embedUrl: v.optional(v.string()),
    embed_allow: v.optional(v.string()),
    embedAllow: v.optional(v.string()),
    embed_sandbox: v.optional(v.string()),
    embedSandbox: v.optional(v.string()),

    updatedAt: v.optional(v.number()),
  })
    .index("by_title", ["title"])
    .index("by_createdAt", ["createdAt"])
    .index("by_popscore", ["popscore"]),

  scores: defineTable({
    userId: v.id("profiles"),
    userEmail: v.string(),
    gameId: v.id("games"),
    gameTitle: v.optional(v.string()),
    score: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_game", ["userId", "gameId"])
    .index("by_game", ["gameId"]),

  // ✅ IMPORTANTE: restauramos transactions con type rental|purchase
  transactions: defineTable({
    userId: v.id("profiles"),
    gameId: v.id("games"),
    type: v.union(v.literal("rental"), v.literal("purchase")),
    basePrice: v.optional(v.number()),
    discountRate: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    finalPrice: v.optional(v.number()),
    expiresAt: v.optional(v.number()), // usado para rentals
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"])
    .index("by_game", ["gameId"])
    .index("by_expiresAt", ["expiresAt"]),

  payments: defineTable({
    userId: v.id("profiles"),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    provider: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "createdAt"]),

  upgrades: defineTable({
    userId: v.id("profiles"),
    fromRole: v.union(v.literal("free"), v.literal("premium"), v.literal("admin")),
    toRole: v.union(v.literal("free"), v.literal("premium"), v.literal("admin")),
    effectiveAt: v.optional(v.number()),
    paymentId: v.optional(v.id("payments")),
    status: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    plan: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("annual"),
        v.literal("lifetime")
      )
    ),
  }).index("by_user", ["userId"]),

  audits: defineTable({
    action: v.string(),
    entity: v.string(),
    entityId: v.union(v.id("games"), v.id("profiles")),
    requesterId: v.id("profiles"),
    timestamp: v.number(),
    details: v.optional(v.any()),
  }).index("by_entity", ["entity", "entityId"]),

  paymentMethods: defineTable({
    userId: v.id("profiles"),
    brand: v.union(
      v.literal("visa"),
      v.literal("mastercard"),
      v.literal("amex"),
      v.literal("otro")
    ),
    last4: v.string(),
    expMonth: v.number(),
    expYear: v.number(),
    panHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  favorites: defineTable({
    userId: v.id("profiles"),
    gameId: v.id("games"),
    createdAt: v.float64(),
  })
    .index("by_user", ["userId"])
    .index("by_user_game", ["userId", "gameId"])
    .index("by_game", ["gameId"]),

  upcomingGames: defineTable({
    title: v.string(),
    genre: v.optional(v.string()),
    releaseAt: v.number(),
    priority: v.optional(v.number()),
    cover_url: v.optional(v.string()),
    gameId: v.optional(v.id("games")),
    createdAt: v.number(),
  })
    .index("by_releaseAt", ["releaseAt"])
    .index("by_title", ["title"])
    .index("by_priority", ["priority"]),

  notifications: defineTable({
    userId: v.id("profiles"),
    type: v.union(
      v.literal("rental"),
      v.literal("new-game"),
      v.literal("discount"),
      v.literal("achievement"),
      v.literal("purchase"),
      v.literal("game-update"),
      v.literal("plan-expired"),
      v.literal("plan-renewed"),
      v.literal("plan-expiring")
    ),
    title: v.string(),
    message: v.string(),
    gameId: v.optional(v.id("games")),
    transactionId: v.optional(v.id("transactions")),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
    meta: v.optional(v.any()),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_isRead", ["userId", "isRead"]),

  pushTokens: defineTable({
    profileId: v.optional(v.id("profiles")),
    email: v.optional(v.string()),
    token: v.string(),
    platform: v.optional(
      v.union(
        v.literal("ios"),
        v.literal("android"),
        v.literal("web"),
        v.literal("unknown")
      )
    ),
    deviceId: v.optional(v.string()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    disabledAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_profile", ["profileId"])
    .index("by_email", ["email"])
    .index("by_deviceId", ["deviceId"]),

  subscriptions: defineTable({
    userId: v.id("profiles"),
    plan: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annual"),
      v.literal("lifetime")
    ),
    startAt: v.number(),
    expiresAt: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("expired")
    ),
    autoRenew: v.boolean(),
    paymentId: v.optional(v.id("payments")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_expiresAt", ["expiresAt"]),

  houseAds: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("profiles")),
  })
    .index("by_key", ["key"])
    .index("by_active", ["active"]),

  adEvents: defineTable({
    userId: v.id("profiles"),
    adId: v.id("houseAds"),
    slot: v.union(v.literal("onLogin"), v.literal("prePlay")),
    event: v.union(
      v.literal("impression"),
      v.literal("click"),
      v.literal("dismiss"),
      v.literal("complete")
    ),
    gameId: v.optional(v.id("games")),
    createdAt: v.number(),
  })
    .index("by_user_time", ["userId", "createdAt"])
    .index("by_ad_time", ["adId", "createdAt"]),

  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    profileId: v.optional(v.id("profiles")),
    userAgent: v.optional(v.string()),
    status: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  cartItems: defineTable({
    userId: v.id("profiles"),
    gameId: v.id("games"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_game", ["userId", "gameId"]),

  passwordResetTokens: defineTable({
    profileId: v.id("profiles"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
    requestIp: v.optional(v.string()),
    requestUserAgent: v.optional(v.string()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_profile", ["profileId", "createdAt"])
    .index("by_profile_unused", ["profileId", "usedAt"]),
});
