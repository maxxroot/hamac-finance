import { addDays, addMonths, daysBetween, roundCents } from "../base";
import { expenseDates, recoverableAmount, type PropertyExpense } from "./expenses";
import { daysInMonth, depositRetained, leaseEnd, leaseRentAt, rentMonths, type Lease, type LeaseRent, type RentLedger, type RentMonth } from "./leases";
import { lotIsActive, type Lot } from "./lots";
import { propertyTotalCost, type Property } from "./realestate";
import { loanYears, type Loan } from "../loans";

/** Suivi financier d'un bien en location : dépenses, et résultats année par année. */

export const INCOME_CATEGORIES = ["regularisation_recue", "regularisation_rendue", "indemnite", "autre"] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  regularisation_recue: "Régularisation de charges reçue",
  regularisation_rendue: "Régularisation de charges rendue",
  indemnite: "Indemnité d'assurance",
  autre: "Autre recette",
};

/** Recette hors loyer, du bien entier. Le montant est positif ; la catégorie donne le sens. */
export interface PropertyIncome {
  id: string;
  propertyId: string;
  date: string;
  category: IncomeCategory;
  amount: number;
  label: string;
}

export const incomeSigned = (i: Pick<PropertyIncome, "category" | "amount">) => (i.category === "regularisation_rendue" ? -i.amount : i.amount);

export interface RentalData {
  incomes: readonly PropertyIncome[];
  property: Property;
  leases: readonly Lease[];
  rents: readonly LeaseRent[];
  /** Paiements pointés et mois remis. */
  ledger: RentLedger;
  expenses: readonly PropertyExpense[];
  loans: readonly Loan[];
  /** Lots du bien ; sans lot connu, tous les baux portent sur le même logement. */
  lots?: readonly Lot[];
}

/** Période où un lot est proposé à la location, et son poids dans le taux d'occupation. */
export interface LotWindow {
  /** null : baux sans lot connu (anciennes données). */
  lotId: string | null;
  from: string;
  to: string;
  weight: number;
  months: RentMonth[];
}

/**
 * Un lot compte du début de son premier bail (ou du premier bail du bien, s'il est vide mais a un loyer espéré)
 * jusqu'à `lastDay` ; un lot archivé ou qui ne correspond plus au mode de location s'arrête à la fin de son dernier bail.
 * Son poids est son loyer espéré, sinon le dernier loyer de ses baux : un parking vide ne pèse pas comme un appartement vide.
 */
function lotWindows(data: RentalData, leases: readonly Lease[], months: readonly RentMonth[], asOf: string, lastDay: string, firstLease: string | null): LotWindow[] {
  const lots = (data.lots ?? []).filter((l) => l.propertyId === data.property.id);
  const known = new Set(lots.map((l) => l.id));
  const groups: Array<{ lot: Lot | null; leases: Lease[] }> = lots.map((lot) => ({ lot, leases: leases.filter((l) => l.lotId === lot.id) }));
  const orphans = leases.filter((l) => !known.has(l.lotId));
  if (orphans.length) groups.push({ lot: null, leases: orphans });
  const out: LotWindow[] = [];
  for (const g of groups) {
    const started = g.leases.filter((l) => l.startDate <= asOf);
    const open = g.lot == null || lotIsActive(g.lot, data.property.rentalMode);
    const target = g.lot?.targetRent != null && g.lot.targetRent > 0 ? g.lot.targetRent : null;
    let from: string;
    let to = lastDay;
    if (started.length) {
      from = started.reduce((min, l) => (l.startDate < min ? l.startDate : min), started[0].startDate);
      if (!open) {
        const ends = started.map((l) => leaseEnd(l) ?? lastDay);
        to = ends.reduce((max, e) => (e > max ? e : max), ends[0]);
        if (to > lastDay) to = lastDay;
      }
    } else if (open && target != null && firstLease != null) from = firstLease;
    else continue;
    const latest = started.reduce<Lease | null>((best, l) => (best == null || l.startDate > best.startDate ? l : best), null);
    const latestEnd = latest ? (leaseEnd(latest) ?? asOf) : asOf;
    const lastRent = latest ? leaseRentAt(latest, data.rents, (latestEnd < asOf ? latestEnd : asOf).slice(0, 7)).rent : 0;
    const ids = new Set(g.leases.map((l) => l.id));
    out.push({ lotId: g.lot?.id ?? null, from, to, weight: target ?? (lastRent > 0 ? lastRent : 1), months: months.filter((m) => ids.has(m.leaseId)) });
  }
  return out;
}

const overlapDays = (from: string, to: string, start: string, end: string) => {
  const a = from > start ? from : start;
  const b = to < end ? to : end;
  return a > b ? 0 : daysBetween(a, b) + 1;
};

