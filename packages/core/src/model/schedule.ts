import type { ContributionPlan, ContributionSkip, Transaction } from "./domain";
import { roundCents } from "../base";

/**
 * Calendrier des versements mensuels programmés (onglet « Versements »).
 * Différence voulue avec le sheet : un versement se programme pour un MOIS (AAAA-MM),
 * il n'y a donc plus de déclaration datée du 6 qui ne compte qu'au mois suivant.
 */

export type Month = string; // AAAA-MM

export function monthOf(date: string): Month {
  return date.slice(0, 7);
}

export function addMonth(m: Month, n: number): Month {
  const [y, mm] = m.split("-").map(Number);
  const t = y * 12 + (mm - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetweenInclusive(from: Month, to: Month): Month[] {
  const out: Month[] = [];
  for (let m = from; m <= to; m = addMonth(m, 1)) out.push(m);
  return out;
}

export function firstDay(m: Month): string {
  return `${m}-01`;
}

/** Date du `day` du mois, ramenée au dernier jour pour les mois plus courts (31 → 30 avril, 28/29 février). */
export function dayOfMonth(m: Month, day: number): string {
  const [y, mm] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return `${m}-${String(Math.min(Math.max(1, Math.round(day)), last)).padStart(2, "0")}`;
}

export class Schedule {
  private plansByAccount = new Map<string, ContributionPlan[]>();
  private skips = new Map<string, number>();

  constructor(
    plans: readonly ContributionPlan[],
    skips: readonly ContributionSkip[],
    /** Premier mois du calendrier : rien n'est compté avant. */
    readonly startMonth: Month,
    /** Jour du prélèvement (Paramètres › Plan) : le versement du mois compte à partir de ce jour. */
    readonly day = 1,
  ) {
    for (const p of plans) {
      const list = this.plansByAccount.get(p.accountId) ?? [];
      list.push(p);
      this.plansByAccount.set(p.accountId, list);
    }
    for (const list of this.plansByAccount.values()) list.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
    for (const s of skips) {
      const k = `${s.accountId}|${s.month}`;
      this.skips.set(k, (this.skips.get(k) ?? 0) + s.amount);
    }
  }

  /** Montant prévu pour ce mois (dernier plan démarré à ou avant ce mois), avant mois manqués. */
  planned(accountId: string, month: Month): number {
    if (month < this.startMonth) return 0;
    const list = this.plansByAccount.get(accountId);
    if (!list) return 0;
    let amount = 0;
    for (const p of list) {
      if (p.fromMonth <= month) amount = p.amount;
      else break;
    }
    return amount;
  }

  /** Montant effectivement versé (ou à verser) ce mois : prévu − manqué, jamais négatif. */
  amount(accountId: string, month: Month): number {
    const planned = this.planned(accountId, month);
    if (planned === 0) return 0;
    return roundCents(Math.max(0, planned - (this.skips.get(`${accountId}|${month}`) ?? 0)));
  }

  /** Date du prélèvement d'un mois. */
  dueDate(month: Month): string {
    return dayOfMonth(month, this.day);
  }

  /** Le versement de ce mois a-t-il eu lieu (son jour est passé) ? */
  isPaid(month: Month, today: string): boolean {
    return this.dueDate(month) <= today;
  }

  /** Mois prélevés jusqu'à `today` : le mois en cours compte une fois son jour passé. */
  private paidMonths(today: string): Month[] {
    const current = monthOf(today);
    if (current < this.startMonth) return [];
    const months = monthsBetweenInclusive(this.startMonth, current);
    return this.isPaid(current, today) ? months : months.slice(0, -1);
  }

  /** Cumul des versements déjà prélevés (Livrets!E). */
  paidTotal(accountId: string, today: string): number {
    let total = 0;
    for (const m of this.paidMonths(today)) total += this.amount(accountId, m);
    return roundCents(total);
  }

  /** Versement du mois en cours (ou du premier mois si le calendrier n'a pas commencé). */
  current(accountId: string, today: string): number {
    const m = monthOf(today);
    return this.amount(accountId, m < this.startMonth ? this.startMonth : m);
  }

  /** Total prévu sur une année civile (pour la projection). */
  inYear(accountId: string, year: number): number {
    let total = 0;
    for (let i = 1; i <= 12; i++) total += this.amount(accountId, `${year}-${String(i).padStart(2, "0")}`);
    return roundCents(total);
  }

  /** Flux datés (jour du prélèvement) des versements déjà prélevés, pour le calcul du TRI. */
  paidFlows(accountId: string, today: string): Array<{ date: string; amount: number }> {
    return this.paidMonths(today)
      .map((m) => ({ date: this.dueDate(m), amount: this.amount(accountId, m) }))
      .filter((f) => f.amount > 0);
  }

  /**
   * Versements déjà prélevés sous forme d'opérations du journal (calculées, jamais enregistrées) :
   * un mois déclaré manqué en partie apparaît pour le montant réellement versé, en entier il disparaît.
   */
  paidTransactions(today: string): ScheduledTransaction[] {
    const out: ScheduledTransaction[] = [];
    const months = this.paidMonths(today);
    for (const accountId of this.accountsWithPlans()) {
      for (const m of months) {
        const amount = this.amount(accountId, m);
        if (amount <= 0) continue;
        const missed = roundCents(this.planned(accountId, m) - amount);
        out.push({
          id: `programme:${accountId}:${m}`,
          date: this.dueDate(m),
          type: "versement",
          accountId,
          assetId: null,
          counterAccountId: null,
          amount,
          quantity: null,
          fee: null,
          comment: missed > 0 ? `${missed.toLocaleString("fr-FR")} € manqués ce mois` : "",
          scheduled: true,
          month: m,
        });
      }
    }
    return out;
  }

  accountsWithPlans(): string[] {
    return [...this.plansByAccount.keys()];
  }
}

/** Versement programmé affiché dans le journal : calculé depuis le calendrier, modifiable seulement là. */
export interface ScheduledTransaction extends Transaction {
  scheduled: true;
  month: Month;
}

export function isScheduled(t: Transaction): t is ScheduledTransaction {
  return (t as Partial<ScheduledTransaction>).scheduled === true;
}
