/**
 * Recherche d'adresse dans la Base Adresse Nationale, appelée directement depuis le navigateur.
 * Service de l'IGN (Géoplateforme) : autorisé dans la CSP de `index.html` et de `apps/server/src/app.ts`.
 */
const ENDPOINT = "https://data.geopf.fr/geocodage/search/";

export const ADDRESS_MIN_LENGTH = 3;

export interface AddressSuggestion {
  label: string;
  address: string;
  postalCode: string;
  city: string;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Réponse d'un service externe : on ne garde que des textes attendus, le reste est ignoré. */
export function parseAddressResults(raw: unknown): AddressSuggestion[] {
  const features = (raw as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f): AddressSuggestion[] => {
    const p = (f as { properties?: Record<string, unknown> } | null)?.properties;
    if (!p || !text(p.label)) return [];
    // Une commune seule n'a pas d'adresse à inscrire dans le champ Adresse.
    return [{ label: text(p.label), address: p.type === "municipality" ? "" : text(p.name), postalCode: text(p.postcode), city: text(p.city) }];
  });
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < ADDRESS_MIN_LENGTH) return [];
  const params = new URLSearchParams({ q, autocomplete: "1", limit: "5" });
  const response = await fetch(`${ENDPOINT}?${params}`, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("Recherche d'adresse indisponible");
  return parseAddressResults(await response.json());
}
