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
  /** Une date de coupon connue, passée ou future : tout le calendrier s'en déduit. Absente : déduit de l'échéance. */
  couponAnchor?: IsoDate | null;
}

interface CouponPeriod {
  prev: IsoDate;
  next: IsoDate;
  /** Durée d'une période complète, en jours ; plus longue que prev → next pour un dernier coupon réduit. */
  days: number;
}

const monthOf = (d: IsoDate) => d.slice(0, 7);

/** Période de coupon qui contient `date` : prev ≤ date < next. */
function periodAround(terms: BondTerms, date: IsoDate): CouponPeriod {
  const step = 12 / Math.max(1, terms.frequency);
  const { couponAnchor: anchor, maturityDate: maturity } = terms;
  if (!anchor || anchor > maturity) {
    // Sans date connue : calendrier déduit de l'échéance, en remontant jusqu'à encadrer la date.
    let next = maturity;
    let prev = addMonths(next, -step);
    let guard = 0;
    while (prev > date && guard++ < 2000) {
      next = prev;
      prev = addMonths(prev, -step);
    }
    return { prev, next, days: daysBetween(prev, next) };
  }
  // Multiples depuis la date connue : pas de dérive d'un 31 qui passerait par un mois de 30 jours.
  const at = (k: number) => addMonths(anchor, k * step);
  let k = 0;
  let guard = 0;
  while (at(k) > date && guard++ < 2000) k--;
  while (at(k + 1) <= date && guard++ < 4000) k++;
  // L'échéance remplace le coupon de son mois : son jour peut n'être qu'une estimation (saisie au mois).
  if (monthOf(at(k)) === monthOf(maturity)) k--;
  const prev = at(k);
  const scheduled = at(k + 1);
  if (monthOf(scheduled) === monthOf(maturity)) return { prev, next: maturity, days: daysBetween(prev, maturity) };
  return { prev, next: scheduled > maturity ? maturity : scheduled, days: daysBetween(prev, scheduled) };
}

/** Coupon d'une période, en fraction du nominal, réduit si le titre est remboursé avant sa fin. */
function couponOf(terms: BondTerms, p: CouponPeriod): number {
  const coupon = terms.couponRate / Math.max(1, terms.frequency);
  return p.days > 0 ? coupon * Math.min(1, daysBetween(p.prev, p.next) / p.days) : coupon;
}

/** Dates de coupon de la période qui contient `date` : [précédent, suivant]. */
export function couponPeriod(terms: BondTerms, date: IsoDate): [IsoDate, IsoDate] {
  const { prev, next } = periodAround(terms, date);
  return [prev, next];
}

/** Prochain coupon strictement après `date`, en fraction du nominal ; null une fois le titre remboursé. */
export function nextCoupon(terms: BondTerms, date: IsoDate): { date: IsoDate; amount: number } | null {
  if (date >= terms.maturityDate) return null;
  const p = periodAround(terms, date);
  return { date: p.next, amount: couponOf(terms, p) };
}

/** Coupon couru (fraction du nominal) à une date, base exact/exact de la période. */
export function accruedFraction(terms: BondTerms, date: IsoDate): number {
  if (date >= terms.maturityDate) return 0;
  const p = periodAround(terms, date);
  if (p.days <= 0) return 0;
  return (terms.couponRate / Math.max(1, terms.frequency)) * (daysBetween(p.prev, date) / p.days);
}

/** Flux restants pour 1 € de nominal après `date` (coupons + remboursement à 100 %). */
export function remainingFlows(terms: BondTerms, date: IsoDate): Array<{ date: IsoDate; amount: number }> {
  const flows: Array<{ date: IsoDate; amount: number }> = [];
  let d = date;
  let guard = 0;
  while (d < terms.maturityDate && guard++ < 2000) {
    const p = periodAround(terms, d);
    flows.push({ date: p.next, amount: couponOf(terms, p) });
    d = p.next;
  }
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
