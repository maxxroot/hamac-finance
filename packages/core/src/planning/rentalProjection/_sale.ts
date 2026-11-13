import { roundCents } from "../../base";
import { propertyImprovements, propertyYears, type RentalData } from "../../realestate";
import { realEstateGain, type PropertyTaxYear, type RealEstateGain, type RentalTaxKind } from "../../tax";
import type { ProjectionYear } from "./_years";

export interface RentalSale {
  year: number;
  /** Prix de vente estimé (net vendeur), plus-value et impôt, crédit remboursé, ce qu'il reste. */
  price: number;
  gain: RealEstateGain;
  debt: number;
  net: number;
  /** Tout ce que le bien aura rapporté, de l'apport à la vente : somme des flux, en euros. */
  totalGain: number | null;
  /** Taux de rendement interne annuel de l'opération ; null sans apport connu ou sans solution. */
  irr: number | null;
}

/** Taux r tel que Σ flux / (1 + r)^(année − première année) = 0, par bissection. */
export function internalRate(flows: ReadonlyMap<number, number>): number | null {
  const years = [...flows.keys()].sort((a, b) => a - b);
  if (years.length < 2) return null;
  const npv = (r: number) => years.reduce((s, y) => s + flows.get(y)! / Math.pow(1 + r, y - years[0]), 0);
  let lo = -0.99;
  let hi = 10;
  if (Math.sign(npv(lo)) === Math.sign(npv(hi))) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(npv(mid)) === Math.sign(npv(lo))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface SaleContext {
  data: RentalData;
  kind: RentalTaxKind;
  /** Années d'impôt passées du bien, et apport (coût non financé par le crédit). */
  pastTaxes: readonly PropertyTaxYear[];
  contribution: number | null;
  today: string;
}

/**
 * Revente fin `year` au prix projeté : plus-value immobilière (amortissements d'un meublé réintégrés), crédit
 * remboursé, puis rendement de l'opération depuis l'achat (flux réels passés, projetés ensuite).
 */
export function rentalSale(ctx: SaleContext, years: readonly ProjectionYear[], year: number): RentalSale | null {
  const { data } = ctx;
  const p = data.property;
  const at = years.find((y) => y.year === year);
  if (!at || p.purchasePrice == null || p.purchaseDate == null) return null;
  const improvements = propertyImprovements(data.expenses, p.id, ctx.today) * p.share;
  const pastAmortization = ctx.kind === "lmnp" ? ctx.pastTaxes.reduce((s, y) => s + (y.regime === "reel" ? y.amortization : 0), 0) : 0;
  const futureAmortization = years.filter((y) => y.year <= year).reduce((s, y) => s + y.amortizationUsed, 0);
  const gain = realEstateGain({
    purchaseDate: p.purchaseDate,
    saleDate: `${year}-12-31`,
    purchasePrice: p.purchasePrice * p.share,
    acquisitionFees: (p.notaryFees + p.agencyFees + p.otherFees) * p.share,
    works: p.initialWorks * p.share + improvements,
    salePrice: at.value,
    saleFees: 0,
    amortization: pastAmortization + futureAmortization,
  });
  const net = at.value - gain.total - at.debt;

  let totalGain: number | null = null;
  let irr: number | null = null;
  if (ctx.contribution != null) {
    const flows = new Map<number, number>();
    const add = (y: number, v: number) => flows.set(y, (flows.get(y) ?? 0) + v);
    add(Number(p.purchaseDate.slice(0, 4)), -ctx.contribution);
    for (const y of propertyYears(data, ctx.today)) add(y.year, y.remaining + y.improvements);
    for (const t of ctx.pastTaxes) add(t.year, -t.tax);
    for (const y of years.filter((x) => x.year <= year)) add(y.year, y.cashflow);
    add(year, net);
    totalGain = roundCents([...flows.values()].reduce((s, v) => s + v, 0));
    irr = internalRate(flows);
  }
  return { year, price: roundCents(at.value), gain, debt: roundCents(at.debt), net: roundCents(net), totalGain, irr };
}
