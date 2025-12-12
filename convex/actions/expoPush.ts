// convex/actions/expoPush.ts
"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

const EXPO_API = "https://api.expo.dev/v2/push/send";

type SendResult =
  | { ok: true; sent: number; response: unknown }
  | { ok: true; sent: 0; reason: "no_tokens" };

type TokenRow = { token: string };

function isExpoToken(token: string) {
  return token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken");
}

export const send = action({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    androidColor: v.optional(v.string()),
  },
  handler: async (ctx, { tokens, title, body, data, androidColor }): Promise<SendResult> => {
    const cleanTokens = tokens
      .map((t) => (t || "").trim())
      .filter((t) => t.length > 0 && isExpoToken(t));

    if (!cleanTokens.length) {
      return { ok: true, sent: 0, reason: "no_tokens" };
    }

    const messages = cleanTokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: null,
      android: androidColor ? { color: androidColor } : undefined,
    }));

    const res = await fetch(EXPO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("expoPush error", res.status, json);
    }

    return { ok: res.ok, sent: cleanTokens.length, response: json };
  },
});

export const sendToProfile = action({
  args: {
    profileId: v.id("profiles"),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    androidColor: v.optional(v.string()),
  },
  handler: async (ctx, { profileId, title, message, data, androidColor }): Promise<SendResult> => {
    const tokens = (await ctx.runQuery(api.pushTokens.tokensForProfile, { profileId })) as TokenRow[];
    const expoTokens = tokens
      .map((t) => t.token)
      .filter((t) => typeof t === "string" && isExpoToken(t));

    if (!expoTokens.length) {
      return { ok: true, sent: 0, reason: "no_tokens" };
    }

    const messages = expoTokens.map((to) => ({
      to,
      title,
      body: message,
      data,
      sound: null,
      android: androidColor ? { color: androidColor } : undefined,
    }));

    const res = await fetch(EXPO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("expoPush sendToProfile error", res.status, json);
    }

    return { ok: res.ok, sent: expoTokens.length, response: json };
  },
});
