"use node";

/**
 * Genera y cachea el bearer de IGDB (OAuth de Twitch).
 * No usa .get en ningún lado y acepta IGDB_* o TWITCH_*.
 */

type Creds = { clientId: string; clientSecret: string };

function getCreds(): Creds {
  const clientId =
    process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || "";
  const clientSecret =
    process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan IGDB_CLIENT_ID / IGDB_CLIENT_SECRET en las env vars"
    );
  }
  return { clientId, clientSecret };
}

let cache: { token: string; expiresAt: number } | null = null;

export async function getIgdbBearer(): Promise<string> {
  const now = Date.now();
  if (cache && cache.token && cache.expiresAt > now + 30_000) {
    return cache.token;
  }

  const { clientId, clientSecret } = getCreds();

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "client_id=" +
      encodeURIComponent(clientId) +
      "&client_secret=" +
      encodeURIComponent(clientSecret) +
      "&grant_type=client_credentials",
  });

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {}
    throw new Error(`Twitch OAuth fallo ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  const token = String(data.access_token || "");
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;

  cache = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}
