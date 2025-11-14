import { query } from "../_generated/server";
import { v } from "convex/values";
import { sha256Hex } from "../lib/hash";

export const validateToken = query({
  args: {
    token: v.string(),
  },
  handler: async ({ db }, { token }) => {
    if (!token || typeof token !== "string") {
      return { ok: false as const, error: "missing_token" as const };
    }

    const tokenHash = await sha256Hex(token);
    let stored: any | null = null;

    try {
      stored = await db
        .query("passwordResetTokens")
        .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
        .unique();
    } catch {
      const all = await db.query("passwordResetTokens").collect();
      stored =
        all.find((t: any) => String(t.tokenHash) === tokenHash) ?? null;
    }

    if (!stored) return { ok: false as const, error: "invalid_token" as const };
    if (stored.usedAt) return { ok: false as const, error: "token_used" as const };
    if (stored.expiresAt <= Date.now()) {
      return { ok: false as const, error: "token_expired" as const, expiresAt: stored.expiresAt };
    }

    const profile = await db.get(stored.profileId);
    if (!profile) return { ok: false as const, error: "user_not_found" as const };

    return {
      ok: true as const,
      email: profile.email,
      name: profile.name,
      expiresAt: stored.expiresAt,
    };
  },
});
