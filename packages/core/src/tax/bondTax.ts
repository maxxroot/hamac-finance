import { addMonths, roundCents, xirr, type Flow, type IsoDate } from "../base";
import { remainingFlows } from "../investments";
import { incomeTaxRate, type Account, type PlanParams } from "../model";
import type { AccountState, PositionState } from "../portfolio";
import { socialRateFor } from "./fiscalRules";

/**
 * Impôts sur une obligation gardée jusqu'à l'échéance.
 *
 * - Compte-titres (et tout compte hors assurance-vie) : coupons au prélèvement forfaitaire (CGI, art. 200 A),
 *   ou au barème s'il est plus bas (`incomeTaxRate`), plus les prélèvements sociaux des produits de placement ;
 *   gain au remboursement (nominal − coût) imposé comme une plus-value de cession (CGI, art. 150-0 A),
 *   avec les prélèvements sociaux des revenus du patrimoine (CSS, art. L136-6 et L136-8 ; taux par année : `socialRateFor`).
 * - Assurance-vie : coupons et gain imposés au retrait (CGI, art. 125-0 A), au taux de l'âge du contrat
 *   au jour du flux (12,8 % avant 8 ans, 7,5 % après, ou la tranche si plus basse) + prélèvements sociaux.
 *   Simplification : chaque flux est traité comme retiré le jour où il arrive, sans l'abattement annuel.
 *
 * Une perte au remboursement (achat au-dessus du pair) ne réduit aucun impôt ici : elle est imputable sur
 * d'autres plus-values, ce que ce calcul ne voit pas.
 */

interface Rates {
  coupon: (date: IsoDate) => number;
  gain: (date: IsoDate) => number;
}

function ratesFor(account: Account, p: PlanParams): Rates {
  if (account.kind === "assurance_vie") {
    const rate = (date: IsoDate) => {
      const eightYears = account.openedOn ? addMonths(account.openedOn, 96) <= date : false;
      return Math.min(p.tax.tmi, eightYears ? p.tax.avAfter8 : p.tax.avBefore8) + p.tax.socialAv;
    };
    return { coupon: rate, gain: rate };
  }
  const ir = incomeTaxRate(p);
  return {
    coupon: (date) => ir + socialRateFor(+date.slice(0, 4), "placement", p),
    gain: (date) => ir + socialRateFor(+date.slice(0, 4), "patrimoine", p),
  };
}

export interface BondLineTax {
  accountId: string;
  assetId: string;
  /** Rendement à l'échéance après impôts, moyenne des achats pondérée par leur coût. */
  netYtm: number | null;
  /** Impôts encore à payer sur les coupons à venir. */
  couponTax: number;
  couponsAhead: number;
  /** Impôt à payer sur le gain au remboursement. */
  gainTax: number;
  gainAhead: number;
}

export interface BondTaxSummary {
  lines: BondLineTax[];
  /** Moyenne des lignes pondérée par le coût, comme le rendement brut moyen. */
  netYtm: number | null;
  couponTax: number;
  couponsAhead: number;
  gainTax: number;
  gainAhead: number;
  /** Au moins une ligne dans une assurance-vie : impôt au retrait, approché. */
  lifeInsurance: boolean;
}

function lineTax(p: PositionState, rates: Rates, asOf: IsoDate): BondLineTax {
  const { terms, lots, nominal } = p.bond!;
  const split = (f: { date: IsoDate; amount: number }) => (f.date === terms.maturityDate ? f.amount - 1 : f.amount);
  let num = 0;
  let den = 0;
  let gainAhead = 0;
  let gainTax = 0;
  for (const lot of lots) {
    if (lot.qty <= 0 || lot.cost <= 0) continue;
    const gain = Math.max(0, lot.qty - lot.cost);
    const flows: Flow[] = [{ date: lot.date, amount: -lot.cost }];
    for (const f of remainingFlows(terms, lot.date)) {
      const coupon = split(f) * lot.qty;
      let net = coupon * (1 - rates.coupon(f.date));
      if (f.date === terms.maturityDate) net += lot.qty - gain * rates.gain(f.date);
      flows.push({ date: f.date, amount: net });
    }
    const y = xirr(flows);
    if (y != null) {
      num += y * lot.cost;
      den += lot.cost;
    }
    gainAhead += gain;
    gainTax += gain * rates.gain(terms.maturityDate);
  }
  let couponsAhead = 0;
  let couponTax = 0;
  for (const f of remainingFlows(terms, asOf)) {
    const coupon = split(f) * nominal;
    couponsAhead += coupon;
    couponTax += coupon * rates.coupon(f.date);
  }
  return {
    accountId: p.accountId,
    assetId: p.asset.id,
    netYtm: den > 0 ? num / den : null,
    couponTax: roundCents(couponTax),
    couponsAhead: roundCents(couponsAhead),
    gainTax: roundCents(gainTax),
    gainAhead: roundCents(gainAhead),
  };
}

/** Rendement après impôts et impôts à venir des obligations détenues, ligne par ligne et au total. */
export function bondTaxes(accounts: readonly AccountState[], p: PlanParams, asOf: IsoDate): BondTaxSummary {
  const lines: Array<BondLineTax & { cost: number }> = [];
  let lifeInsurance = false;
  for (const a of accounts) {
    const bonds = a.positions.filter((x) => x.bond && x.bond.terms.maturityDate > asOf);
    if (!bonds.length) continue;
    if (a.account.kind === "assurance_vie") lifeInsurance = true;
    const rates = ratesFor(a.account, p);
    for (const x of bonds) lines.push({ ...lineTax(x, rates, asOf), cost: x.cost });
  }
  const weighted = lines.filter((l) => l.netYtm != null);
  const cost = weighted.reduce((s, l) => s + l.cost, 0);
  const sum = (k: "couponTax" | "couponsAhead" | "gainTax" | "gainAhead") => roundCents(lines.reduce((s, l) => s + l[k], 0));
  return {
    lines: lines.map(({ cost: _c, ...l }) => l),
    netYtm: cost > 0 ? weighted.reduce((s, l) => s + l.netYtm! * l.cost, 0) / cost : null,
    couponTax: sum("couponTax"),
    couponsAhead: sum("couponsAhead"),
    gainTax: sum("gainTax"),
    gainAhead: sum("gainAhead"),
    lifeInsurance,
  };
}
