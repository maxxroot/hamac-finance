import { addMonths } from "./dates";
import { ceilingCounters, lifeInsuranceCounters } from "./counters";
import type { EngineData, PortfolioState } from "./engine";
import { roundCents } from "./money";
import { incomeTaxRate } from "./params";
import { securitiesGains } from "./securitiesGains";

/**
 * Liste de fin d'année : les gestes fiscaux qui ne se font que jusqu'au 31 décembre, chiffrés avec les données
 * de Hamac. Estimations à partir des taux de Paramètres › Plan ; rien n'est une recommandation personnalisée.
 */

export const YEAR_END_KEYS = ["moins_values", "assurance_vie", "per", "plafonds", "declaration"] as const;
export type YearEndKey = (typeof YEAR_END_KEYS)[number];

export interface YearEndItem {
  key: YearEndKey;
  title: string;
  /** Impôt économisé (ou évité plus tard) estimé ; null quand il ne se chiffre pas. */
  saving: number | null;
  detail: string;
  /** Lignes concrètes : titres, contrats, plafonds. */
  lines: Array<{ label: string; amount: number | null; hint?: string }>;
  link: string;
}

/** La liste est mise en avant en novembre et en décembre. */
export const yearEndSeason = (asOf: string) => asOf.slice(5, 7) >= "11";

export function yearEndChecklist(data: EngineData, state: PortfolioState): YearEndItem[] {
  const p = data.params;
  const year = +state.asOf.slice(0, 4);
  const items: YearEndItem[] = [];

  // 1. Moins-values latentes du compte-titres, face aux plus-values déjà imposables cette année.
  const gains = securitiesGains(state.disposals, data.accounts, year).find((r) => r.year === year);
  const taxable = gains?.taxableGain ?? 0;
  const losers = state.accounts
    .filter((a) => a.account.kind === "cto" && !a.account.archived)
    .flatMap((a) => a.positions.filter((x) => x.gain < 0).map((x) => ({ label: `${x.asset.name} (${a.account.name})`, loss: -x.gain })));
  if (taxable > 0 && losers.length) {
    const usable = Math.min(taxable, losers.reduce((s, x) => s + x.loss, 0));
    const rate = incomeTaxRate(p) + p.tax.socialGeneral;
    items.push({
      key: "moins_values",
      title: "Réaliser des moins-values sur le compte-titres",
      saving: roundCents(usable * rate),
      detail: `${fmt(taxable)} de plus-values sont imposables cette année. Vendre des titres en perte avant le 31 décembre les compense, jusqu'à ${fmt(usable)}. Racheter aussitôt le même titre pour la seule économie d'impôt peut être contesté (abus de droit) : à réserver à un vrai changement de placement.`,
      lines: losers.sort((a, b) => b.loss - a.loss).map((x) => ({ label: x.label, amount: -roundCents(x.loss), hint: "moins-value latente" })),
      link: "/actions",
    });
  }

  // 2. Abattement annuel de l'assurance-vie après 8 ans.
  const life = lifeInsuranceCounters(data, state);
  if (life && life.allowanceLeft > 0) {
    const eligible = state.accounts
      .filter((a) => a.account.kind === "assurance_vie" && !a.account.archived && a.account.openedOn && addMonths(a.account.openedOn, 96) <= state.asOf && a.value > 0)
      .map((a) => ({ a, share: Math.max(0, 1 - a.netContrib / a.value) }))
      .filter((x) => x.share > 0)
      .sort((x, y) => y.share - x.share);
    if (eligible.length) {
      const rate = Math.min(p.tax.tmi, p.tax.avAfter8);
      items.push({
        key: "assurance_vie",
        title: "Utiliser l'abattement de l'assurance-vie",
        saving: roundCents(life.allowanceLeft * rate),
        detail: `Il reste ${fmt(life.allowanceLeft)} de gains retirables cette année sans impôt sur le revenu. Un retrait partiel fait sortir ces gains, qu'on peut reverser ensuite : ils ne seront plus imposés au revenu plus tard. Les prélèvements sociaux restent dus sur les gains des unités de compte.`,
        lines: eligible.map(({ a, share }) => ({ label: a.account.name, amount: roundCents(Math.min(a.value, life.allowanceLeft / share)), hint: `retrait pour sortir ${fmt(life.allowanceLeft)} de gains (${Math.round(share * 100)} % du contrat est du gain)` })),
        link: "/compteurs",
      });
    }
  }

  // 3. Versements déductibles sur un PER.
  const ceilings = ceilingCounters(data, state);
  const per = ceilings.find((c) => c.key === "per");
  if (per && per.remaining > 0) {
    items.push({
      key: "per",
      title: "Verser sur le PER avant le 31 décembre",
      saving: roundCents(per.remaining * p.tax.tmi),
      detail:
        p.tax.tmi > 0
          ? `Il reste ${fmt(per.remaining)} de plafond de déduction. Chaque euro versé réduit le revenu imposable : environ ${Math.round(p.tax.tmi * 100)} % d'impôt en moins à votre taux marginal. L'argent reste bloqué jusqu'à la retraite, et la sortie sera imposée.`
          : "Avec un taux marginal de 0 %, déduire un versement ne fait rien économiser.",
      lines: [{ label: per.label, amount: per.remaining, hint: "plafond restant" }],
      link: "/compteurs",
    });
  }

  // 4. Plafonds encore disponibles (PEA, livrets réglementés).
  const room = ceilings.filter((c) => c.key !== "per" && c.remaining > 0);
  if (room.length) {
    items.push({
      key: "plafonds",
      title: "Vérifier les plafonds disponibles",
      saving: null,
      detail: "Ces enveloppes sans impôt (ou presque) peuvent encore recevoir des versements.",
      lines: room.map((c) => ({ label: c.label, amount: c.remaining, hint: "encore possible" })),
      link: "/compteurs",
    });
  }

  // 5. La déclaration du printemps.
  items.push({
    key: "declaration",
    title: "Préparer la déclaration du printemps",
    saving: null,
    detail: "Au printemps, choisir entre le prélèvement forfaitaire et le barème (une option pour tous les revenus de l'année), et contrôler chaque document fiscal reçu avec le récapitulatif de Hamac.",
    lines: [],
    link: "/declaration",
  });
  return items;
}

const fmt = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
