import { z } from "zod";

/**
 * Réglages d'un établissement pour le calcul de sa protection en cas de faillite : pays d'agrément et
 * établissement garant. Les règles de garantie elles-mêmes sont dans protection.ts.
 */

export const PROTECTION_COUNTRIES = ["france", "ue", "hors_ue"] as const;
export type ProtectionCountry = (typeof PROTECTION_COUNTRIES)[number];
export const PROTECTION_COUNTRY_LABELS: Record<ProtectionCountry, string> = {
  france: "France",
  ue: "Autre pays de l'Union européenne",
  hors_ue: "Hors Union européenne",
};

/** Réglages d'un établissement pour le calcul de la protection. */
export const InstitutionProtection = z.object({
  /** Établissement agréé (ou assureur) qui porte la garantie, s'il diffère du nom de l'établissement. */
  guarantor: z.string().trim().max(80).default(""),
  country: z.enum(PROTECTION_COUNTRIES).default("france"),
});
export type InstitutionProtection = z.infer<typeof InstitutionProtection>;
export const NO_PROTECTION: InstitutionProtection = { guarantor: "", country: "france" };
