import { addDays, addMonths, daysBetween, roundCents } from "../base";
import { dpeExpiry, dpeFreezesRent } from "./energy";
import { leaseCanBeRevised } from "./irl";
import { daysInMonth, leaseEnd, leaseRentAt, leaseState, rentMonths, type Lease, type LeaseRent, type RentLedger, type RentMonth, type RentPayment, type RentWaiver, rentIsLate } from "./leases";
import { lotIsActive, sortLots, type Lot } from "./lots";
import { lotStatus } from "./lotStatus";
import type { Property } from "./realestate";
import type { Loan } from "../loans";
import { LEASE_GUARANTEE_LABELS, leaseRenterNames, type LeaseGuarantee, type LeaseRenter, type Renter } from "./renters";
import { EXPENSE_CATEGORY_LABELS, type PropertyExpense } from "./expenses";
import { propertyProfitability, propertyYears, rentalWindows, windowOverlapDays, type PropertyDocument, type PropertyIncome, type RentalData } from "./rental";

/**
 * Vue d'ensemble du parc loué, comme la tient une agence : loyers du mois, impayés, lots vides,
 * occupation, échéances à venir et résultats de chaque bien. Calculs purs sur les données déjà chargées.
 */

/** Rappel saisi à la main sur un bien : assemblée générale, entretien de la chaudière… */
export interface PropertyReminder {
  id: string;
  propertyId: string;
  /** Lot concerné, facultatif. */
  lotId: string | null;
  date: string;
  /** Revient chaque année à la même date. */
  yearly: boolean;
  label: string;
  comment: string;
  /** Rappel ponctuel marqué fait ; null tant qu'il ne l'est pas. */
  doneOn: string | null;
}

export interface ParkData {
  properties: readonly Property[];
  lots: readonly Lot[];
  leases: readonly Lease[];
  leaseRents: readonly LeaseRent[];
  rentPayments: readonly RentPayment[];
  rentWaivers: readonly RentWaiver[];
  renters: readonly Renter[];
  leaseRenters: readonly LeaseRenter[];
  leaseGuarantees: readonly LeaseGuarantee[];
  propertyExpenses: readonly PropertyExpense[];
  propertyIncomes: readonly PropertyIncome[];
  propertyDocuments: readonly PropertyDocument[];
  propertyReminders: readonly PropertyReminder[];
  loans: readonly Loan[];
}

/** Biens suivis : investissements locatifs non vendus ni archivés. */
export const parkProperties = (data: Pick<ParkData, "properties">) => data.properties.filter((p) => p.kind === "locatif" && !p.archived);

const lotNameOf = (lots: readonly Lot[], lotId: string) => lots.find((l) => l.id === lotId)?.name ?? "";
const lotsOf = (data: Pick<ParkData, "lots">, propertyId: string) => sortLots(data.lots.filter((l) => l.propertyId === propertyId));
/** Nom du lot seulement si le bien en a plusieurs. */
const shownLot = (data: Pick<ParkData, "lots">, lease: Lease) => (lotsOf(data, lease.propertyId).length > 1 ? lotNameOf(data.lots, lease.lotId) : "");

export interface ParkRentLine {
  property: Property;
  lease: Lease;
  lotName: string;
  renters: string;
  month: RentMonth;
}

export interface ParkMonth {
  month: string;
  lines: ParkRentLine[];
  expected: number;
  received: number;
  /** Reste dû, passé le délai de tolérance. */
  late: number;
  /** Reste dû sur les loyers pas encore en retard. */
  pending: number;
}

/** Loyers et charges attendus et reçus pour un mois AAAA-MM, bail par bail. */
export function parkMonth(data: ParkData, month: string, today: string): ParkMonth {
  const asOf = `${month}-${String(daysInMonth(month)).padStart(2, "0")}` < today ? `${month}-${String(daysInMonth(month)).padStart(2, "0")}` : today;
  const lines: ParkRentLine[] = [];
  for (const property of parkProperties(data)) {
    for (const lease of data.leases.filter((l) => l.propertyId === property.id)) {
      const m = rentMonths(lease, data.leaseRents, ledgerOf(data), asOf).find((x) => x.month === month);
      if (m && (m.due > 0 || m.waiver)) lines.push({ property, lease, lotName: shownLot(data, lease), renters: leaseRenterNames(lease.id, data.leaseRenters, data.renters), month: m });
    }
  }
  lines.sort((a, b) => a.property.name.localeCompare(b.property.name, "fr") || a.lotName.localeCompare(b.lotName, "fr", { numeric: true }));
  const sum = (f: (l: ParkRentLine) => number) => roundCents(lines.reduce((s, l) => s + f(l), 0));
  return {
    month,
    lines,
    expected: sum((l) => l.month.due),
    received: sum((l) => l.month.receivedRent + l.month.receivedCharges),
    late: sum((l) => (rentIsLate(l.month) ? l.month.outstanding : 0)),
    pending: sum((l) => (rentIsLate(l.month) ? 0 : l.month.outstanding)),
  };
}

