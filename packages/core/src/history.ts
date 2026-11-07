import { BUCKETS, type Bucket } from "./domain";
import { computePortfolio, type EngineData } from "./engine";
import { addMonth, monthOf, type Month } from "./schedule";

export interface HistoryPoint {
  /** Dernier jour du mois (ou aujourd'hui pour le mois en cours). */
  date: string;
  month: Month;
  value: number;
  netContrib: number;
  gain: number;
  buckets: Record<Bucket, number>;
  byAccount: Record<string, number>;
}

function endOfMonth(m: Month): string {
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
  let month = startCandidates.sort()[0];
  const last = monthOf(asOf);
  const points: HistoryPoint[] = [];
  while (month <= last) {
    const date = month === last ? asOf : endOfMonth(month);
    const s = computePortfolio(data, date);
    points.push({
      date,
      month,
      value: s.totals.value,
      netContrib: s.totals.netContrib,
      gain: s.totals.gain,
      buckets: Object.fromEntries(BUCKETS.map((b) => [b, s.buckets[b]])) as Record<Bucket, number>,
      byAccount: Object.fromEntries(s.accounts.map((a) => [a.account.id, a.value])),
    });
    month = addMonth(month, 1);
  }
  return points;
}
