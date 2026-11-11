import { roundCents } from "./money";
import { socialRateFor } from "./fiscalRules";
import type { PlanParams } from "./params";
import { daysBetween, xirr, type Flow } from "./xirr";

/**
 * Simulateurs : rendement brut et net d'impôts d'un placement, avant d'investir.
 * Le moteur commun calcule l'impôt sur le revenu et les prélèvements sociaux de chaque flux,
 * puis les rendements annualisés (TRI) avant et après impôts. Chaque placement (simulators.ts)
 * produit ses flux ; les règles et leurs sources sont regroupées ici.
 */

export type SimRegime = "pfu" | "bareme";
export type Tmi = PlanParams["tax"]["tmi"];

export interface SimTax {
  regime: SimRegime;
  /** Taux marginal d'imposition, pour le barème. */
  tmi: Tmi;
  /** Abattement de l'assurance-vie après 8 ans : couple soumis à imposition commune. */
  couple: boolean;
  /** Réglages de l'utilisateur : taux de PFU et de prélèvements sociaux au-delà des années connues. */
  params: Pick<PlanParams, "tax">;
}

/** Nature fiscale d'un revenu : elle décide de l'abattement au barème. */
export type IncomeKind = "interets" | "dividende" | "plusValue";

/**
 * Prélèvements sociaux (LFSS 2026, art. 12) : « placement » pour les revenus prélevés à la source (intérêts,
 * dividendes) et les gains du PEA, à 18,6 % à partir de 2026 ; « patrimoine » pour les plus-values déclarées,
 * à 18,6 % dès les revenus 2025 ; « assuranceVie » pour les produits des contrats, restés à 17,2 % (CSS, art. L136-8, IV).
 */
export type SocialKind = "placement" | "patrimoine" | "assuranceVie" | "pea" | "exonere";

export interface SimSource {
  label: string;
  url: string;
}

/** Règles communes, avec leur source. */
export const SIM_RULES = {
  /** Abattement de 40 % sur les dividendes, au barème seulement (CGI, art. 158, 3, 2°). */
  dividendAllowance: 0.4,
  /** Part de la CSG déductible du revenu imposable au barème (CGI, art. 154 quinquies). */
  csgDeductible: 0.068,
  /** Durée après laquelle un PEA n'est plus soumis à l'impôt sur le revenu (CGI, art. 157, 5° bis). */
  peaYears: 5,
  /** Durée après laquelle un contrat d'assurance-vie ouvre droit à l'abattement et au taux réduit (CGI, art. 125-0 A). */
  avYears: 8,
  /** Les pertes de prêts participatifs s'imputent sur les intérêts de la même année et des 5 suivantes (CGI, art. 125-00 A). */
  crowdLossCarryYears: 5,
  /** … dans la limite de 8 000 € de pertes par an (BOI-RPPM-RCM-20-10-20-30, § 106). */
  crowdLossCap: 8_000,
} as const;