export interface ParkDebt {
  property: Property;
  lease: Lease;
  lotName: string;
  renters: string;
  /** Mois non reçus ou reçus en partie, passé le délai de tolérance, du plus ancien au plus récent. */
  months: string[];
  due: number;
}

/** Ce que chaque bail doit encore : les loyers non reçus ou reçus en partie, passé le délai de tolérance. */
export function parkDebts(data: ParkData, today: string): ParkDebt[] {
  const out: ParkDebt[] = [];
  for (const property of parkProperties(data)) {
    for (const lease of data.leases.filter((l) => l.propertyId === property.id)) {
      const unpaid = rentMonths(lease, data.leaseRents, ledgerOf(data), today).filter(rentIsLate);
      if (!unpaid.length) continue;
      out.push({ property, lease, lotName: shownLot(data, lease), renters: leaseRenterNames(lease.id, data.leaseRenters, data.renters), months: unpaid.map((m) => m.month).sort(), due: roundCents(unpaid.reduce((s, m) => s + m.outstanding, 0)) });
    }
  }
  return out.sort((a, b) => b.due - a.due);
}

/** Loyer mensuel qu'un lot vide pourrait rapporter : son loyer espéré, sinon le dernier loyer de ses baux. */
export function lotPotentialRent(lot: Lot, leases: readonly Lease[], rents: readonly LeaseRent[]): number | null {
  if (lot.targetRent != null && lot.targetRent > 0) return lot.targetRent;
  const last = leases.filter((l) => l.lotId === lot.id).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  if (!last) return null;
  const end = leaseEnd(last);
  return leaseRentAt(last, rents, (end ?? last.startDate).slice(0, 7)).rent;
}

export interface ParkVacancy {
  property: Property;
  lot: Lot;
  /** Premier jour vide ; null pour un lot jamais loué. */
  since: string | null;
  days: number | null;
  potentialRent: number | null;
  /** Loyers perdus depuis le départ, au loyer possible ; null sans date ou sans loyer connu. */
  lost: number | null;
  /** Prochain bail déjà signé, s'il y en a un. */
  nextStart: string | null;
}

/** Lots proposés à la location qui n'ont pas de bail en cours. */
export function parkVacancies(data: ParkData, today: string): ParkVacancy[] {
  const out: ParkVacancy[] = [];
  for (const property of parkProperties(data)) {
    for (const lot of lotsOf(data, property.id).filter((l) => lotIsActive(l, property.rentalMode))) {
      const leases = data.leases.filter((l) => l.lotId === lot.id);
      const s = lotStatus(lot, leases, data.leaseRents, today);
      if (s.current) continue;
      // Un parking ou une cave jamais loués sans loyer espéré ne sont pas « vides » : ils ne sont pas proposés.
      const potentialRent = lotPotentialRent(lot, leases, data.leaseRents);
      if (s.vacantSince == null && potentialRent == null) continue;
      const days = s.vacantSince != null && s.vacantSince <= today ? daysBetween(s.vacantSince, today) : null;
      out.push({ property, lot, since: s.vacantSince, days, potentialRent, lost: days != null && potentialRent != null ? roundCents((potentialRent * 12 * days) / 365) : null, nextStart: s.upcoming?.lease.startDate ?? null });
    }
  }
  return out.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
}

/** Jours entre la fin d'un bail et le début du suivant sur le même lot, pour chaque relocation. */
export function relocationGaps(leases: readonly Lease[]): number[] {
  const out: number[] = [];
  const byLot = new Map<string, Lease[]>();
  for (const l of leases) byLot.set(l.lotId, [...(byLot.get(l.lotId) ?? []), l]);
  for (const list of byLot.values()) {
    const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 1; i < sorted.length; i++) {
      const end = leaseEnd(sorted[i - 1]);
      if (end != null) out.push(Math.max(0, daysBetween(addDays(end, 1), sorted[i].startDate)));
    }
  }
  return out;
}

export interface Occupancy {
  /** Jours loués ÷ jours où les lots étaient proposés ; null sans période de location. */
  physical: number | null;
  /** Loyers reçus ÷ loyers possibles (lots loués au loyer du bail, lots vides au loyer possible). */
  financial: number | null;
  received: number;
  possible: number;
}

const ratio = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : null);

interface OccupancySums {
  offered: number;
  occupied: number;
  received: number;
  possible: number;
}

