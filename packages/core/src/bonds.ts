import { addMonths, type IsoDate } from "./dates";
import { daysBetween } from "./xirr";

/**
 * Obligations à taux fixe détenues jusqu'à l'échéance.
 * Le prix est exprimé en fraction du nominal (0.9684 = 96,84 %).
 */
export interface BondTerms {
  couponRate: number;
  maturityDate: IsoDate;
  /** Coupons par an (1 pour les OAT). */
  frequency: number;
}

/** Dates de coupon de la période qui contient `date` : [précédent, suivant]. */
export function couponPeriod(terms: BondTerms, date: IsoDate): [IsoDate, IsoDate] {
  const step = 12 / Math.max(1, terms.frequency);
  let next = terms.maturityDate;
  // On remonte depuis l'échéance jusqu'à encadrer la date.
  let prev = addMonths(next, -step);
  let guard = 0;
  while (prev > date && guard++ < 2000) {
    next = prev;
    prev = addMonths(prev, -step);
  }
  return [prev, next];
}

/** Coupon couru (fraction du nominal) à une date, base exact/exact de la période. */
export function accruedFraction(terms: BondTerms, date: IsoDate): number {
  if (date >= terms.maturityDate) return 0;
  const [prev, next] = couponPeriod(terms, date);
  const period = daysBetween(prev, next);
  if (period <= 0) return 0;
  return (terms.couponRate / terms.frequency) * (daysBetween(prev, date) / period);
}

/** Flux restants pour 1 € de nominal après `date` (coupons + remboursement à 100 %). */
export function remainingFlows(terms: BondTerms, date: IsoDate): Array<{ date: IsoDate; amount: number }> {
  const step = 12 / Math.max(1, terms.frequency);
  const flows: Array<{ date: IsoDate; amount: number }> = [];
  let d = terms.maturityDate;
  let guard = 0;
  while (d > date && guard++ < 2000) {
    flows.push({ date: d, amount: terms.couponRate / terms.frequency });
    d = addMonths(d, -step);
  }
  flows.reverse();
  if (flows.length) flows[flows.length - 1].amount += 1;
  return flows;
}

/**
 * Rendement actuariel à l'échéance pour un prix « pied de coupon + coupon couru » payé à `date`
 * (fraction du nominal, frais compris si on veut le rendement réel de l'investisseur).
 */
export function yieldToMaturity(terms: BondTerms, date: IsoDate, dirtyPrice: number): number | null {
  const flows = remainingFlows(terms, date);
  if (!flows.length || dirtyPrice <= 0) return null;
  const pv = (r: number) => flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, daysBetween(date, f.date) / 365), 0) - dirtyPrice;
  let lo = -0.5;
  let hi = 1;
  if (pv(lo) * pv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = pv(mid);
    if (Math.abs(v) < 1e-10) return mid;
    if (v > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Formule approchée du sheet (OAT!L), gardée pour comparaison. */
export function approxYtm(couponRate: number, pricePct: number, years: number): number {
  return (couponRate * 100 + (100 - pricePct) / Math.max(0.25, years)) / ((100 + pricePct) / 2);
}

/**
 * Valeur « détenue jusqu'à l'échéance » d'un lot, en fraction du nominal :
 * prix pied de coupon amorti linéairement du prix d'achat vers 100 % à l'échéance, plus coupon couru.
 */
export function heldToMaturityValue(terms: BondTerms, buyDate: IsoDate, cleanBuyPrice: number, date: IsoDate): number {
  if (date >= terms.maturityDate) return 1;
  const total = daysBetween(buyDate, terms.maturityDate);
  const elapsed = Math.max(0, daysBetween(buyDate, date));
  const clean = total > 0 ? cleanBuyPrice + (1 - cleanBuyPrice) * Math.min(1, elapsed / total) : 1;
  return clean + accruedFraction(terms, date);
}
