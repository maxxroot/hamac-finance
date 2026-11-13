import { addMonths, roundCents, type IsoDate } from "../../base";
import { heldToMaturityValue, remainingFlows } from "../../investments";
import type { PositionState } from "../../portfolio";

/** Un versement attendu d'une ligne détenue : coupon brut et, le jour de l'échéance, remboursement du nominal. */
export interface BondFlow {
  date: IsoDate;
  accountId: string;
  assetId: string;
  coupon: number;
  redemption: number;
}

/** Coupons et remboursements à venir des lignes détenues, strictement après `asOf`, dans l'ordre des dates. */
export function upcomingBondFlows(held: readonly PositionState[], asOf: IsoDate): BondFlow[] {
  const out: BondFlow[] = [];
  for (const p of held) {
    if (!p.bond) continue;
    const { terms, nominal } = p.bond;
    for (const f of remainingFlows(terms, asOf)) {
      // `remainingFlows` ajoute 100 % au dernier flux : on le sépare du coupon.
      const redemption = f.date === terms.maturityDate ? nominal : 0;
      const couponPart = f.date === terms.maturityDate ? f.amount - 1 : f.amount;
      out.push({ date: f.date, accountId: p.accountId, assetId: p.asset.id, coupon: roundCents(couponPart * nominal), redemption });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface FlowTotal {
  coupons: number;
  redemptions: number;
  /** Nombre de versements (un coupon et un remboursement le même jour sur la même ligne comptent pour un). */
  count: number;
}

/** Ce qui arrive dans les `months` mois qui suivent `asOf` (bornes : après `asOf`, jusqu'au même jour inclus). */
export function flowsWithin(flows: readonly BondFlow[], asOf: IsoDate, months: number): FlowTotal {
  const end = addMonths(asOf, months);
  const inside = flows.filter((f) => f.date > asOf && f.date <= end);
  return {
    coupons: roundCents(inside.reduce((s, f) => s + f.coupon, 0)),
    redemptions: roundCents(inside.reduce((s, f) => s + f.redemption, 0)),
    count: inside.length,
  };
}

export interface FlowYear {
  year: number;
  coupons: number;
  redemptions: number;
}

/** Flux à venir par année civile, sans trou entre la première et la dernière année. */
export function flowsByYear(flows: readonly BondFlow[]): FlowYear[] {
  if (!flows.length) return [];
  const first = +flows[0]!.date.slice(0, 4);
  const last = +flows[flows.length - 1]!.date.slice(0, 4);
  const years: FlowYear[] = [];
  for (let y = first; y <= last; y++) years.push({ year: y, coupons: 0, redemptions: 0 });
  for (const f of flows) {
    const row = years[+f.date.slice(0, 4) - first]!;
    row.coupons += f.coupon;
    row.redemptions += f.redemption;
  }
  return years.map((y) => ({ ...y, coupons: roundCents(y.coupons), redemptions: roundCents(y.redemptions) }));
}

export interface TrajectoryPoint {
  date: IsoDate;
  /** Valeur calculée des lignes pas encore remboursées. */
  value: number;
  /** Nominal déjà remboursé depuis `asOf`. */
  redeemed: number;
  /** Coupons bruts versés depuis `asOf`. */
  coupons: number;
}

/**
 * Trajectoire de la valeur jusqu'à la dernière échéance, un point par mois (et le jour de chaque échéance).
 * Valeur « détenue jusqu'à l'échéance » de chaque achat : elle est connue d'avance, il n'y a rien à prévoir.
 */
export function valueTrajectory(held: readonly PositionState[], asOf: IsoDate): TrajectoryPoint[] {
  const bonds = held.filter((p) => p.bond && p.bond.terms.maturityDate > asOf);
  if (!bonds.length) return [];
  const flows = upcomingBondFlows(bonds, asOf);
  const lastMaturity = bonds.map((p) => p.bond!.terms.maturityDate).sort().at(-1)!;
  const dates = new Set<IsoDate>();
  for (let k = 0, d = asOf; d < lastMaturity && k < 1200; d = addMonths(asOf, ++k)) dates.add(d);
  for (const p of bonds) dates.add(p.bond!.terms.maturityDate);
  // Fins d'année : le résumé par année (`trajectoryByYear`) s'y arrête, flux de décembre compris.
  for (let y = +asOf.slice(0, 4); `${y}-12-31` < lastMaturity; y++) if (`${y}-12-31` > asOf) dates.add(`${y}-12-31`);
  return [...dates].sort().map((date) => {
    let value = 0;
    for (const p of bonds) {
      const { terms, lots } = p.bond!;
      if (date >= terms.maturityDate) continue;
      // Ligne à cours saisi : la valeur du jour, puis l'amortissement des achats comme les autres.
      value += date === asOf ? p.value : lots.reduce((s, l) => s + l.qty * heldToMaturityValue(terms, l.date, l.clean, date), 0);
    }
    const past = flows.filter((f) => f.date <= date);
    return {
      date,
      value: roundCents(value),
      redeemed: roundCents(past.reduce((s, f) => s + f.redemption, 0)),
      coupons: roundCents(past.reduce((s, f) => s + f.coupon, 0)),
    };
  });
}

export interface TrajectoryYear extends TrajectoryPoint {
  /** null : aujourd'hui ; sinon la fin de l'année (ou la dernière échéance, la dernière année). */
  year: number | null;
}

/** Trajectoire résumée : aujourd'hui, puis le dernier point de chaque année jusqu'à la dernière échéance. */
export function trajectoryByYear(points: readonly TrajectoryPoint[]): TrajectoryYear[] {
  if (!points.length) return [];
  const last = new Map<number, TrajectoryPoint>();
  for (const p of points.slice(1)) last.set(+p.date.slice(0, 4), p);
  return [{ ...points[0]!, year: null }, ...[...last].map(([year, p]) => ({ ...p, year }))];
}
