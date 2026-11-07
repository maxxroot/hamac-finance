import type { ContributionPlan, ContributionSkip, Transaction } from "./domain";
import { roundCents } from "./money";
import { Schedule, monthsBetweenInclusive } from "./schedule";

/** Taux d'un compte à partir d'une date (historique des taux d'un livret). */
export interface AccountRate {
  id: string;
  accountId: string;
  fromDate: string;
  rate: number;
  comment: string;
}

/** Taux en vigueur à une date : dernier taux dont la date de début est ≤ date. */
export function rateAt(rates: readonly AccountRate[], accountId: string, date: string): AccountRate | null {
  let found: AccountRate | null = null;
  for (const r of rates) {
    if (r.accountId !== accountId || r.fromDate > date) continue;
    if (!found || r.fromDate > found.fromDate) found = r;
  }
  return found;
}

/** Quinzaine absolue (24 par an) : du 1er au 15, puis du 16 à la fin du mois. */
function quinzaine(date: string): number {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7) - 1;
  const d = +date.slice(8, 10);
  return y * 24 + m * 2 + (d >= 16 ? 1 : 0);
}

function quinzaineStart(q: number): string {
  const y = Math.floor(q / 24);
  const r = q % 24;
  return `${y}-${String(Math.floor(r / 2) + 1).padStart(2, "0")}-${r % 2 ? "16" : "01"}`;
}

export interface LivretInterest {
  year: number;
  /** Intérêts de toute l'année, avec les versements programmés à venir. */
  estimated: number;
  /** Intérêts acquis jusqu'à la quinzaine en cours (incluse). */
  earnedToDate: number;
  /** Taux moyen pondéré de l'année. */
  averageRate: number;
}

/**
 * Intérêts d'un livret réglementé pour une année, règle des quinzaines :
 * un dépôt rapporte à partir de la quinzaine qui suit, un retrait cesse de rapporter
 * dès le début de la quinzaine où il a lieu. Intérêts = Σ solde × taux / 24.
 * Les intérêts crédités au 31/12 rapportent à partir du 1er janvier suivant.
 */
export function livretInterest(
  accountId: string,
  year: number,
  data: { transactions: readonly Transaction[]; plans: readonly ContributionPlan[]; skips: readonly ContributionSkip[]; startMonth: string; contributionDay?: number },
  rates: readonly AccountRate[],
  fallbackRate: number | null,
  today: string,
): LivretInterest {
  // Mouvements signés, chacun avec la quinzaine à partir de laquelle il compte.
  const moves: Array<{ q: number; amount: number }> = [];
  for (const t of data.transactions) {
    const inbound = t.accountId === accountId;
    const outboundTo = t.counterAccountId === accountId;
    if (!inbound && !outboundTo) continue;
    let signed = 0;
    if (outboundTo && t.type === "transfert") signed = t.amount;
    else if (inbound) {
      if (["apport_initial", "versement", "interets", "dividende", "vente"].includes(t.type)) signed = t.amount;
      else if (t.type === "correction") signed = t.amount;
      else signed = -t.amount; // retrait, transfert sortant, frais, achat
    }
    if (!signed) continue;
    moves.push({ q: signed > 0 ? quinzaine(t.date) + 1 : quinzaine(t.date), amount: signed });
  }
  // Versements programmés (au jour du prélèvement), y compris ceux à venir dans l'année : quinzaine suivante.
  const schedule = new Schedule(data.plans, data.skips, data.startMonth, data.contributionDay ?? 1);
  for (const m of monthsBetweenInclusive(data.startMonth < `${year - 60}-01` ? `${year - 60}-01` : data.startMonth, `${year}-12`)) {
    const amount = schedule.amount(accountId, m);
    if (amount) moves.push({ q: quinzaine(schedule.dueDate(m)) + 1, amount });
  }
  moves.sort((a, b) => a.q - b.q);

  const first = year * 24;
  const current = quinzaine(today);
  let balance = moves.filter((x) => x.q < first).reduce((s, x) => s + x.amount, 0);
  const inYear = moves.filter((x) => x.q >= first);
  let estimated = 0;
  let earned = 0;
  let rateSum = 0;
  let i = 0;
  for (let q = first; q < first + 24; q++) {
    while (i < inYear.length && inYear[i].q <= q) balance += inYear[i++].amount;
    const rate = rateAt(rates, accountId, quinzaineStart(q))?.rate ?? fallbackRate ?? 0;
    const interest = (Math.max(0, balance) * rate) / 24;
    rateSum += rate;
    estimated += interest;
    if (q <= current) earned += interest;
  }
  return { year, estimated: roundCents(estimated), earnedToDate: roundCents(earned), averageRate: rateSum / 24 };
}
