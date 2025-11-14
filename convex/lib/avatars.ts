// convex/lib/avatars.ts
const BASE_URL = "https://api.dicebear.com/8.x/bottts-neutral/png";

export function randomAvatarUrl(seedHint?: string | null): string {
  const baseSeed = (seedHint || "playverse").replace(/\s+/g, "-").toLowerCase();
  const rand = Math.floor(Math.random() * 1_000_000_000);
  const seed = `${baseSeed}-${Date.now()}-${rand}`;
  const params = new URLSearchParams({
    seed,
    radius: "50",
    backgroundColor: "0f172a,1d2539",
    backgroundType: "gradientLinear",
    format: "png",
  });
  return `${BASE_URL}?${params.toString()}`;
}