function occupancySums(data: ParkData, property: Property, year: number, today: string): OccupancySums {
  const sums: OccupancySums = { offered: 0, occupied: 0, received: 0, possible: 0 };
  for (const w of rentalWindows(rentalDataOf(data, property), today)) {
    const days = windowOverlapDays(w, `${year}-01-01`, `${year}-12-31`);
    if (days === 0) continue;
    const ofYear = w.months.filter((m) => m.month.startsWith(`${year}-`));
    const occupied = ofYear.reduce((s, m) => s + m.occupied * daysInMonth(m.month), 0);
    sums.offered += days;
    sums.occupied += occupied;
    sums.received += ofYear.reduce((s, m) => s + m.receivedRent, 0);
    // Jours loués au loyer du bail ; jours vides au loyer que le lot aurait pu rapporter.
    sums.possible += ofYear.reduce((s, m) => s + m.expectedRent, 0) + (Math.max(0, days - occupied) * w.weight * 12) / 365;
  }
  return sums;
}

const toOccupancy = (s: OccupancySums): Occupancy => ({ physical: ratio(s.occupied, s.offered), financial: ratio(s.received, s.possible), received: roundCents(s.received), possible: roundCents(s.possible) });

/** Occupation d'un bien sur une année : physique (jours) et financière (loyers). */
export const propertyOccupancy = (data: ParkData, property: Property, year: number, today: string) => toOccupancy(occupancySums(data, property, year, today));

/** Occupation de tout le parc sur une année. */
export function parkOccupancy(data: ParkData, year: number, today: string): Occupancy {
  const total: OccupancySums = { offered: 0, occupied: 0, received: 0, possible: 0 };
  for (const p of parkProperties(data)) {
    const s = occupancySums(data, p, year, today);
    total.offered += s.offered;
    total.occupied += s.occupied;
    total.received += s.received;
    total.possible += s.possible;
  }
  return toOccupancy(total);
}

const ledgerOf = (data: Pick<ParkData, "rentPayments" | "rentWaivers">): RentLedger => ({ payments: data.rentPayments, waivers: data.rentWaivers });

function rentalDataOf(data: ParkData, property: Property): RentalData {
  return { property, incomes: data.propertyIncomes, leases: data.leases, rents: data.leaseRents, ledger: ledgerOf(data), expenses: data.propertyExpenses, loans: data.loans, lots: data.lots };
}

export interface ParkPropertyRow {
  property: Property;
  lots: number;
  rentedLots: number;
  /** Loyer hors charges du mois, tous baux en cours confondus. */
  monthlyRent: number;
  occupancy: Occupancy;
  grossYield: number | null;
  netYield: number | null;
  /** Ce qui reste par mois après dépenses et crédit, sur l'année de référence des rendements. */
  monthlyRemaining: number | null;
  referenceYear: number | null;
  /** Durée moyenne entre deux baux sur un même lot, en jours ; null sans relocation. */
  averageRelocationDays: number | null;
}

/** Une ligne par bien loué : loyer, lots loués, occupation de l'année, rendements et délai de relocation. */
export function parkPropertyRows(data: ParkData, year: number, today: string): ParkPropertyRow[] {
  return parkProperties(data).map((p) => {
    const leases = data.leases.filter((l) => l.propertyId === p.id);
    const lots = lotsOf(data, p.id).filter((l) => lotIsActive(l, p.rentalMode));
    const running = leases.map((l) => leaseState(l, data.leaseRents, today)).filter((s) => s.status === "en_cours" || s.status === "conge");
    const profit = propertyProfitability(propertyYears(rentalDataOf(data, p), today));
    const gaps = relocationGaps(leases);
    return {
      property: p,
      lots: Math.max(lots.length, running.length ? 1 : 0),
      rentedLots: new Set(running.map((s) => s.lease.lotId)).size,
      monthlyRent: roundCents(running.reduce((s, x) => s + x.rent, 0)),
      occupancy: propertyOccupancy(data, p, year, today),
      grossYield: profit?.grossYield ?? null,
      netYield: profit?.netYield ?? null,
      monthlyRemaining: profit?.monthlyRemaining ?? null,
      referenceYear: profit?.year ?? null,
      averageRelocationDays: gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null,
    };
  });
}

export const SCHEDULE_KINDS = ["revision", "fin_bail", "conge", "depot", "assurance", "garantie", "document", "dpe", "depense", "rappel"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];
export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = {
  revision: "Révision du loyer",
  fin_bail: "Fin de bail",
  conge: "Date limite de congé",
  depot: "Dépôt à rendre",
  assurance: "Assurance du locataire",
  garantie: "Fin de garantie",
  document: "Document",
  dpe: "Diagnostic énergétique",
  depense: "Dépense prévue",
  rappel: "Rappel",
};

export interface ScheduleItem {
  /** Identifiant stable, pour l'affichage. */
  key: string;
  date: string;
  kind: ScheduleKind;
  property: Property;
  lotName: string;
  title: string;
  /** Date passée : à faire sans attendre. */
  late: boolean;
  /** Rappel saisi à la main, modifiable depuis la liste. */
  reminder: PropertyReminder | null;
  amount: number | null;
}

