import { roundCents } from "../../base";
import type { PlanParams } from "../../model";
import { propertyYears, type PropertyYear, type RentalData } from "../../realestate";
import { socialRateFor } from "../fiscalRules";
import { yearAmortization } from "./_amortization";
import { foncierYear, lmnpYear, type Carry, type GroupYear, type TaxRow } from "./_foyer";
import { rentalTaxKind, type RentalRegime, type RentalTaxKind } from "./_kind";
import { FONCIER_SOCIAL_RATE, MANAGEMENT_FLAT_FEE } from "./_rules";

/**
 * Impôt sur les loyers du foyer, année par année : location vide (micro-foncier ou réel) et location meublée
 * (micro-BIC ou réel), chacune avec un régime pour tout le foyer. L'impôt de chaque groupe est réparti entre ses
 * biens au prorata de leur résultat. Estimation à la tranche marginale d'imposition des réglages.
 */

export { RENTAL_TAX_SOURCES, AMORTIZATION_COMPONENTS, MICRO_FONCIER, DEFICIT_GLOBAL_CAP, microBicCeiling } from "./_rules";
export { RENTAL_REGIME_LABELS, RENTAL_TAX_KIND_LABELS, rentalTaxKind, type RentalRegime, type RentalTaxKind } from "./_kind";
export { yearAmortization } from "./_amortization";
export type { TaxRow } from "./_foyer";

export interface RentalTaxYear extends Omit<GroupYear, "byProperty"> {
  year: number;
  kind: RentalTaxKind;
  /** Impôt sur le revenu et prélèvements sociaux ; négatif quand un déficit fait baisser l'impôt. */
  total: number;
  /** Déficits et amortissements encore reportables après l'année. */
  carriedDeficit: number;
  carriedAmortization: number;
}

export interface PropertyTaxYear {
  year: number;
  kind: RentalTaxKind;
  regime: RentalRegime;
  partial: boolean;
  receipts: number;
  /** Charges déductibles au réel (abattement au micro), amortissement de l'année. */
  deductible: number;
  amortization: number;
  /** Part du bien dans l'impôt du groupe. */
  tax: number;
}

export interface RentalTaxes {
  years: RentalTaxYear[];
  properties: Map<string, PropertyTaxYear[]>;
}

type Regimes = Record<RentalTaxKind, RentalRegime>;

export function rentalTaxes(all: readonly RentalData[], params: PlanParams, today: string, override: Partial<Regimes> = {}): RentalTaxes {
  const regimes: Regimes = { foncier: override.foncier ?? params.rental.unfurnishedRegime, lmnp: override.lmnp ?? params.rental.furnishedRegime };
  const tmi = params.tax.tmi;
  const items = all.map((data) => ({ data, kind: rentalTaxKind(data.property, data.leases), years: propertyYears(data, today) }));
  const allYears = [...new Set(items.flatMap((i) => i.years.filter((y) => y.rents + y.charges > 0).map((y) => y.year)))].sort((a, b) => a - b);
  const foncierCarry: Carry = [];
  const lmnpState = { carry: [] as Carry, amortization: 0 };
  const years: RentalTaxYear[] = [];
  const properties = new Map<string, PropertyTaxYear[]>();

  for (const year of allYears) {
    for (const kind of ["foncier", "lmnp"] as const) {
      const members = items.flatMap((i) => {
        const y = i.kind === kind ? i.years.find((x) => x.year === year && x.rents + x.charges > 0) : undefined;
        return y ? [{ ...i, y }] : [];
      });
      if (members.length === 0) continue;
      const lmnpReceipts = (y: PropertyYear) => y.rents + y.charges + y.otherIncome;
      const totalReceipts = members.reduce((s, m) => s + lmnpReceipts(m.y), 0);
      const rows: TaxRow[] = members.map(({ data, y }) =>
        kind === "foncier"
          ? { propertyId: data.property.id, receipts: y.rents, interest: y.interest + y.insurance, other: y.expenses - y.improvements - y.recoverable + MANAGEMENT_FLAT_FEE * data.property.share, amortization: 0 }
          : {
              propertyId: data.property.id,
              receipts: lmnpReceipts(y),
              interest: 0,
              other: y.expenses - y.improvements + y.interest + y.insurance + (totalReceipts > 0 ? (params.rental.accountingFees * lmnpReceipts(y)) / totalReceipts : 0),
              amortization: regimes.lmnp === "reel" ? yearAmortization(data.property, data.leases, data.expenses, params.rental.landShare, year, today) : 0,
            },
      );
      const g =
        kind === "foncier"
          ? foncierYear(rows, regimes.foncier, year, tmi, FONCIER_SOCIAL_RATE, foncierCarry)
          : lmnpYear(rows, regimes.lmnp, year, tmi, socialRateFor(year, "patrimoine", params), lmnpState);
      const { byProperty, ...rest } = g;
      years.push({
        ...rest,
        year,
        kind,
        receipts: roundCents(g.receipts),
        taxable: roundCents(g.taxable),
        globalDeduction: roundCents(g.globalDeduction),
        amortizationUsed: roundCents(g.amortizationUsed),
        incomeTax: roundCents(g.incomeTax),
        social: roundCents(g.social),
        total: roundCents(g.incomeTax + g.social),
        carriedDeficit: roundCents((kind === "foncier" ? foncierCarry : lmnpState.carry).reduce((s, c) => s + c.amount, 0)),
        carriedAmortization: kind === "lmnp" ? roundCents(lmnpState.amortization) : 0,
      });
      for (const { data, y } of members) {
        const row = rows.find((r) => r.propertyId === data.property.id)!;
        const micro = g.regime === "micro";
        const allowance = kind === "foncier" ? 0.3 : 0.5;
        const list = properties.get(data.property.id) ?? [];
        list.push({
          year,
          kind,
          regime: g.regime,
          partial: y.partial,
          receipts: roundCents(row.receipts),
          deductible: roundCents(micro ? row.receipts * allowance : row.interest + row.other),
          amortization: roundCents(row.amortization),
          tax: byProperty.get(data.property.id) ?? 0,
        });
        properties.set(data.property.id, list);
      }
    }
  }
  return { years, properties };
}

