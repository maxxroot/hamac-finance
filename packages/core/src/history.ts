import { BUCKETS, type Bucket } from "./domain";
import { computePortfolio, type EngineData } from "./engine";
import { roundCents } from "./money";
import { loanHeldBalanceAt, propertyHeldValueAt } from "./realestate";
import { addMonth, monthOf, type Month } from "./schedule";

/** Montants cumulés d'un compte à une date : la différence entre deux dates donne ceux de la période. */
export interface AccountHistoryDetail {
  interests: number;
  dividends: number;
  /** Tous les frais, y compris ceux compris dans le montant des achats et des ventes. */
  fees: number;
  /** Frais compris dans les achats et les ventes : ils pèsent déjà sur les plus-values. */
  embeddedFees: number;
  /** Impôts débités à part. */
  taxes: number;
  realized: number;
  unrealized: number;
  /** Valeur des titres sans aucun cours connu à cette date, donc comptés à leur prix de revient. */
  unpriced: number;
}

export interface HistoryPoint {
  /** Dernier jour du mois (ou aujourd'hui pour le mois en cours). */
  date: string;
  month: Month;
  value: number;
  netContrib: number;
  gain: number;
  /** Part détenue des biens et part à charge du capital restant dû, à cette date. */
  realEstate: number;
  debts: number;
  /** Patrimoine financier + biens − crédits. */
  netWorth: number;
  buckets: Record<Bucket, number>;
  byAccount: Record<string, number>;
  /** Argent versé net, par compte. */
  contribByAccount: Record<string, number>;
  /** Titres détenus : valeur et prix de revient, par « compte:titre ». */
  byPosition: Record<string, { value: number; cost: number }>;
  detailByAccount: Record<string, AccountHistoryDetail>;
  /** Plus-values réalisées et revenus cumulés, par « compte:titre », titres vendus compris. */
  positionResults: Record<string, { realized: number; income: number }>;
}

export function endOfMonth(m: Month): string {
  const [y, mm] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return `${m}-${String(last).padStart(2, "0")}`;
}

/**
 * Historique mensuel reconstruit à partir du journal et des cours connus à chaque date.
 * Remplace les « photos » mensuelles du sheet : aucune donnée à figer, l'historique se corrige
 * si on corrige une opération passée.
 */
export function buildHistory(data: EngineData, asOf: string): HistoryPoint[] {
  const firstTx = data.transactions.reduce<string | null>((m, t) => (m == null || t.date < m ? t.date : m), null);
  const startCandidates = [data.params.profile.startMonth, firstTx ? monthOf(firstTx) : null].filter(Boolean) as string[];
  if (!startCandidates.length) return [];
  let month = startCandidates.sort((a, b) => a.localeCompare(b))[0];
  const last = monthOf(asOf);
  const points: HistoryPoint[] = [];
  while (month <= last) {
    const date = month === last ? asOf : endOfMonth(month);
    const s = computePortfolio(data, date);
    const realEstate = roundCents((data.properties ?? []).reduce((sum, p) => sum + propertyHeldValueAt(p, data.propertyValues ?? [], date), 0));
    const debts = roundCents((data.loans ?? []).reduce((sum, l) => sum + loanHeldBalanceAt(l, date), 0));
    points.push({
      date,
      month,
      value: s.totals.value,
      netContrib: s.totals.netContrib,
      gain: s.totals.gain,
      realEstate,
      debts,
      netWorth: roundCents(s.netWorth.financial + realEstate - debts),
      buckets: Object.fromEntries(BUCKETS.map((b) => [b, s.buckets[b]])) as Record<Bucket, number>,
      byAccount: Object.fromEntries(s.accounts.map((a) => [a.account.id, a.value])),
      contribByAccount: Object.fromEntries(s.accounts.map((a) => [a.account.id, a.netContrib])),
      byPosition: Object.fromEntries(s.accounts.flatMap((a) => a.positions.map((p) => [`${a.account.id}:${p.asset.id}`, { value: p.value, cost: p.cost }]))),
      detailByAccount: Object.fromEntries(
        s.accounts.map((a) => [
          a.account.id,
          {
            interests: a.interests,
            dividends: a.dividends,
            fees: a.fees,
            embeddedFees: a.positionTotals.reduce((t, p) => t + p.fees, 0),
            taxes: a.taxes,
            realized: a.realizedGain,
            unrealized: a.positions.reduce((t, p) => t + p.gain, 0),
            unpriced: a.positions.reduce((t, p) => t + (p.priceUsed === "cout" ? p.value : 0), 0),
          },
        ]),
      ),
      positionResults: Object.fromEntries(s.accounts.flatMap((a) => a.positionTotals.map((p) => [`${a.account.id}:${p.assetId}`, { realized: p.realized, income: p.income }]))),
    });
    month = addMonth(month, 1);
  }
  return points;
}