/** Prochaine date d'une échéance annuelle à partir de `from` (incluse), ou null après sa dernière année. */
function nextYearly(date: string, from: string, untilYear: number | null = null): string | null {
  let d = date;
  for (let n = 1; d < from; n++) d = addMonths(date, 12 * n);
  return untilYear != null && Number(d.slice(0, 4)) > untilYear ? null : d;
}

/**
 * Toutes les dates à venir du parc, des `days` prochains jours, triées.
 * Les dépôts à rendre et les rappels ponctuels non faits restent affichés, même en retard.
 */
export function parkSchedule(data: ParkData, today: string, days = 365): ScheduleItem[] {
  const until = addDays(today, days);
  const out: ScheduleItem[] = [];
  const push = (item: Omit<ScheduleItem, "late" | "reminder" | "amount" | "lotName"> & Partial<Pick<ScheduleItem, "reminder" | "amount" | "lotName">>, keepLate = false) => {
    if (item.date > until || (item.date < today && !keepLate)) return;
    out.push({ lotName: "", reminder: null, amount: null, ...item, late: item.date < today });
  };
  for (const property of parkProperties(data)) {
    const leases = data.leases.filter((l) => l.propertyId === property.id);
    for (const lease of leases) {
      const s = leaseState(lease, data.leaseRents, today);
      const lotName = shownLot(data, lease);
      const who = leaseRenterNames(lease.id, data.leaseRenters, data.renters);
      const suffix = who ? ` (${who})` : "";
      if (s.status === "termine") {
        // Délai légal le plus long (deux mois) : au-delà, la restitution est en retard dans tous les cas.
        if (lease.deposit > 0 && lease.depositReturned == null && s.end) push({ key: `depot-${lease.id}`, date: addMonths(s.end, 2), kind: "depot", property, lotName, title: `Rendre le dépôt de garantie${suffix}`, amount: lease.deposit }, true);
        continue;
      }
      if (s.end) push({ key: `fin-${lease.id}`, date: s.end, kind: "fin_bail", property, lotName, title: `Fin du bail${suffix}` });
      if (s.nextDeadline) push({ key: `conge-${lease.id}`, date: s.nextDeadline, kind: "conge", property, lotName, title: "Dernier jour pour donner congé" });
      if (lease.tenantInsuranceUntil) push({ key: `assurance-${lease.id}`, date: lease.tenantInsuranceUntil, kind: "assurance", property, lotName, title: `Attestation d'assurance à renouveler${suffix}` });
      if (leaseCanBeRevised(lease) && !dpeFreezesRent(property.dpe)) {
        const anniversary = nextYearly(addMonths(lease.startDate, 12), today);
        if (anniversary && (s.end == null || anniversary <= s.end)) push({ key: `revision-${lease.id}-${anniversary}`, date: anniversary, kind: "revision", property, lotName, title: "Révision annuelle du loyer" });
      }
      for (const g of data.leaseGuarantees.filter((x) => x.leaseId === lease.id && x.until != null)) {
        push({ key: `garantie-${g.id}`, date: g.until!, kind: "garantie", property, lotName, title: `${LEASE_GUARANTEE_LABELS[g.kind]}${g.name ? ` (${g.name})` : ""} prend fin` });
      }
    }
    for (const d of data.propertyDocuments.filter((x) => x.propertyId === property.id && x.expiresOn != null)) push({ key: `document-${d.id}`, date: d.expiresOn!, kind: "document", property, title: `${d.label} expire` });
    if (property.dpeDate) push({ key: `dpe-${property.id}`, date: dpeExpiry(property.dpeDate), kind: "dpe", property, title: "Fin de validité du DPE" });
    for (const e of data.propertyExpenses.filter((x) => x.propertyId === property.id && x.yearly)) {
      const next = nextYearly(e.date, today, e.untilYear);
      if (next) push({ key: `depense-${e.id}`, date: next, kind: "depense", property, title: e.label || EXPENSE_CATEGORY_LABELS[e.category], amount: e.amount });
    }
    for (const r of data.propertyReminders.filter((x) => x.propertyId === property.id)) {
      const lotName = r.lotId ? lotNameOf(data.lots, r.lotId) : "";
      if (r.yearly) {
        const next = nextYearly(r.date, today);
        if (next) push({ key: `rappel-${r.id}`, date: next, kind: "rappel", property, lotName, title: r.label, reminder: r });
      } else if (r.doneOn == null) push({ key: `rappel-${r.id}`, date: r.date, kind: "rappel", property, lotName, title: r.label, reminder: r }, true);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.property.name.localeCompare(b.property.name, "fr"));
}
