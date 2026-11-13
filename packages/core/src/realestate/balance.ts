import { monthsBetween, roundCents } from "../base";
import { propertyImprovements } from "./expenses";
import { propertyTotalCost } from "./realestate";
import { propertyYears, type RentalData } from "./rental";

/**
 * Bilan d'un bien depuis l'achat, à la part détenue (crédits : part à charge) : ce qui est sorti de la poche,
 * ce qui est rentré, et ce que le bien a fait gagner une fois sa valeur nette comptée.
 */
export interface PropertyBalance {
  /** Début du bilan : date d'achat, sinon premier événement connu. */
  since: string;
  /** Fin : vente, sinon aujourd'hui. */
  until: string;
  months: number;
  /** Ce que les crédits n'ont pas financé : coût d'achat complet et améliorations, moins le capital emprunté. Null sans prix d'achat. */
  contribution: number | null;
  borrowed: number;
  /** Échéances payées (capital, intérêts, assurance), remboursements anticipés et leurs indemnités compris. */
  loanPayments: number;
  /** Dépenses payées, hors améliorations (elles sont dans l'apport). */
  expenses: number;
  /** Impôts estimés sur les loyers. */
  taxes: number;
  /** Loyers et charges reçus. */
  rents: number;
  /** Régularisations, indemnités, dépôt gardé. */
  otherIncome: number;
  out: number | null;
  in: number;
  /** Sorti − rentré : ce que le bien a coûté de votre poche jusqu'ici. */
  netEffort: number | null;
  monthlyEffort: number | null;
  /** Valeur nette d'aujourd'hui (valeur détenue − capital restant dû), ou ce qu'il reste de la vente. */
  netValue: number;
  /** Valeur nette − effort net : l'enrichissement réel, avant impôt sur une plus-value. */
  enrichment: number | null;
}

export function propertyBalance(data: RentalData, netValue: number, today: string, taxes = 0): PropertyBalance | null {
  const { property } = data;
  const until = property.saleDate != null && property.saleDate < today ? property.saleDate : today;
  const years = propertyYears(data, today);
  const since = property.purchaseDate ?? (years.length ? `${years[0].year}-01-01` : null);
  if (since == null) return null;
  const total = (pick: (y: (typeof years)[number]) => number) => roundCents(years.reduce((s, y) => s + pick(y), 0));
  const improvements = propertyImprovements(data.expenses, property.id, until) * property.share;
  const borrowed = roundCents(data.loans.filter((l) => l.propertyId === property.id).reduce((s, l) => s + l.principal * l.share, 0));
  const cost = propertyTotalCost(property);
  const contribution = cost == null ? null : roundCents(cost * property.share + improvements - borrowed);
  const loanPayments = total((y) => y.capital + y.interest + y.insurance);
  const expenses = roundCents(total((y) => y.expenses) - improvements);
  const rents = total((y) => y.rents + y.charges);
  const otherIncome = total((y) => y.otherIncome);
  const out = contribution == null ? null : roundCents(contribution + loanPayments + expenses + taxes);
  const income = roundCents(rents + otherIncome);
  const netEffort = out == null ? null : roundCents(out - income);
  const months = Math.max(1, monthsBetween(since, until) + 1);
  return {
    since,
    until,
    months,
    contribution,
    borrowed,
    loanPayments,
    expenses,
    taxes: roundCents(taxes),
    rents,
    otherIncome,
    out,
    in: income,
    netEffort,
    monthlyEffort: netEffort == null ? null : roundCents(netEffort / months),
    netValue: roundCents(netValue),
    enrichment: netEffort == null ? null : roundCents(netValue - netEffort),
  };
}
