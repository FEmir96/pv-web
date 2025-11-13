// playverse/convex/actions/pushy.ts
"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

const PUSHY_API = "https://api.pushy.me/push";

type SendResult =
  | { ok: true; sent: number; response: unknown }
  | { ok: true; sent: 0; reason: "no_tokens" };

type PushTokenRow = {
  token: string;
  disabledAt?: number | null;
};

export const sendToProfile = action({
  args: {
    profileId: v.id("profiles"),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { profileId, title, message, data }): Promise<SendResult> => {
    const apiKey = process.env.PUSHY_API_KEY;
    if (!apiKey) {
      throw new Error("Missing PUSHY_API_KEY in Convex env");
    }

    const tokens = (await ctx.runQuery(api.pushTokens.tokensForProfile, {
      profileId,
    })) as unknown as PushTokenRow[];

    const activeTokens = tokens
      .filter((t) => !t.disabledAt)
      .map((t) => t.token);

    if (activeTokens.length === 0) {
      return { ok: true, sent: 0, reason: "no_tokens" };
    }

    const body = {
      to: activeTokens,
      data: {
        title,
        message,
        ...(data && typeof data === "object" ? data : {}),
      },
      notification: {
        title,
        body: message,
        sound: "default",
      },
    };

    const res = await fetch(`${PUSHY_API}?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Pushy send failed [${res.status}]: ${txt}`);
    }

    const json = (await res.json()) as unknown;
    return { ok: true, sent: activeTokens.length, response: json };
  },
});
