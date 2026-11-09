import type { PlanParams } from "./params";

/**
 * Règles déclaratives par année de revenus : cases, taux, source et date de vérification.
 *
 * Les cases changent d'une campagne à l'autre. Une année absente de `RULES` reste affichable,
 * mais elle est marquée « non vérifiée » : on ne réutilise jamais en silence les règles d'une autre année.
 *
 * Source de la table 2025 : Brochure pratique IR 2026 (impots.gouv.fr), chapitres
 * « Revenus des valeurs et capitaux mobiliers » et « Plus-values » ; « Principales nouveautés revenus 2025 »
 * pour les taux (LFSS 2026, art. 12 ; CSS, art. L136-8).
 */

export const TAX_BOX_KEYS = ["dividendes", "interets", "crowdlending", "psDejaPreleves", "acompte", "creditImpot", "plusValue", "moinsValue", "cryptoPlusValue", "cryptoMoinsValue"] as const;
export type TaxBoxKey = (typeof TAX_BOX_KEYS)[number];

export interface TaxBoxRule {
  box: string;
  form: string;
  label: string;
}

export interface FiscalYearRules {
  incomeYear: number;
  /** Année de la déclaration : celle qui suit les revenus. */
  declarationYear: number;
  /** false : aucune table vérifiée pour cette année, les cases sont indicatives. */
  covered: boolean;
  /** Date de vérification AAAA-MM-JJ ; null si l'année n'est pas couverte. */
  verifiedOn: string | null;
  source: string | null;
  boxes: Record<TaxBoxKey, TaxBoxRule>;
  /** Seuil annuel de cessions d'actifs numériques sous lequel la plus-value est exonérée (CGI, art. 150 VH bis). */
  cryptoExemptionThreshold: number;
  /** Nombre d'années suivantes sur lesquelles une moins-value de valeurs mobilières reste imputable. */
  lossCarryYears: number;
}

/** Plus-values et revenus déclarés : revenus du patrimoine. Revenus prélevés à la source : produits de placement. */
export type SocialNature = "patrimoine" | "placement";

const BOXES_2025: Record<TaxBoxKey, TaxBoxRule> = {
  dividendes: { box: "2DC", form: "2042", label: "Revenus des actions et parts (dividendes bruts)" },
  interets: { box: "2TR", form: "2042", label: "Produits de placement à revenu fixe (intérêts bruts)" },
  crowdlending: { box: "2TT", form: "2042", label: "Intérêts des prêts participatifs et des minibons" },
  psDejaPreleves: { box: "2BH", form: "2042", label: "Revenus déjà soumis aux prélèvements sociaux" },
  acompte: { box: "2CK", form: "2042", label: "Prélèvement forfaitaire non libératoire déjà versé" },
  creditImpot: { box: "2AB", form: "2042", label: "Crédits d'impôt sur valeurs étrangères" },
  plusValue: { box: "3VG", form: "2042 C", label: "Plus-value de cession de valeurs mobilières" },
  moinsValue: { box: "3VH", form: "2042 C", label: "Moins-value de cession de valeurs mobilières" },
  cryptoPlusValue: { box: "3AN", form: "2042 C", label: "Plus-value de cession d'actifs numériques (report de la 2086)" },
  cryptoMoinsValue: { box: "3BN", form: "2042 C", label: "Moins-value de cession d'actifs numériques (report de la 2086)" },
};

const RULES: ReadonlyArray<FiscalYearRules> = [
  {
    incomeYear: 2025,
    declarationYear: 2026,
    covered: true,
    verifiedOn: "2026-11-09",
    source: "Brochure pratique IR 2026 (impots.gouv.fr)",
    boxes: BOXES_2025,
    cryptoExemptionThreshold: 305,
    lossCarryYears: 10,
  },
];

/** Dernière année dont les cases ont été vérifiées. */
export const LAST_VERIFIED_INCOME_YEAR = Math.max(...RULES.map((r) => r.incomeYear));

/** Règles d'une année de revenus. Hors table : les cases de la dernière année vérifiée, marquées non couvertes. */
export function fiscalRulesFor(incomeYear: number): FiscalYearRules {
  const exact = RULES.find((r) => r.incomeYear === incomeYear);
  if (exact) return exact;
  const latest = RULES.find((r) => r.incomeYear === LAST_VERIFIED_INCOME_YEAR)!;
  return { ...latest, incomeYear, declarationYear: incomeYear + 1, covered: false, verifiedOn: null, source: null };
}

/**
 * Prélèvements sociaux selon l'année et la nature du revenu.
 * CSG portée de 9,2 % à 10,6 % : à compter des revenus 2025 pour les revenus du patrimoine,
 * à compter du 1.1.2026 pour les produits de placement (LFSS 2026, art. 12).
 * Au-delà des années connues, le taux réglé dans les paramètres s'applique.
 */
export function socialRateFor(incomeYear: number, nature: SocialNature, params: Pick<PlanParams, "tax">): number {
  const firstRaisedYear = nature === "patrimoine" ? 2025 : 2026;
  return incomeYear < firstRaisedYear ? 0.172 : params.tax.socialGeneral;
}
