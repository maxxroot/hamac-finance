import { addMonths, roundCents } from "../base";
import { withholdingDispensed } from "../model";
import type { EngineData, PortfolioState } from "../portfolio";
import { accountWithholds } from "./taxReport";

/**
 * Dispense de l'acompte de 12,8 % sur les intérêts (prélèvement forfaitaire non libératoire, CGI art. 125 A) :
 * demande à chaque établissement avant le 30 novembre, pour les intérêts de l'année suivante, si le revenu fiscal
 * de référence de l'avant-dernière année est inférieur au plafond. Source : impots.gouv.fr, « Puis-je bénéficier
 * d'une dispense du prélèvement forfaitaire non libératoire ? », vérifié le 2026-11-13.
 */
export const DISPENSE_CEILING = { single: 25_000, couple: 50_000 } as const;

/** Jour limite de la demande, pour l'année suivante. */
export const DISPENSE_DEADLINE = "11-30";

/** Le rappel est proposé de septembre jusqu'à la date limite. */
export const dispenseReminderSeason = (asOf: string) => asOf.slice(5, 7) >= "09" && asOf.slice(5) <= DISPENSE_DEADLINE;

export interface DispenseInstitution {
  id: string;
  name: string;
  /** Intérêts soumis à l'acompte sur un an chez cet établissement. */
  interest: number;
  /** Acompte qui serait retenu : une avance de trésorerie, pas une économie d'impôt. */
  advance: number;
  /** Déjà coché pour l'année visée dans la page Impôts. */
  dispensed: boolean;
}

export interface DispenseOutlook {
  /** Année visée par la demande : l'année suivante. */
  year: number;
  /** Établissements qui versent des intérêts soumis à l'acompte, du plus gros au plus petit. */
  institutions: DispenseInstitution[];
  /** Totaux des établissements pas encore cochés pour l'année visée. */
  interest: number;
  advance: number;
  ceiling: number;
}

/**
 * Ce que la dispense de l'année suivante éviterait d'avancer, établissement par établissement : coupons annuels
 * des obligations détenues hors assurance-vie et PER, intérêts de crowdlending reçus ces 12 derniers mois.
 * Seuls les établissements qui prélèvent les impôts comptent.
 */
export function dispenseOutlook(data: EngineData, state: PortfolioState): DispenseOutlook {
  const p = data.params;
  const year = +state.asOf.slice(0, 4) + 1;
  const byInstitution = new Map<string, number>();
  const add = (id: string | null, v: number) => id && v > 0 && byInstitution.set(id, (byInstitution.get(id) ?? 0) + v);
  for (const a of state.accounts) {
    if (a.account.kind === "assurance_vie" || a.account.kind === "per" || !accountWithholds(a.account, data)) continue;
    add(a.account.institutionId, a.positions.filter((x) => x.bond && x.bond.terms.maturityDate > state.asOf).reduce((s, x) => s + x.bond!.annualCoupon, 0));
  }
  const since = addMonths(state.asOf, -12);
  const crowd = new Map(data.accounts.filter((a) => a.kind === "crowdlending" && accountWithholds(a, data)).map((a) => [a.id, a]));
  for (const t of data.transactions) {
    const a = crowd.get(t.accountId);
    if (a && t.type === "interets" && t.date > since && t.date <= state.asOf) add(a.institutionId, t.gross ?? t.amount);
  }
  const institutions = [...byInstitution]
    .map(([id, interest]) => ({
      id,
      name: data.institutions?.find((i) => i.id === id)?.name ?? id,
      interest: roundCents(interest),
      advance: roundCents(interest * p.tax.pfuIncomeTax),
      dispensed: withholdingDispensed(p, year, id),
    }))
    .sort((a, b) => b.interest - a.interest);
  const open = institutions.filter((i) => !i.dispensed);
  return {
    year,
    institutions,
    interest: roundCents(open.reduce((s, i) => s + i.interest, 0)),
    advance: roundCents(open.reduce((s, i) => s + i.advance, 0)),
    ceiling: p.profile.couple ? DISPENSE_CEILING.couple : DISPENSE_CEILING.single,
  };
}
