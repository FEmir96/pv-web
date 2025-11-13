"use node";

/**
 * Mapeos y utilidades para ratings de IGDB.
 * Robusto: si aparece un rating/categoría desconocida, igual arma un label genérico.
 */

export type AgeSystem =
  | "ESRB"
  | "PEGI"
  | "USK"
  | "CERO"
  | "ACB"
  | "GRAC"
  | "CLASS_IND"
  | "OFLCNZ";

export type IgdbAge = {
  id?: number | null;
  category: number | null; // categoría IGDB (sistema)
  rating: number | null;   // código IGDB dentro del sistema
};

export type AgeRatingChoice = {
  system: AgeSystem;
  code: string;
  label: string;
};

// ---------- Normalización de título (para búsquedas por nombre)
export function normalizeTitle(s: string): string {
  if (!s) return "";
  // quita tildes, símbolos raros, colapsa espacios
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Categoría IGDB -> Sistema
function categoryToSystem(cat: number | null | undefined): AgeSystem | null {
  switch (cat) {
    case 1: return "ESRB";
    case 2: return "PEGI";
    case 3: return "CERO";
    case 4: return "USK";
    case 5: return "GRAC";
    case 6: return "CLASS_IND";
    case 7: return "ACB";
    // IGDB tiene categorías extra; usamos 8 para NZ como fallback
    case 8: return "OFLCNZ";
    default: return null;
  }
}

// ---------- Tablas (aproximadas) de código IGDB -> código corto humano
// Si un rating no está en estas tablas, se formatea genéricamente como el número.

const ESRB_MAP: Record<number, { code: string; label: string; weight: number }> = {
  // (valores IGDB típicos)
  6: { code: "RP",   label: "ESRB RP",   weight: 0 },
  7: { code: "EC",   label: "ESRB EC",   weight: 3 },
  8: { code: "E",    label: "ESRB E",    weight: 6 },
  9: { code: "E10+", label: "ESRB E10+", weight: 10 },
  10:{ code: "T",    label: "ESRB T",    weight: 13 },
  11:{ code: "M",    label: "ESRB M",    weight: 17 },
  12:{ code: "AO",   label: "ESRB AO",   weight: 18 },
};

const PEGI_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "3",  label: "PEGI 3",  weight: 3 },
  2: { code: "7",  label: "PEGI 7",  weight: 7 },
  3: { code: "12", label: "PEGI 12", weight: 12 },
  4: { code: "16", label: "PEGI 16", weight: 16 },
  5: { code: "18", label: "PEGI 18", weight: 18 },
};

const USK_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "0",  label: "USK 0",  weight: 0 },
  2: { code: "6",  label: "USK 6",  weight: 6 },
  3: { code: "12", label: "USK 12", weight: 12 },
  4: { code: "16", label: "USK 16", weight: 16 },
  5: { code: "18", label: "USK 18", weight: 18 },
};

const CERO_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "A", label: "CERO A", weight: 0 },
  2: { code: "B", label: "CERO B", weight: 12 },
  3: { code: "C", label: "CERO C", weight: 15 },
  4: { code: "D", label: "CERO D", weight: 17 },
  5: { code: "Z", label: "CERO Z", weight: 18 },
};

const ACB_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "G",     label: "ACB G",     weight: 0 },
  2: { code: "PG",    label: "ACB PG",    weight: 8 },
  3: { code: "M",     label: "ACB M",     weight: 15 },
  4: { code: "MA15+", label: "ACB MA15+", weight: 15 },
  5: { code: "R18+",  label: "ACB R18+",  weight: 18 },
  6: { code: "X18+",  label: "ACB X18+",  weight: 18 },
};

const GRAC_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "ALL", label: "GRAC ALL", weight: 0 },
  2: { code: "12",  label: "GRAC 12",  weight: 12 },
  3: { code: "15",  label: "GRAC 15",  weight: 15 },
  4: { code: "18",  label: "GRAC 18",  weight: 18 },
};

const CLASS_IND_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "L",  label: "BR L",   weight: 0 },
  2: { code: "10", label: "BR 10",  weight: 10 },
  3: { code: "12", label: "BR 12",  weight: 12 },
  4: { code: "14", label: "BR 14",  weight: 14 },
  5: { code: "16", label: "BR 16",  weight: 16 },
  6: { code: "18", label: "BR 18",  weight: 18 },
};

