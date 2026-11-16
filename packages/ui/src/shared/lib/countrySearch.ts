/** « Côte d'Ivoire » → « cote d'ivoire » : la recherche ignore accents et majuscules. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Pays dont le nom contient la recherche (ou dont le code est la recherche), par ordre alphabétique. */
export function filterCountries(codes: readonly string[], label: (code: string) => string, query: string): string[] {
  const q = fold(query.trim());
  const sorted = [...codes].sort((a, b) => label(a).localeCompare(label(b), "fr"));
  if (!q) return sorted;
  const starts = sorted.filter((c) => fold(label(c)).startsWith(q) || c.toLowerCase() === q);
  return [...starts, ...sorted.filter((c) => !starts.includes(c) && fold(label(c)).includes(q))];
}
