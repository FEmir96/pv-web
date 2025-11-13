// convex/lib/diffGame.ts
import type { Doc } from "../_generated/dataModel";

export type GameDoc = Doc<"games">;

export type GamePatch = Partial<Pick<
  GameDoc,
  | "title"
  | "description"
  | "cover_url"
  | "trailer_url"
  | "extraTrailerUrl"
  | "extraImages"
  | "genres"
  | "purchasePrice"
  | "weeklyPrice"
  | "embed_url"
  | "embed_allow"
  | "embed_sandbox"
  | "plan"
>>;

function arraysEqual(a?: string[] | null, b?: string[] | null) {
  const A = Array.isArray(a) ? a : [];
  const B = Array.isArray(b) ? b : [];
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

export function diffGame(before: GameDoc, patch: GamePatch) {
  const changed: Record<string, { before: any; after: any }> = {};

  const check = <K extends keyof GameDoc>(k: K, cmp?: (a: any, b: any) => boolean) => {
    if (!(k in patch)) return;
    const after = (patch as any)[k];
    const beforeVal = (before as any)[k];
    const equal = cmp ? cmp(beforeVal, after) : beforeVal === after;
    if (!equal) changed[String(k)] = { before: beforeVal, after };
  };

  check("title");
  check("description");
  check("cover_url");
  check("trailer_url");
  check("extraTrailerUrl");
  check("extraImages", arraysEqual);
  check("genres", arraysEqual);
  check("purchasePrice");
  check("weeklyPrice");
  check("embed_url");
  check("embed_allow");
  check("embed_sandbox");
  check("plan");

  const mediaChanged = ["cover_url", "trailer_url", "extraTrailerUrl", "extraImages"]
    .some((k) => changed[k]);

  const pricingChanged = changed["purchasePrice"] || changed["weeklyPrice"];

  return {
    changed,
    hasChanges: Object.keys(changed).length > 0,
    mediaChanged,
    pricingChanged,
  };
}

export function buildUpdateMessage(title: string, changed: Record<string, { before: any; after: any }>) {
  const parts: string[] = [];
  if (changed["title"]) parts.push("título");
  if (changed["plan"]) parts.push(`plan (${changed["plan"].before} → ${changed["plan"].after})`);
  if (changed["description"]) parts.push("descripción/sinopsis");
  if (changed["genres"]) parts.push("géneros");

  const m: string[] = [];
  if (changed["cover_url"]) m.push("cover");
  if (changed["trailer_url"]) m.push("trailer");
  if (changed["extraTrailerUrl"]) m.push("trailer extra");
  if (changed["extraImages"]) m.push("imágenes");
  if (m.length) parts.push(`contenido multimedia (${m.join(", ")})`);

  const p: string[] = [];
  if (changed["purchasePrice"]) {
    const c = changed["purchasePrice"];
    p.push(`compra ${c.before ?? "—"} → ${c.after ?? "—"}`);
  }
  if (changed["weeklyPrice"]) {
    const r = changed["weeklyPrice"];
    p.push(`alquiler ${r.before ?? "—"} → ${r.after ?? "—"}`);
  }
  if (p.length) parts.push(`precios (${p.join(" | ")})`);

  if (!parts.length) return `Se actualizaron detalles de ${title}.`;
  return `Se actualizaron: ${parts.join(", ")}.`;
}
