// convex/lib/igdb/auth.ts

type IgdbAuth = { clientId: string; token: string };

export async function getIgdbAuth(): Promise<IgdbAuth> {
  // Permitimos ambas convenciones:
  const clientId =
    process.env.IGDB_CLIENT_ID ||
    process.env.TWITCH_CLIENT_ID ||
    "";

  // Si ya hay un token directo, lo usamos:
  const directToken = process.env.IGDB_ACCESS_TOKEN || "";

  if (!clientId && !directToken) {
    throw new Error(
      "Faltan credenciales: define TWITCH_CLIENT_ID (o IGDB_CLIENT_ID) y/o IGDB_ACCESS_TOKEN"
    );
  }

  if (directToken && clientId) {
    return { clientId, token: directToken };
  }

  // Si no hay token directo, lo pedimos a Twitch con client_credentials
  const secret = process.env.TWITCH_CLIENT_SECRET || "";
  if (!clientId || !secret) {
    throw new Error(
      "Faltan credenciales: define TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET (o bien IGDB_ACCESS_TOKEN)"
    );
  }

  const url = "https://id.twitch.tv/oauth2/token";
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`No se pudo obtener token de Twitch: ${res.status} ${txt}`);
  }

  const json = (await res.json()) as { access_token?: string };
  const token = json.access_token || "";
  if (!token) {
    throw new Error("Respuesta de Twitch sin access_token");
  }
  return { clientId, token };
}
