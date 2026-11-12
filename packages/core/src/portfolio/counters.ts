import { addDays, addMonths, monthsBetween, roundCents } from "../base";
import { LIVRET_LEGAL_CEILINGS, type Account } from "../model";
import { computePortfolio, type EngineData, type PortfolioState } from "./engine";

/**
 * Compteurs d'ancienneté et plafonds : ce qui avance avec le temps et ce qui limite les versements.
 *
 * Règles vérifiées le 11 novembre 2026 :
 * - PEA : 150 000 € de versements ; PEA et PEA-PME ensemble : 225 000 € (CMF, art. L221-30 et L221-32-1) ;
 *   fiscalité allégée après 5 ans ; assurance-vie : après 8 ans (CGI, art. 125-0 A) ;
 * - abattement annuel sur les gains retirés d'une assurance-vie de plus de 8 ans : 4 600 €, 9 200 € pour un couple ;
 * - donations : abattement par donateur et par bénéficiaire selon le lien de parenté, renouvelé tous les 15 ans
 *   (CGI, art. 779, 784, 790 B à 790 F) ; don familial de sommes d'argent : 31 865 € de plus, donateur de moins
 *   de 80 ans, bénéficiaire majeur (CGI, art. 790 G) ; présents d'usage non comptés (service-public.gouv.fr, F14203).
 */

export const COUNTERS_VERIFIED_ON = "2026-11-11";
export const PEA_CEILING = 150_000;
export const PEA_TOTAL_CEILING = 225_000;
export const FAMILY_CASH_GIFT = 31_865;
export const GIFT_RENEWAL_YEARS = 15;

