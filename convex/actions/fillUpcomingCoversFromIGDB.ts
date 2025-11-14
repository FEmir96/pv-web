// convex/actions/fillUpcomingCoversFromIGDB.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type UpcomingItem = {
  _id: Id<"upcomingGames">;
  title: string;
  releaseAt: number;
  genre?: string;
  priority?: number;
  cover_url?: string;
  gameId?: Id<"games">;
};

type UpdatedItem = { _id: Id<"upcomingGames">; title: string; cover_url: string };
type SkippedItem = { _id: Id<"upcomingGames">; title: string; reason: string };

async function getIgdbToken(): Promise<{ token: string; clientId: string }> {
  const clientId =
    process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || "";
  const clientSecret =
    process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan IGDB_CLIENT_ID/IGDB_CLIENT_SECRET (o TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET) en las env de Convex."
    );
  }

  const res = await fetch(
    "https://id.twitch.tv/oauth2/token" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      "&grant_type=client_credentials",
    { method: "POST" }
  );
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { access_token: string };
  return { token: data.access_token, clientId };
}

async function igdbSearchCoverUrl(
  token: string,
  clientId: string,
  title: string,
  size: "t_cover_big" | "t_cover_big_2x"
): Promise<string | null> {
  const body = `search "${title.replace(/"/g, '\\"')}"; fields name,cover.image_id; limit 1;`;
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ cover?: { image_id?: string } }>;
  const imageId = arr?.[0]?.cover?.image_id;
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`
    : null;
}

// ---------- resolvers robustos ----------
function resolveQueryRef(): any {
  return (
    (api as any)?.queries?.getUpcomingGames?.getUpcomingGames ??
    (api as any)?.queries?.getUpcomingGames ??
    (api as any)?.getUpcomingGames?.getUpcomingGames ??
    (api as any)?.getUpcomingGames
  );
}
function resolveUpsertRef(): any {
  return (
    (api as any)?.mutations?.upsertUpcoming?.upsertUpcoming ??
    (api as any)?.mutations?.upsertUpcoming ??
    (api as any)?.upsertUpcoming?.upsertUpcoming ??
    (api as any)?.upsertUpcoming
  );
}
// ---------------------------------------

export const fillUpcomingCoversFromIGDB = action({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    // compatibilidad con el JSON que usás en games:
    size2x: v.optional(v.boolean()),
    minScore: v.optional(v.number()), // no se usa en upcoming, pero lo aceptamos para que no rompa
  },
  async handler(ctx, { limit = 25, dryRun = true, size2x = false }) {
    const getUpcomingFn = resolveQueryRef();
    const upsertUpcomingFn = resolveUpsertRef();

    if (!getUpcomingFn)
      throw new Error("No se pudo resolver queries.getUpcomingGames");
    if (!upsertUpcomingFn)
      throw new Error("No se pudo resolver mutations.upsertUpcoming");

    const upcoming = (await ctx.runQuery(getUpcomingFn, {
      limit,
    })) as UpcomingItem[];

    const { token, clientId } = await getIgdbToken();
    const size = size2x ? "t_cover_big_2x" : "t_cover_big";

    const updated: UpdatedItem[] = [];
    const skipped: SkippedItem[] = [];

    for (const u of upcoming) {
      if (u.cover_url) {
        skipped.push({ _id: u._id, title: u.title, reason: "ya_tiene_cover" });
        continue;
      }

      const cover = await igdbSearchCoverUrl(token, clientId, u.title, size);
      if (!cover) {
        skipped.push({
          _id: u._id,
          title: u.title,
          reason: "sin_match_en_igdb",
        });
        continue;
      }

      if (!dryRun) {
        await ctx.runMutation(upsertUpcomingFn, {
          title: u.title,
          releaseAt: u.releaseAt,
          cover_url: cover,
          genre: u.genre,
          priority: u.priority,
          gameId: u.gameId,
        });
      }

      updated.push({ _id: u._id, title: u.title, cover_url: cover });
    }

    return {
      total: upcoming.length,
      updatedCount: updated.length,
      dryRun,
      updated,
      skipped,
    };
  },
});