const OFLCNZ_MAP: Record<number, { code: string; label: string; weight: number }> = {
  1: { code: "G",   label: "NZ G",   weight: 0 },
  2: { code: "PG",  label: "NZ PG",  weight: 8 },
  3: { code: "M",   label: "NZ M",   weight: 15 },
  4: { code: "R13", label: "NZ R13", weight: 13 },
  5: { code: "R15", label: "NZ R15", weight: 15 },
  6: { code: "R16", label: "NZ R16", weight: 16 },
  7: { code: "R18", label: "NZ R18", weight: 18 },
};

// ---------- Helpers por sistema
function mapWithinSystem(sys: AgeSystem, rating: number): { code: string; label: string; weight: number } {
  const generic = { code: String(rating), label: `${sys} ${rating}`, weight: guessWeight(sys, String(rating)) };
  switch (sys) {
    case "ESRB":     return ESRB_MAP[rating]     || generic;
    case "PEGI":     return PEGI_MAP[rating]     || generic;
    case "USK":      return USK_MAP[rating]      || generic;
    case "CERO":     return CERO_MAP[rating]     || generic;
    case "ACB":      return ACB_MAP[rating]      || generic;
    case "GRAC":     return GRAC_MAP[rating]     || generic;
    case "CLASS_IND":return CLASS_IND_MAP[rating]|| generic;
    case "OFLCNZ":   return OFLCNZ_MAP[rating]   || generic;
    default:         return generic;
  }
}

function guessWeight(sys: AgeSystem, code: string): number {
  // Heurística para ordenar “más restrictivo” si no tenemos tablas exactas.
  // Extrae número si existe, y añade pequeños ajustes por letras típicas.
  const n = parseInt(code.replace(/\D+/g, ""), 10);
  if (!isNaN(n)) return Math.max(0, Math.min(18, n));
  if (sys === "ESRB") {
    if (code === "AO") return 18;
    if (code === "M")  return 17;
    if (code === "T")  return 13;
    if (code.startsWith("E10")) return 10;
    if (code.startsWith("E"))   return 6;
    if (code === "EC") return 3;
  }
  return 0;
}

// ---------- API pública

export function buildLabel(choice: { system: AgeSystem; code: string }): string {
  // Formato corto y claro: "PEGI 18" / "ESRB M" / "USK 12" / etc.
  const sys = choice.system;
  const code = String(choice.code || "").toUpperCase();
  switch (sys) {
    case "ESRB":
      return `ESRB ${code}`;
    case "PEGI":
      return `PEGI ${code}`;
    case "USK":
      return `USK ${code}`;
    case "CERO":
      return `CERO ${code}`;
    case "ACB":
      return `ACB ${code}`;
    case "GRAC":
      return `GRAC ${code}`;
    case "CLASS_IND":
      return `BR ${code}`;
    case "OFLCNZ":
      return `NZ ${code}`;
    default:
      return `${sys} ${code}`;
  }
}

export function systemShort(sys: AgeSystem): string {
  // En tu schema guardás string libre; devolver el mismo identificador es suficiente.
  return sys;
}

/**
 * pickAgeRating:
 * - Transforma todos los objetos IGDB en candidatos válidos.
 * - Filtra los que no traen category/rating.
 * - Ordena por preferencia (si la hay) y por “peso” (más restrictivo).
 * - Devuelve el mejor candidato que encuentre.
 */
export function pickAgeRating(
  ages: IgdbAge[],
  prefer?: AgeSystem[]
): AgeRatingChoice | null {
  if (!Array.isArray(ages) || ages.length === 0) return null;

  const candidates: Array<AgeRatingChoice & { weight: number; prefRank: number }> = [];

  for (let i = 0; i < ages.length; i++) {
    const a = ages[i];
    if (!a || a.category == null || a.rating == null) continue;
    const sys = categoryToSystem(a.category);
    if (!sys) continue;

    const mapped = mapWithinSystem(sys, a.rating);
    const label = mapped.label || buildLabel({ system: sys, code: mapped.code });
    const prefRank =
      prefer && prefer.length ? Math.max(0, prefer.indexOf(sys)) : 999;

    candidates.push({
      system: sys,
      code: mapped.code,
      label,
      weight: mapped.weight,
      prefRank,
    });
  }

  if (candidates.length === 0) return null;

  // Orden: primero por preferencia (si existe), luego por peso (más alto)
  candidates.sort((a, b) => {
    if (a.prefRank !== b.prefRank) return a.prefRank - b.prefRank;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return 0;
  });

  const best = candidates[0];
  return { system: best.system, code: best.code, label: best.label };
}
