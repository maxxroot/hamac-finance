import { addDays, addMonths, roundCents } from "../../base";
import { loanSchedule } from "../../loans";
import { expenseDates } from "../expenses";
import { depositRetained, rentMonths } from "../leases";
import type { RentalData } from "../rental";
import { zeroAmounts, type Amounts } from "./_shared";

export interface RealCashflow {
  /** Premier et dernier mois comptés (AAAA-MM). */
  from: string;
  to: string;
  months: number;
  /** Moyennes par mois, à la part détenue (crédits : part à charge). */
  monthly: Amounts;
}

const monthEnd = (month: string) => addDays(addMonths(`${month}-01`, 1), -1);

/**
 * Cashflow réel : ce qui est vraiment rentré et sorti sur les 12 derniers mois complets, ramené à un mois.
 * Si la location a commencé depuis, on part de son premier mois. Les loyers comptent au mois du loyer (pointés),
 * les dépenses et les échéances à leur date. Les travaux d'amélioration et les remboursements anticipés n'y sont
 * pas : ce sont des choix d'investissement, comptés dans le coût du bien et le bilan.
 */
export function realCashflow(data: RentalData, today: string): RealCashflow | null {
  const { property } = data;
  const leases = data.leases.filter((l) => l.propertyId === property.id);
  const firstLease = leases.reduce<string | null>((first, l) => (first == null || l.startDate < first ? l.startDate : first), null);
  if (firstLease == null) return null;
  const to = addMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const window = addMonths(`${to}-01`, -11).slice(0, 7);
  const from = firstLease.slice(0, 7) > window ? firstLease.slice(0, 7) : window;
  if (from > to) return null;
  const start = `${from}-01`;
  const end = monthEnd(to);
  const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
  const inRange = (date: string) => date >= start && date <= end;

  const t = zeroAmounts();
  for (const m of leases.flatMap((l) => rentMonths(l, data.rents, data.ledger, end))) {
    if (m.month < from || m.month > to) continue;
    t.rents += m.receivedRent;
    t.recovered += m.receivedCharges;
  }
  for (const i of data.incomes) {
    if (i.propertyId !== property.id || !inRange(i.date)) continue;
    if (i.category === "regularisation_recue") t.recovered += i.amount;
    else if (i.category === "regularisation_rendue") t.recovered -= i.amount;
    else t.otherIncome += i.amount;
  }
  for (const l of leases) if (l.depositReturnedOn != null && inRange(l.depositReturnedOn)) t.otherIncome += depositRetained(l);
  for (const e of data.expenses) {
    if (e.propertyId !== property.id || e.improvement) continue;
    t[e.category] -= expenseDates(e, end).filter(inRange).length * e.amount;
  }
  for (const key of Object.keys(t) as Array<keyof Amounts>) t[key] *= property.share;
  for (const loan of data.loans) {
    if (loan.propertyId !== property.id) continue;
    t.loans -= loanSchedule(loan).filter((s) => inRange(s.date)).reduce((sum, s) => sum + s.payment + s.insurance, 0) * loan.share;
  }
  const monthly = zeroAmounts();
  for (const key of Object.keys(t) as Array<keyof Amounts>) monthly[key] = roundCents(t[key] / months) || 0;
  return { from, to, months, monthly };
}
