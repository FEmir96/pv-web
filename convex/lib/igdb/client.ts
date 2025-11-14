"use node";

import { getIgdbBearer } from "./token";

type IgdbAgeInline = { rating?: number | null; category?: number | null };

export type GameBasic = {
  id: number;
  name?: string;
  parent_game?: number | null;
  age_ratings?: IgdbAgeInline[] | null;
};

async function igdbFetch<T = any>(path: string, body: string): Promise<T> {
  const bearer = await getIgdbBearer();
  const clientId =
    process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || "";

  const res = await fetch(`https://api.igdb.com/v4/${path}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      "Content-Type": "text/plain",
    },
    body,
  });

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {}
    throw new Error(`IGDB ${path} ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

export async function getGameWithAgesById(igdbId: number): Promise<{
  game?: GameBasic;
  parent?: GameBasic | null;
}> {
  const rows = await igdbFetch<GameBasic[]>(
    "games",
    `
    fields id,name,parent_game,age_ratings.rating,age_ratings.category;
    where id = ${igdbId};
    limit 1;
  `
  );

  const game = rows[0];
  let parent: GameBasic | null = null;

  if (
    game &&
    (!game.age_ratings || game.age_ratings.length === 0) &&
    game.parent_game
  ) {
    const pres = await igdbFetch<GameBasic[]>(
      "games",
      `
      fields id,name,parent_game,age_ratings.rating,age_ratings.category;
      where id = ${game.parent_game};
      limit 1;
    `
    );
    parent = pres[0] || null;
  }

  return { game, parent };
}

export async function findIgdbIdByTitle(title: string): Promise<number | null> {
  const q = title.trim();
  if (!q) return null;

  const rows = await igdbFetch<GameBasic[]>(
    "games",
    `
    search "${q.replace(/["\\]/g, "\\$&")}";
    fields id,name,parent_game,age_ratings.rating,age_ratings.category;
    limit 5;
  `
  );

  return rows && rows.length ? rows[0].id : null;
}