/** Une année de location, à la part détenue (crédits : part à charge), avant impôt. */
export interface PropertyYear {
  year: number;
  /** Année incomplète : mise en location en cours d'année, ou année en cours. */
  partial: boolean;
  /** Durée de la période de location dans l'année, en mois (12 pour une année entière). */
  rentalMonths: number;
  rents: number;
  charges: number;
  /** Recettes hors loyer : régularisations, indemnités, dépôt gardé. */
  otherIncome: number;
  expenses: number;
  /** Part des dépenses récupérable sur le locataire ; les provisions de charges reçues (`charges`) la couvrent. */
  recoverable: number;
  interest: number;
  insurance: number;
  capital: number;
  /** Loyers, charges et autres recettes, moins dépenses et coût du crédit. */
  remaining: number;
  /** Loyers reçus / coût d'achat complet, ramené à une année entière ; null sans coût d'achat ou hors période de location. */
  grossYield: number | null;
  /** Comme le rendement brut, après dépenses et charges reçues, sans le crédit. */
  netYield: number | null;
  /** Part de la période de location où le logement est occupé ; null avant le premier bail. */
  occupancy: number | null;
}

/** Date de fin des calculs d'un bien : sa vente, sinon aujourd'hui ; et le dernier jour compté (fin du mois en cours). */
function rentalHorizon(property: Property, today: string): { asOf: string; lastDay: string } {
  const sold = property.saleDate != null && property.saleDate < today;
  const asOf = sold ? property.saleDate! : today;
  return { asOf, lastDay: sold ? asOf : addDays(addMonths(`${asOf.slice(0, 7)}-01`, 1), -1) };
}

/** Périodes de location de chaque lot du bien, avec leurs mois de loyer, jusqu'à la fin du mois en cours. */
export function rentalWindows(data: RentalData, today: string): LotWindow[] {
  const { asOf, lastDay } = rentalHorizon(data.property, today);
  const leases = data.leases.filter((l) => l.propertyId === data.property.id);
  const months = leases.flatMap((l) => rentMonths(l, data.rents, data.ledger, asOf));
  const firstLease = leases.filter((l) => l.startDate <= asOf).reduce<string | null>((first, l) => (first == null || l.startDate < first ? l.startDate : first), null);
  return lotWindows(data, leases, months, asOf, lastDay, firstLease);
}

export const windowOverlapDays = (w: Pick<LotWindow, "from" | "to">, start: string, end: string) => overlapDays(w.from, w.to, start, end);

