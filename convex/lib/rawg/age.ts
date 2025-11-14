// Normaliza el nombre ESRB de RAWG a {system, code, label}
export type AgeOut = { ageRatingSystem: "ESRB"; ageRatingCode: string; ageRatingLabel: string };

export function esrbFromRawgName(name?: string | null): AgeOut | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();

  // RAWG suele devolver: "Everyone", "Everyone 10+", "Teen", "Mature", "Adults Only 18+", "Rating Pending"
  if (n.startsWith("everyone 10")) return { ageRatingSystem: "ESRB", ageRatingCode: "E10+", ageRatingLabel: "Everyone 10+" };
  if (n === "everyone")           return { ageRatingSystem: "ESRB", ageRatingCode: "E",    ageRatingLabel: "Everyone" };
  if (n === "teen")               return { ageRatingSystem: "ESRB", ageRatingCode: "T",    ageRatingLabel: "Teen" };
  if (n === "mature")             return { ageRatingSystem: "ESRB", ageRatingCode: "M",    ageRatingLabel: "Mature 17+" };
  if (n.startsWith("adults only"))return { ageRatingSystem: "ESRB", ageRatingCode: "AO",   ageRatingLabel: "Adults Only 18+" };
  if (n === "rating pending")     return { ageRatingSystem: "ESRB", ageRatingCode: "RP",   ageRatingLabel: "Rating Pending" };

  // fallback: deja el nombre tal cual
  return { ageRatingSystem: "ESRB", ageRatingCode: name, ageRatingLabel: name };
}
