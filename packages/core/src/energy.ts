import { addMonths } from "./dates";

/**
 * Diagnostic de performance énergétique.
 * Validité : 10 ans, sauf anciens DPE (décret n° 2020-1610 du 17 décembre 2020, art. D.134-4-2 du CCH).
 * Interdiction de louer : calendrier repris de service-public.gouv.fr (A17975), ecologie.gouv.fr et anil.org, consultés le 09/11/2026.
 */

export const ENERGY_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type EnergyLetter = (typeof ENERGY_LETTERS)[number];

/** Dernier jour de validité d'un DPE réalisé à cette date. */
export function dpeExpiry(dpeDate: string): string {
  const tenYears = addMonths(dpeDate, 120);
  if (dpeDate < "2018-01-01") return tenYears < "2022-12-31" ? tenYears : "2022-12-31";
  if (dpeDate < "2021-07-01") return "2024-12-31";
  return tenYears;
}

/** Logement classé F ou G : pas de hausse de loyer à la révision, au renouvellement ou à la relocation (service-public.gouv.fr, anil.org). */
export const dpeFreezesRent = (letter: EnergyLetter | null) => letter === "F" || letter === "G";

const RENTAL_BAN: Partial<Record<EnergyLetter, string>> = { G: "2025-01-01", F: "2028-01-01", E: "2034-01-01" };
const RENTAL_BAN_OVERSEAS: Partial<Record<EnergyLetter, string>> = { G: "2028-01-01", F: "2031-01-01" };
const OVERSEAS_POSTAL_PREFIXES = ["971", "972", "973", "974", "976"];

/** Date à partir de laquelle un logement de cette note ne peut plus être loué ; null s'il n'est pas concerné. Sans code postal : calendrier de métropole. */
export function dpeRentalBan(letter: EnergyLetter, postalCode: string): string | null {
  const overseas = OVERSEAS_POSTAL_PREFIXES.some((p) => postalCode.startsWith(p));
  return (overseas ? RENTAL_BAN_OVERSEAS : RENTAL_BAN)[letter] ?? null;
}