/** Impôt d'un bien sur une année de référence : la dernière année complète, sinon la dernière connue (incomplète). */
export function propertyTaxReference(taxes: RentalTaxes, propertyId: string, today: string): { year: number; yearly: number; partial: boolean } | null {
  const list = taxes.properties.get(propertyId) ?? [];
  const thisYear = Number(today.slice(0, 4));
  const complete = list.filter((y) => y.year < thisYear && !y.partial).at(-1);
  if (complete) return { year: complete.year, yearly: complete.tax, partial: false };
  const last = list.at(-1);
  if (!last) return null;
  return { year: last.year, yearly: last.tax, partial: true };
}

/** Impôt total estimé d'un bien depuis le début : à ajouter à ce qui est sorti de la poche. */
export const propertyTaxTotal = (taxes: RentalTaxes, propertyId: string) => roundCents((taxes.properties.get(propertyId) ?? []).reduce((s, y) => s + y.tax, 0));

/** Déficits et amortissements reportés d'un bien seul, pour projeter ses années futures. */
export interface TaxCarry {
  foncier: Carry;
  lmnp: { carry: Carry; amortization: number };
}

/**
 * Reports du bien à la fin de sa dernière année connue : ceux de son groupe, au prorata de ses recettes cette année-là
 * (exact quand il est seul dans son groupe).
 */
export function propertyTaxCarry(taxes: RentalTaxes, propertyId: string, kind: RentalTaxKind): TaxCarry {
  const last = (taxes.properties.get(propertyId) ?? []).filter((y) => y.kind === kind).at(-1);
  const group = last ? taxes.years.find((y) => y.year === last.year && y.kind === kind) : undefined;
  const part = last && group && group.receipts > 0 ? last.receipts / group.receipts : 0;
  const deficit = group ? group.carriedDeficit * part : 0;
  const carry: Carry = deficit > 0 && last ? [{ year: last.year, amount: deficit }] : [];
  return kind === "foncier" ? { foncier: carry, lmnp: { carry: [], amortization: 0 } } : { foncier: [], lmnp: { carry, amortization: group ? group.carriedAmortization * part : 0 } };
}

/** Impôt d'une année future d'un bien seul, avec ses reports (mis à jour). */
export function projectedTax(kind: RentalTaxKind, regime: RentalRegime, row: TaxRow, year: number, params: PlanParams, carry: TaxCarry): { total: number; amortizationUsed: number } {
  const g =
    kind === "foncier"
      ? foncierYear([row], regime, year, params.tax.tmi, FONCIER_SOCIAL_RATE, carry.foncier)
      : lmnpYear([row], regime, year, params.tax.tmi, socialRateFor(year, "patrimoine", params), carry.lmnp);
  return { total: g.incomeTax + g.social, amortizationUsed: g.amortizationUsed };
}
