/**
 * Règles de l'impôt sur les loyers, relues le 13 novembre 2026 sur des sources secondaires concordantes
 * (textes officiels à confirmer : CGI art. 32, 156, 39 C, 50-0 ; BOI-RFPI ; LFSS 2026 art. 12) :
 * - micro-foncier : abattement de 30 % si les loyers bruts du foyer ne dépassent pas 15 000 € (CGI art. 32) ;
 * - réel foncier : déficit imputable sur le revenu global jusqu'à 10 700 € par an hors intérêts d'emprunt, le reste
 *   et la part due aux intérêts reportés sur les revenus fonciers des 10 années suivantes (CGI art. 156, I-3°) ;
 *   frais de gestion forfaitaires de 20 € par local (CGI art. 31) ;
 * - micro-BIC (location meublée) : abattement de 50 % jusqu'à 77 700 € de recettes (revenus 2023 à 2025), puis
 *   83 600 € (revenus 2026 à 2028) (CGI art. 50-0) ;
 * - LMNP au réel : l'amortissement ne peut ni créer ni augmenter un déficit, l'excédent se reporte sans limite
 *   (CGI art. 39 C) ; un déficit s'impute sur les revenus de location meublée des 10 années suivantes (CGI art. 156, I-1° ter) ;
 * - prélèvements sociaux : 17,2 % sur les revenus fonciers, restés hors de la hausse de la CSG ; 18,6 % sur la
 *   location meublée à partir des revenus 2025 (LFSS 2026, art. 12 ; `socialRateFor`).
 */
export const RENTAL_TAX_SOURCES: Array<{ label: string; url: string }> = [
  { label: "Revenus locatifs d'une location vide (service-public.gouv.fr)", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F1991" },
  { label: "Code général des impôts (Légifrance)", url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069577" },
];

export const MICRO_FONCIER = { allowance: 0.3, ceiling: 15_000 };
export const DEFICIT_GLOBAL_CAP = 10_700;
export const DEFICIT_YEARS = 10;
export const MANAGEMENT_FLAT_FEE = 20;
export const FONCIER_SOCIAL_RATE = 0.172;
export const MICRO_BIC_ALLOWANCE = 0.5;

/** Plafond du micro-BIC pour la location meublée de longue durée, selon l'année des recettes. */
export const microBicCeiling = (year: number) => (year >= 2026 ? 83_600 : year >= 2023 ? 77_700 : 72_600);

/**
 * Composants d'un logement meublé au réel : part du bâti (hors terrain) et durée d'amortissement.
 * Usages comptables courants, pas des règles légales : à valider avec votre comptable.
 */
export const AMORTIZATION_COMPONENTS = [
  { key: "structure", label: "Gros œuvre", share: 0.5, years: 50 },
  { key: "toiture", label: "Toiture et façades", share: 0.15, years: 25 },
  { key: "installations", label: "Installations techniques", share: 0.2, years: 20 },
  { key: "agencements", label: "Agencements intérieurs", share: 0.15, years: 12 },
] as const;
/** Travaux d'amélioration d'un meublé : amortis sur 10 ans. */
export const IMPROVEMENT_YEARS = 10;