export const SIM_SOURCES = {
  pfu: { label: "impots.gouv.fr, « Les revenus mobiliers » (prélèvement forfaitaire, barème, abattement de 40 %)", url: "https://www.impots.gouv.fr/particulier/les-revenus-mobiliers" },
  prime: { label: "BOFiP, BOI-RPPM-RCM-20-10-20-20, § 200 et 340 à 380 (prime de remboursement)", url: "https://bofip.impots.gouv.fr/bofip/929-PGP.html/identifiant%3DBOI-RPPM-RCM-20-10-20-20-20220630" },
  couru: { label: "BOFiP, BOI-RPPM-PVBMI-20-10-10-10, § 20 (coupon couru compris dans le prix de cession)", url: "https://bofip.impots.gouv.fr/bofip/7088-PGP.html/identifiant=BOI-RPPM-PVBMI-20-10-10-10-20191220" },
  ps: { label: "Loi n° 2025-1403 de financement de la sécurité sociale pour 2026, art. 12 (prélèvements sociaux à 18,6 %)", url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053226384" },
  psExceptions: { label: "CSS, art. L136-8 (taux, et produits restés à 17,2 % : assurance-vie, PEL et CEL anciens)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054336623" },
  pea: { label: "BOFiP, BOI-RPPM-RCM-40-50-40, § 30, 250 et 310 (PEA)", url: "https://bofip.impots.gouv.fr/node/384027" },
  av: { label: "BOFiP, BOI-RPPM-RCM-20-15 (assurance-vie : 7,5 %, 12,8 %, seuil de 150 000 €)", url: "https://bofip.impots.gouv.fr/doctrine/BOI-RPPM-RCM-20-15" },
  avRachat: { label: "BOFiP, BOI-RPPM-RCM-20-10-20-50 (rachats d'assurance-vie, abattement)", url: "https://bofip.impots.gouv.fr/doctrine/BOI-RPPM-RCM-20-10-20-50" },
  crowd: { label: "BOFiP, BOI-RPPM-RCM-20-10-20-30, § 102 à 106 (pertes des prêts participatifs, art. 125-00 A du CGI)", url: "https://bofip.impots.gouv.fr/doctrine/BOI-RPPM-RCM-20-10-20-30" },
  livrets: { label: "service-public.gouv.fr, Livret A (intérêts exonérés d'impôt et de prélèvements sociaux)", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2365" },
  plusValues: { label: "impots.gouv.fr, « Les cessions mobilières » (plus-values, abattement réservé aux titres achetés avant 2018)", url: "https://www.impots.gouv.fr/particulier/les-cessions-mobilieres" },
} satisfies Record<string, SimSource>;

/** Taux des prélèvements sociaux pour un revenu de l'année `year`. */
export function socialRate(kind: SocialKind, year: number, tax: SimTax): number {
  switch (kind) {
    case "exonere":
      return 0;
    case "assuranceVie":
      return tax.params.tax.socialAv;
    case "pea":
    case "placement":
      return socialRateFor(year, "placement", tax.params);
    case "patrimoine":
      return socialRateFor(year, "patrimoine", tax.params);
  }
}

/**
 * Impôt sur le revenu d'un revenu imposable. Au PFU : 12,8 %, sans abattement.
 * Au barème : taux marginal, abattement de 40 % sur les dividendes, et la CSG déductible
 * (6,8 % du revenu) vient en déduction. Elle se déduit l'année suivante ; on la compte la même année.
 */
export function incomeTaxOn(base: number, kind: IncomeKind, tax: SimTax, socialDeductible: boolean): number {
  if (base <= 0) return 0;
  if (tax.regime === "pfu") return base * tax.params.tax.pfuIncomeTax;
  const taxable = base * (kind === "dividende" ? 1 - SIM_RULES.dividendAllowance : 1) - (socialDeductible ? base * SIM_RULES.csgDeductible : 0);
  return Math.max(0, taxable) * tax.tmi;
}

/** Une ligne du détail : un flux, ou un événement fiscal sans mouvement d'argent (intérêts capitalisés). */
export interface SimLine {
  date: string;
  label: string;
  /** Argent reçu (positif) ou versé (négatif), avant impôts ; 0 pour un événement sans mouvement. */
  gross: number;
  /** Base imposable retenue, pour l'affichage. */
  taxable: number;
  incomeTax: number;
  social: number;
  /** Argent reçu ou versé, après impôts. */
  net: number;
  note?: string;
  /** L'argent reste placé (intérêts capitalisés) : ce n'est pas un mouvement, seul l'impôt compte. */
  kept?: boolean;
}

export interface SimResult {
  invested: number;
  lines: SimLine[];
  /** Rendement annualisé avant tout impôt, et après impôt sur le revenu et prélèvements sociaux. */
  grossRate: number | null;
  netRate: number | null;
  grossGain: number;
  netGain: number;
  incomeTax: number;
  social: number;
  endDate: string;
  years: number;
  /** Une partie des revenus peut aller au barème : la comparaison PFU / barème a un sens. */
  baremeEligible: boolean;
  notes: string[];
  sources: SimSource[];
  /** Flux avant impôts et après impôts, pour le rendement annualisé. */
  grossFlows: Flow[];
  netFlows: Flow[];
}

/**
 * Assemble le résultat. `grossFlows` : flux sans aucun impôt (rendement brut) ; `netFlows` : flux réellement
 * encaissés après impôts. Ils diffèrent des lignes quand l'impôt reste dans le contrat (assurance-vie).
 */
export function simResult(input: {
  invested: number;
  lines: SimLine[];
  grossFlows: Flow[];
  netFlows: Flow[];
  baremeEligible: boolean;
  notes?: string[];
  sources: SimSource[];
}): SimResult {
  const sum = (fs: readonly Flow[]) => fs.reduce((t, f) => t + f.amount, 0);
  const start = input.grossFlows.reduce((m, f) => (f.date < m ? f.date : m), input.grossFlows[0]?.date ?? "");
  const endDate = input.grossFlows.reduce((m, f) => (f.date > m ? f.date : m), start);
  const years = (Date.parse(endDate) - Date.parse(start)) / (365.25 * 86_400_000);
  return {
    invested: roundCents(input.invested),
    lines: input.lines.map((l) => ({ ...l, gross: roundCents(l.gross), taxable: roundCents(l.taxable), incomeTax: roundCents(l.incomeTax), social: roundCents(l.social), net: roundCents(l.net) })),
    grossRate: xirr(input.grossFlows),
    netRate: xirr(input.netFlows),
    grossGain: roundCents(sum(input.grossFlows)),
    netGain: roundCents(sum(input.netFlows)),
    incomeTax: roundCents(input.lines.reduce((t, l) => t + l.incomeTax, 0)),
    social: roundCents(input.lines.reduce((t, l) => t + l.social, 0)),
    endDate,
    years,
    baremeEligible: input.baremeEligible,
    notes: input.notes ?? [],
    sources: input.sources,
    grossFlows: input.grossFlows,
    netFlows: input.netFlows,
  };
}

/**
 * Même durée pour toutes les simulations : l'argent reçu avant la fin (coupons, dividendes, remboursement
 * d'une obligation plus courte) est replacé jusqu'à la fin au taux donné, net d'impôt (un Livret A par défaut).
 * Le résultat compare ce que l'on a au même jour.
 */
export function reinvestToHorizon(result: SimResult, horizonDate: string, ratePct: number): SimResult {
  const r = ratePct / 100;
  const start = result.grossFlows[0]!;
  const grow = (f: Flow) => f.amount * Math.pow(1 + r, Math.max(0, daysBetween(f.date, horizonDate)) / 365);
  const terminal = (fs: readonly Flow[]) => fs.slice(1).reduce((t, f) => t + grow(f), 0);
  const early = result.netFlows.slice(1).filter((f) => f.date < horizonDate && Math.abs(f.amount) > 0.005);
  const grossEnd = terminal(result.grossFlows);
  const netEnd = terminal(result.netFlows);
  const reinvested = netEnd - result.netFlows.slice(1).reduce((t, f) => t + f.amount, 0);
  const grossFlows = [start, { date: horizonDate, amount: grossEnd }];
  const netFlows = [result.netFlows[0]!, { date: horizonDate, amount: netEnd }];
  const lines = early.length && Math.abs(reinvested) > 0.005
    ? [...result.lines, { date: horizonDate, label: "Sommes replacées jusqu'à la fin", gross: 0, taxable: 0, incomeTax: 0, social: 0, net: 0, kept: true, note: `${ratePct.toLocaleString("fr-FR")} % net par an : ${reinvested >= 0 ? "+" : ""}${roundCents(reinvested).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` }]
    : result.lines;
  return {
    ...result,
    lines,
    grossRate: xirr(grossFlows),
    netRate: xirr(netFlows),
    grossGain: roundCents(grossEnd + start.amount),
    netGain: roundCents(netEnd + netFlows[0]!.amount),
    endDate: horizonDate,
    years: daysBetween(start.date, horizonDate) / 365.25,
    grossFlows,
    netFlows,
  };
}

/** Ligne d'un revenu imposable reçu en argent : impôt et prélèvements retenus dessus. */
export function incomeLine(date: string, label: string, amount: number, kind: IncomeKind, social: SocialKind, tax: SimTax, note?: string): SimLine {
  const year = +date.slice(0, 4);
  const ps = amount > 0 ? amount * socialRate(social, year, tax) : 0;
  const ir = incomeTaxOn(amount, kind, tax, social !== "exonere");
  return { date, label, gross: amount, taxable: Math.max(0, amount), incomeTax: ir, social: ps, net: amount - ir - ps, note };
}