/** Résultats du bien, de l'année du premier événement (achat, bail, dépense, crédit) à celle de `asOf`. */
export function propertyYears(data: RentalData, today: string): PropertyYear[] {
  const { property } = data;
  // Un bien vendu n'a plus de résultats après sa vente.
  const sold = property.saleDate != null && property.saleDate < today;
  const asOf = sold ? property.saleDate! : today;
  const leases = data.leases.filter((l) => l.propertyId === property.id);
  const months = leases.flatMap((l) => rentMonths(l, data.rents, data.ledger, asOf));
  const expenses = data.expenses.filter((e) => e.propertyId === property.id).flatMap((e) => expenseDates(e, asOf).map((date) => ({ date, amount: e.amount, improvement: e.improvement, recoverable: recoverableAmount(e) })));
  const incomes = [
    ...data.incomes.filter((i) => i.propertyId === property.id && i.date <= asOf).map((i) => ({ date: i.date, amount: incomeSigned(i) })),
    ...leases.filter((l) => l.depositReturnedOn != null && l.depositReturnedOn <= asOf).map((l) => ({ date: l.depositReturnedOn!, amount: depositRetained(l) })),
  ];
  const loans = data.loans.filter((l) => l.propertyId === property.id).map((l) => ({ share: l.share, years: loanYears(l, asOf) }));
  const firstLease = leases.filter((l) => l.startDate <= asOf).reduce<string | null>((first, l) => (first == null || l.startDate < first ? l.startDate : first), null);
  const asOfYear = Number(asOf.slice(0, 4));
  const startYears = [
    ...(property.purchaseDate != null ? [Number(property.purchaseDate.slice(0, 4))] : []),
    ...(firstLease != null ? [Number(firstLease.slice(0, 4))] : []),
    ...expenses.map((e) => Number(e.date.slice(0, 4))),
    ...incomes.map((i) => Number(i.date.slice(0, 4))),
    ...loans.flatMap((l) => l.years.map((y) => y.year)),
  ].filter((y) => y <= asOfYear);
  if (startYears.length === 0) return [];

  const cost = propertyTotalCost(property);
  const lastDay = sold ? asOf : addDays(addMonths(`${asOf.slice(0, 7)}-01`, 1), -1);
  const windows = lotWindows(data, leases, months, asOf, lastDay, firstLease);
  const out: PropertyYear[] = [];
  for (let year = Math.min(...startYears); year <= asOfYear; year++) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const periodStart = firstLease != null && firstLease > yearStart ? firstLease : yearStart;
    const periodEnd = lastDay < yearEnd ? lastDay : yearEnd;
    const rentalDays = firstLease == null || periodStart > periodEnd ? 0 : daysBetween(periodStart, periodEnd) + 1;
    const daysInYear = daysBetween(yearStart, `${year + 1}-01-01`);

    const ofYear = months.filter((m) => m.month.startsWith(`${year}-`));
    const rents = ofYear.reduce((s, m) => s + m.receivedRent, 0);
    const charges = ofYear.reduce((s, m) => s + m.receivedCharges, 0);
    const spent = expenses.filter((e) => e.date.startsWith(`${year}-`)).reduce((s, e) => s + e.amount, 0);
    // Les améliorations s'ajoutent au coût : elles ne pèsent pas aussi sur le rendement de l'année.
    const recoverable = expenses.filter((e) => e.date.startsWith(`${year}-`)).reduce((s, e) => s + e.recoverable, 0);
    const running = expenses.filter((e) => e.date.startsWith(`${year}-`) && !e.improvement).reduce((s, e) => s + e.amount, 0);
    const improved = expenses.filter((e) => e.improvement && e.date <= yearEnd).reduce((s, e) => s + e.amount, 0);
    const received = incomes.filter((i) => i.date.startsWith(`${year}-`)).reduce((s, i) => s + i.amount, 0);
    // Occupation pondérée par le loyer de chaque lot, sur la période où il est proposé à la location.
    let offered = 0;
    let occupied = 0;
    for (const w of windows) {
      offered += w.weight * overlapDays(w.from, w.to, periodStart, periodEnd);
      occupied += w.weight * w.months.filter((m) => m.month.startsWith(`${year}-`)).reduce((s, m) => s + m.occupied * daysInMonth(m.month), 0);
    }

    const loanTotal = (field: "interest" | "insurance" | "capital") => loans.reduce((sum, l) => sum + (l.years.find((y) => y.year === year)?.[field] ?? 0) * l.share, 0);
    const interest = loanTotal("interest");
    const insurance = loanTotal("insurance");
    const capital = loanTotal("capital");

    const costToDate = cost == null ? null : cost + improved;
    const annualize = costToDate != null && costToDate > 0 && rentalDays > 0 ? daysInYear / rentalDays / costToDate : null;
    out.push({
      year,
      partial: rentalDays > 0 && rentalDays < daysInYear,
      rentalMonths: (rentalDays / daysInYear) * 12,
      rents: roundCents(rents * property.share),
      charges: roundCents(charges * property.share),
      otherIncome: roundCents(received * property.share),
      expenses: roundCents(spent * property.share),
      recoverable: roundCents(recoverable * property.share),
      interest: roundCents(interest),
      insurance: roundCents(insurance),
      capital: roundCents(capital),
      remaining: roundCents((rents + charges + received - spent) * property.share - interest - insurance - capital),
      grossYield: annualize == null ? null : rents * annualize,
      netYield: annualize == null ? null : (rents + charges + received - running) * annualize,
      occupancy: rentalDays > 0 && offered > 0 ? Math.min(1, occupied / offered) : null,
    });
  }
  return out;
}

export interface PropertyProfitability {
  /** Année de référence : la dernière complète, sinon la dernière louée. */
  year: number;
  partial: boolean;
  grossYield: number | null;
  netYield: number | null;
  monthlyRemaining: number | null;
  occupancy: number | null;
  /** Depuis l'achat, à la part détenue. */
  totalRents: number;
  totalCapital: number;
}

/** Synthèse de la rentabilité ; null tant que le bien n'a jamais été loué. */
export function propertyProfitability(years: readonly PropertyYear[]): PropertyProfitability | null {
  const rented = years.filter((y) => y.occupancy != null);
  const reference = rented.filter((y) => !y.partial).at(-1) ?? rented.at(-1);
  if (!reference) return null;
  return {
    year: reference.year,
    partial: reference.partial,
    grossYield: reference.grossYield,
    netYield: reference.netYield,
    monthlyRemaining: reference.rentalMonths > 0 ? roundCents(reference.remaining / reference.rentalMonths) : null,
    occupancy: reference.occupancy,
    totalRents: roundCents(years.reduce((s, y) => s + y.rents, 0)),
    totalCapital: roundCents(years.reduce((s, y) => s + y.capital, 0)),
  };
}

export const DOCUMENT_KINDS = ["acte", "bail", "diagnostic", "assurance", "facture", "autre"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  acte: "Acte de vente",
  bail: "Bail",
  diagnostic: "Diagnostic",
  assurance: "Assurance",
  facture: "Facture",
  autre: "Autre document",
};

/** Registre des documents d'un bien : Hamac note où ils se trouvent, sans stocker les fichiers. */
export interface PropertyDocument {
  id: string;
  propertyId: string;
  kind: DocumentKind;
  label: string;
  date: string | null;
  expiresOn: string | null;
  /** Où le retrouver : dossier, coffre-fort numérique… */
  location: string;
}