export const COUNTER_SOURCES: Array<{ label: string; url: string }> = [
  { label: "Droits de donation : abattements et don familial (service-public.gouv.fr)", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F14203" },
  { label: "PEA et PEA-PME : plafonds (AMF)", url: "https://www.amf-france.org/sites/institutionnel/files/pdf/59240/fr/PEA__tout_savoir_sur_le_plan_d%27epargne_en_actions.pdf" },
];

// ——— Ancienneté ———

export interface SeniorityCounter {
  account: Account;
  years: 5 | 8;
  /** Date anniversaire ; null si la date d'ouverture manque. */
  date: string | null;
  reached: boolean;
  monthsLeft: number | null;
}

export function seniorityCounters(state: PortfolioState): SeniorityCounter[] {
  return state.accounts
    .filter((a) => !a.account.archived && (a.account.kind === "pea" || a.account.kind === "pea_pme" || a.account.kind === "assurance_vie"))
    .map((a) => {
      const years = a.account.kind === "assurance_vie" ? 8 : 5;
      const date = a.account.openedOn ? addMonths(a.account.openedOn, years * 12) : null;
      const reached = date != null && date <= state.asOf;
      return { account: a.account, years, date, reached, monthsLeft: date == null || reached ? null : monthsBetween(state.asOf, date) };
    });
}

// ——— Plafonds de versement ———

/** Versements bruts d'un compte jusqu'à une date : versé net, plus ce qui en est ressorti (retraits, transferts sortants). */
export function grossContributions(data: Pick<EngineData, "transactions">, state: PortfolioState, accountId: string): number {
  const netContrib = state.accountById.get(accountId)?.netContrib ?? 0;
  const out = data.transactions.filter((t) => t.accountId === accountId && t.date <= state.asOf && (t.type === "retrait" || t.type === "transfert")).reduce((s, t) => s + t.amount, 0);
  return roundCents(netContrib + out);
}

export interface CeilingCounter {
  key: string;
  label: string;
  /** Ce qui compte pour le plafond (versements, ou solde pour un livret). */
  used: number;
  ceiling: number;
  remaining: number;
  note: string;
}

export function ceilingCounters(data: EngineData, state: PortfolioState): CeilingCounter[] {
  const out: CeilingCounter[] = [];
  const active = state.accounts.filter((a) => !a.account.archived);
  const counter = (key: string, label: string, used: number, ceiling: number, note: string) => out.push({ key, label, used: roundCents(used), ceiling, remaining: roundCents(Math.max(0, ceiling - used)), note });
  const pea = active.filter((a) => a.account.kind === "pea").reduce((s, a) => s + grossContributions(data, state, a.account.id), 0);
  const peaPme = active.filter((a) => a.account.kind === "pea_pme").reduce((s, a) => s + grossContributions(data, state, a.account.id), 0);
  if (active.some((a) => a.account.kind === "pea")) counter("pea", "Versements sur le PEA", pea, PEA_CEILING, "Les plus-values et dividendes ne comptent pas : la valeur peut dépasser le plafond.");
  if (active.some((a) => a.account.kind === "pea_pme")) counter("pea_pme", "Versements PEA + PEA-PME", pea + peaPme, PEA_TOTAL_CEILING, "Plafond commun aux deux plans.");
  for (const a of active.filter((x) => x.account.kind === "livret" && x.account.livretType && x.account.livretType !== "AUTRE")) {
    const ceiling = a.account.depositCeiling ?? LIVRET_LEGAL_CEILINGS[a.account.livretType!];
    if (ceiling != null) counter(`livret-${a.account.id}`, a.account.name, a.value, ceiling, "Solde comparé au plafond de dépôt : les intérêts peuvent le dépasser.");
  }
  const perCeiling = data.params.tax.perDeductionCeiling;
  const pers = active.filter((a) => a.account.kind === "per");
  if (pers.length && perCeiling > 0) {
    const year = state.asOf.slice(0, 4);
    const startState = computePortfolio(data, `${Number(year) - 1}-12-31`);
    const thisYear = pers.reduce((s, a) => s + grossContributions(data, state, a.account.id) - grossContributions(data, startState, a.account.id), 0);
    counter("per", `Versements sur le PER en ${year}`, thisYear, perCeiling, "Plafond de déduction indiqué sur l'avis d'impôt.");
  }
  return out;
}

// ——— Assurance-vie : abattement annuel et versements avant 70 ans ———

export interface LifeInsuranceCounters {
  allowance: number;
  /** Gains retirés cette année sur des contrats de plus de 8 ans. */
  gainsWithdrawn: number;
  allowanceLeft: number;
  /** Versements bruts avant et après 70 ans (selon l'année de naissance). */
  before70: number;
  after70: number;
  seventyOn: string;
}

export function lifeInsuranceCounters(data: EngineData, state: PortfolioState): LifeInsuranceCounters | null {
  const avs = state.accounts.filter((a) => a.account.kind === "assurance_vie" && (!a.account.archived || a.value !== 0));
  if (!avs.length) return null;
  const p = data.params;
  const allowance = p.profile.couple ? p.tax.avAllowanceCouple : p.tax.avAllowanceSingle;
  const year = state.asOf.slice(0, 4);
  // Part de gain d'un retrait : retrait × (1 − versé net / valeur), juste avant le retrait.
  let gains = 0;
  for (const t of data.transactions.filter((x) => x.type === "retrait" && x.date.startsWith(year) && x.date <= state.asOf && avs.some((a) => a.account.id === x.accountId))) {
    const account = avs.find((a) => a.account.id === t.accountId)!.account;
    if (!account.openedOn || addMonths(account.openedOn, 96) > t.date) continue;
    const before = computePortfolio(data, addDays(t.date, -1)).accountById.get(t.accountId);
    if (!before || before.value <= 0) continue;
    gains += t.amount * Math.max(0, 1 - before.netContrib / before.value);
  }
  const seventyOn = `${p.profile.birthYear + 70}-01-01`;
  const total = avs.reduce((s, a) => s + grossContributions(data, state, a.account.id), 0);
  const atSeventy = seventyOn <= state.asOf ? computePortfolio(data, addDays(seventyOn, -1)) : state;
  const before70 = avs.reduce((s, a) => s + grossContributions(data, atSeventy, a.account.id), 0);
  return {
    allowance,
    gainsWithdrawn: roundCents(gains),
    allowanceLeft: roundCents(Math.max(0, allowance - gains)),
    before70: roundCents(before70),
    after70: roundCents(Math.max(0, total - before70)),
    seventyOn,
  };
}

// ——— Donations ———

export const GIFT_DIRECTIONS = ["faite", "recue"] as const;
export type GiftDirection = (typeof GIFT_DIRECTIONS)[number];
export const GIFT_DIRECTION_LABELS: Record<GiftDirection, string> = { faite: "Faite", recue: "Reçue" };

export const GIFT_KINDS = ["donation", "don_argent", "present_usage"] as const;
export type GiftKind = (typeof GIFT_KINDS)[number];
export const GIFT_KIND_LABELS: Record<GiftKind, string> = {
  donation: "Donation",
  don_argent: "Don familial de sommes d'argent",
  present_usage: "Présent d'usage (non compté)",
};

/** Lien du bénéficiaire avec le donateur. */
export const GIFT_RELATIONS = ["enfant", "petit_enfant", "arriere_petit_enfant", "conjoint", "ascendant", "frere_soeur", "neveu_niece", "autre"] as const;
export type GiftRelation = (typeof GIFT_RELATIONS)[number];
export const GIFT_RELATION_LABELS: Record<GiftRelation, string> = {
  enfant: "Enfant",
  petit_enfant: "Petit-enfant",
  arriere_petit_enfant: "Arrière-petit-enfant",
  conjoint: "Époux ou partenaire de Pacs",
  ascendant: "Parent ou grand-parent",
  frere_soeur: "Frère ou sœur",
  neveu_niece: "Neveu ou nièce",
  autre: "Autre (sans abattement)",
};
/** Abattement par donateur et par bénéficiaire, tous les 15 ans. */
export const GIFT_ALLOWANCES: Record<GiftRelation, number> = {
  enfant: 100_000,
  petit_enfant: 31_865,
  arriere_petit_enfant: 5_310,
  conjoint: 80_724,
  ascendant: 100_000,
  frere_soeur: 15_932,
  neveu_niece: 7_967,
  autre: 0,
};
/** Bénéficiaires possibles du don familial de sommes d'argent (neveu ou nièce : si le donateur n'a pas de descendant). */
const FAMILY_GIFT_RELATIONS: ReadonlySet<GiftRelation> = new Set(["enfant", "petit_enfant", "arriere_petit_enfant", "neveu_niece"]);

export interface Gift {
  id: string;
  date: string;
  direction: GiftDirection;
  kind: GiftKind;
  /** L'autre personne : le bénéficiaire d'une donation faite, le donateur d'une donation reçue. */
  person: string;
  relation: GiftRelation;
  amount: number;
  comment: string;
}

export interface GiftCounter {
  direction: GiftDirection;
  person: string;
  relation: GiftRelation;
  /** Abattement de parenté : utilisé dans les 15 dernières années, et restant. */
  allowance: number;
  used: number;
  remaining: number;
  /** Don familial de sommes d'argent : utilisé et restant ; null si le lien ne le permet pas. */
  cashGiftUsed: number | null;
  cashGiftRemaining: number | null;
  /** Montant au-delà des abattements : soumis aux droits de donation. */
  taxable: number;
  /** Date où la plus ancienne donation encore comptée sortira du rappel fiscal. */
  renewsOn: string | null;
}

const personKey = (g: Pick<Gift, "direction" | "person" | "relation">) => `${g.direction}|${g.person.trim().toLocaleLowerCase("fr-FR")}|${g.relation}`;

/** Abattements consommés par personne, sur les donations des 15 dernières années. */
export function giftCounters(gifts: readonly Gift[], asOf: string): GiftCounter[] {
  const since = addMonths(asOf, -GIFT_RENEWAL_YEARS * 12);
  const groups = new Map<string, Gift[]>();
  for (const g of [...gifts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (g.kind === "present_usage" || g.date > asOf || g.date <= since) continue;
    groups.set(personKey(g), [...(groups.get(personKey(g)) ?? []), g]);
  }
  return [...groups.values()].map((list) => {
    const { direction, person, relation } = list[0];
    const allowance = GIFT_ALLOWANCES[relation];
    const family = FAMILY_GIFT_RELATIONS.has(relation);
    let cash = 0;
    let main = 0;
    for (const g of list) {
      // Le don familial s'impute d'abord sur son exonération propre, le reste sur l'abattement de parenté.
      const viaCash = g.kind === "don_argent" && family ? Math.min(g.amount, FAMILY_CASH_GIFT - cash) : 0;
      cash += viaCash;
      main += g.amount - viaCash;
    }
    return {
      direction,
      person,
      relation,
      allowance,
      used: roundCents(Math.min(main, allowance)),
      remaining: roundCents(Math.max(0, allowance - main)),
      cashGiftUsed: family ? roundCents(cash) : null,
      cashGiftRemaining: family ? roundCents(FAMILY_CASH_GIFT - cash) : null,
      taxable: roundCents(Math.max(0, main - allowance)),
      renewsOn: addMonths(list[0].date, GIFT_RENEWAL_YEARS * 12),
    };
  });
}
