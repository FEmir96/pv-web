// convex/pushTokens.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const PlatformV = v.union(
  v.literal("ios"),
  v.literal("android"),
  v.literal("web"),
  v.literal("unknown")
);

export const register = mutation({
  args: {
    token: v.string(),
    platform: v.optional(PlatformV),
    profileId: v.optional(v.id("profiles")),
    email: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  },
  handler: async ({ db }, args) => {
    const token = args.token.trim();
    if (!token) {
      throw new Error("token_required");
    }
    const now = Date.now();

    let existing = null;
    try {
      existing = await db
        .query("pushTokens")
        .withIndex("by_token", (q: any) => q.eq("token", token))
        .first();
    } catch {
      const scan = await db.query("pushTokens").collect();
      existing = scan.find((row: any) => row.token === token) ?? null;
    }

    if (!existing && args.deviceId) {
      const deviceKey = args.deviceId.trim();
      try {
        existing = await db
          .query("pushTokens")
          .withIndex("by_deviceId", (q: any) => q.eq("deviceId", deviceKey))
          .first();
      } catch {
        const scan = await db.query("pushTokens").collect();
        existing =
          scan.find((row: any) => String(row.deviceId ?? "") === deviceKey) ?? null;
      }
    }

    if (existing) {
      await db.patch(existing._id, {
        profileId: args.profileId ?? existing.profileId ?? undefined,
        email: args.email ?? existing.email ?? undefined,
        platform: args.platform ?? existing.platform ?? "unknown",
        deviceId: args.deviceId ?? existing.deviceId ?? undefined,
        token,
        lastUsedAt: now,
        updatedAt: now,
        disabledAt: undefined,
      });
      return { ok: true as const, updated: true as const, id: existing._id };
    }

    const id = await db.insert("pushTokens", {
      token,
      profileId: args.profileId ?? undefined,
      email: args.email ?? undefined,
      platform: args.platform ?? "unknown",
      deviceId: args.deviceId ?? undefined,
      lastUsedAt: now,
      createdAt: now,
      updatedAt: now,
      disabledAt: undefined,
    });

    return { ok: true as const, created: true as const, id };
  },
});

export const unregister = mutation({
  args: {
    token: v.string(),
  },
  handler: async ({ db }, { token }) => {
    const normalized = token.trim();
    if (!normalized) {
      return { ok: false as const, reason: "token_required" as const };
    }

    let existing = null;
    try {
      existing = await db
        .query("pushTokens")
        .withIndex("by_token", (q: any) => q.eq("token", normalized))
        .first();
    } catch {
      const scan = await db.query("pushTokens").collect();
      existing = scan.find((row: any) => row.token === normalized) ?? null;
    }

    if (!existing) {
      return { ok: false as const, reason: "not_found" as const };
    }

    await db.patch(existing._id, {
      disabledAt: Date.now(),
    });
    return { ok: true as const, disabled: true as const };
  },
});

export const markInvalid = mutation({
  args: {
    token: v.string(),
  },
  handler: async ({ db }, { token }) => {
    const normalized = token.trim();
    if (!normalized) {
      return { ok: false as const, reason: "token_required" as const };
    }

    let existing = null;
    try {
      existing = await db
        .query("pushTokens")
        .withIndex("by_token", (q: any) => q.eq("token", normalized))
        .first();
    } catch {
      const scan = await db.query("pushTokens").collect();
      existing = scan.find((row: any) => row.token === normalized) ?? null;
    }

    if (!existing) {
      return { ok: false as const, reason: "not_found" as const };
    }

    await db.patch(existing._id, {
      disabledAt: Date.now(),
    });
    return { ok: true as const, disabled: true as const };
  },
});

export const tokensForProfile = query({
  args: {
    profileId: v.id("profiles"),
  },
  handler: async ({ db }, { profileId }) => {
    try {
      return await db
        .query("pushTokens")
        .withIndex("by_profile", (q: any) => q.eq("profileId", profileId))
        .collect();
    } catch {
      const scan = await db.query("pushTokens").collect();
      return scan.filter((row: any) => String(row.profileId) === String(profileId));
    }
  },
});
