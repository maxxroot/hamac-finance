import { addDays, addMonths } from "./dates";
import { roundCents } from "./money";
import type { PropertyOwnership } from "./realestate";
import { daysBetween } from "./xirr";

/**
 * Baux d'habitation : durée, dépôt de garantie, reconduction et congé.
 * Source : loi n° 89-462 du 6 juillet 1989, art. 10, 13, 15 et 22 (location vide), 25-6 à 25-8 (meublé),
 * 25-14, 25-15 et 25-17 (bail mobilité), consultés sur legifrance.gouv.fr le 09/11/2026.
 * Fin de préavis : service-public.gouv.fr, fiche F32360 (même quantième, ou dernier jour du mois).
 */

export const LEASE_KINDS = ["vide", "meuble", "etudiant", "mobilite", "autre"] as const;
export type LeaseKind = (typeof LEASE_KINDS)[number];
export const LEASE_KIND_LABELS: Record<LeaseKind, string> = {
  vide: "Location vide",
  meuble: "Location meublée",
  etudiant: "Meublé étudiant (9 mois)",
  mobilite: "Bail mobilité",
  autre: "Autre bail",
};

export const LEASE_NOTICE_BY = ["locataire", "proprietaire"] as const;
export type LeaseNoticeBy = (typeof LEASE_NOTICE_BY)[number];

interface LeaseRules {
  /** Reconduction tacite, pour la même durée, en l'absence de congé. */
  renews: boolean;
  /** Préavis minimal du propriétaire avant la fin de la période en cours ; null si le bail s'arrête seul. */
  ownerNoticeMonths: number | null;
  /** Préavis habituel du locataire. */
  tenantNoticeMonths: number;
  /** Plafond du dépôt en mois de loyer hors charges ; null si la loi de 1989 ne le fixe pas ici. */
  depositMonths: number | null;
}

const LEASE_RULES: Record<LeaseKind, LeaseRules> = {
  vide: { renews: true, ownerNoticeMonths: 6, tenantNoticeMonths: 3, depositMonths: 1 },
  meuble: { renews: true, ownerNoticeMonths: 3, tenantNoticeMonths: 1, depositMonths: 2 },
  etudiant: { renews: false, ownerNoticeMonths: null, tenantNoticeMonths: 1, depositMonths: 2 },
  mobilite: { renews: false, ownerNoticeMonths: null, tenantNoticeMonths: 1, depositMonths: 0 },
  autre: { renews: false, ownerNoticeMonths: null, tenantNoticeMonths: 3, depositMonths: null },
};

export const leaseRenews = (kind: LeaseKind) => LEASE_RULES[kind].renews;
export const defaultTenantNoticeMonths = (kind: LeaseKind) => LEASE_RULES[kind].tenantNoticeMonths;

/** Durée proposée : en location vide, 6 ans pour une personne morale, sauf SCI familiale (art. 10 et 13). */
export function defaultLeaseMonths(kind: LeaseKind, ownership: PropertyOwnership): number {
  switch (kind) {
    case "vide":
      return ownership === "sci" ? 72 : 36;
    case "etudiant":
      return 9;
    case "mobilite":
      return 10;
    default:
      return 12;
  }
}

/** Dépôt de garantie maximal ; null si aucun plafond n'est connu pour ce type de bail. */
export function maxDeposit(kind: LeaseKind, rent: number): number | null {
  const months = LEASE_RULES[kind].depositMonths;
  return months == null ? null : roundCents(rent * months);
}

/** Avertissement si la durée choisie s'écarte de la durée légale ; la saisie reste possible (bail dérogatoire, résidence à vocation d'emploi). */
export function leaseDurationNote(kind: LeaseKind, ownership: PropertyOwnership, months: number): string | null {
  const legal = defaultLeaseMonths(kind, ownership);
  if (kind === "vide" && months < legal) return `La durée légale est de ${legal / 12} ans, sauf reprise prévue pour raison familiale ou professionnelle (1 an minimum).`;
  if (kind === "meuble" && months < 12) return "La durée légale est d'au moins un an.";
  if (kind === "etudiant" && months < 9) return "La durée légale est d'au moins neuf mois.";
  if (kind === "mobilite" && months > 10) return "Un bail mobilité dure dix mois au plus.";
  return null;
}

export interface Lease {
  id: string;
  propertyId: string;
  kind: LeaseKind;
  /** Nom du locataire, facultatif. */
  tenant: string;
  startDate: string;
  /** Durée du bail, et de chaque reconduction. */
  durationMonths: number;
  /** Loyer hors charges et charges du bien entier, par mois, au début du bail. */
  rent: number;
  charges: number;
  deposit: number;
  noticeBy: LeaseNoticeBy | null;
  /** Date à laquelle le congé a été reçu. */
  noticeDate: string | null;
  /** Préavis du locataire en mois ; null = préavis habituel pour ce type de bail. */
  noticeMonths: number | null;
  /** Date de départ réelle, si elle diffère de la fin calculée. */
  actualEnd: string | null;
  comment: string;
}

/** Nouveau loyer (révision annuelle…), en vigueur à partir d'un mois. */
export interface LeaseRent {
  id: string;
  leaseId: string;
  /** AAAA-MM */
  fromMonth: string;
  rent: number;
  charges: number;
}

type LeaseDates = Pick<Lease, "kind" | "startDate" | "durationMonths" | "noticeBy" | "noticeDate" | "noticeMonths" | "actualEnd">;

/** Dernier jour de la n-ième période du bail (1 = période initiale). */
const termEnd = (l: LeaseDates, n: number) => addDays(addMonths(l.startDate, n * l.durationMonths), -1);

/** Numéro de la période contenant `date`. */
function termAt(l: LeaseDates, date: string): number {
  if (!LEASE_RULES[l.kind].renews) return 1;
  let n = 1;
  while (termEnd(l, n) < date) n++;
  return n;
}

/** Dernier jour où le locataire peut recevoir le congé du propriétaire pour la n-ième période. */
const ownerDeadline = (l: LeaseDates, n: number) => addMonths(termEnd(l, n), -LEASE_RULES[l.kind].ownerNoticeMonths!);

/** Première période de fin pour laquelle un congé du propriétaire est dans les temps. */
function ownerNoticeTerm(l: LeaseDates, noticeDate: string): number {
  let n = termAt(l, noticeDate);
  while (ownerDeadline(l, n) < noticeDate) n++;
  return n;
}

const ownerNoticeApplies = (l: LeaseDates) => l.noticeBy === "proprietaire" && l.noticeDate != null && LEASE_RULES[l.kind].renews;

/** Dernier jour du bail ; null tant qu'il se reconduit sans date de fin connue. */
export function leaseEnd(l: LeaseDates): string | null {
  if (l.actualEnd) return l.actualEnd;
  const firstTerm = termEnd(l, 1);
  const { renews } = LEASE_RULES[l.kind];
  if (l.noticeBy === "locataire" && l.noticeDate) {
    const end = addMonths(l.noticeDate, l.noticeMonths ?? LEASE_RULES[l.kind].tenantNoticeMonths);
    return !renews && end > firstTerm ? firstTerm : end;
  }
  if (ownerNoticeApplies(l)) return termEnd(l, ownerNoticeTerm(l, l.noticeDate!));
  return renews ? null : firstTerm;
}

/** Loyer et charges en vigueur pour un mois AAAA-MM. */
export function leaseRentAt(lease: Pick<Lease, "id" | "rent" | "charges">, rents: readonly LeaseRent[], month: string): { rent: number; charges: number } {
  const last = rents.filter((r) => r.leaseId === lease.id && r.fromMonth <= month).reduce<LeaseRent | null>((best, r) => (best == null || r.fromMonth > best.fromMonth ? r : best), null);
  return last ? { rent: last.rent, charges: last.charges } : { rent: lease.rent, charges: lease.charges };
}

export type LeaseStatus = "a_venir" | "en_cours" | "conge" | "termine";
export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = { a_venir: "À venir", en_cours: "En cours", conge: "Congé donné", termine: "Terminé" };

export interface LeaseState {
  lease: Lease;
  status: LeaseStatus;
  end: string | null;
  /** Fin de la période en cours (ou de la première, si le bail n'a pas commencé). */
  termEnd: string;
  /** Prochaine date limite du propriétaire pour donner congé, et la fin de période qu'elle concerne. */
  nextDeadline: string | null;
  nextDeadlineTermEnd: string | null;
  /** Fin de période manquée par un congé du propriétaire arrivé trop tard : il vaut pour la suivante. */
  noticeTooLateFor: string | null;
  rent: number;
  charges: number;
}

export function leaseState(lease: Lease, rents: readonly LeaseRent[], asOf: string): LeaseState {
  const end = leaseEnd(lease);
  const status: LeaseStatus = asOf < lease.startDate ? "a_venir" : end != null && asOf > end ? "termine" : lease.noticeDate ? "conge" : "en_cours";
  const reference = asOf < lease.startDate ? lease.startDate : asOf;
  let nextDeadline: string | null = null;
  let nextDeadlineTermEnd: string | null = null;
  if (end == null) {
    let n = termAt(lease, reference);
    while (ownerDeadline(lease, n) < reference) n++;
    nextDeadline = ownerDeadline(lease, n);
    nextDeadlineTermEnd = termEnd(lease, n);
  }
  let noticeTooLateFor: string | null = null;
  if (ownerNoticeApplies(lease)) {
    const first = termAt(lease, lease.noticeDate!);
    if (ownerNoticeTerm(lease, lease.noticeDate!) > first) noticeTooLateFor = termEnd(lease, first);
  }
  return { lease, status, end, termEnd: termEnd(lease, termAt(lease, reference)), nextDeadline, nextDeadlineTermEnd, noticeTooLateFor, ...leaseRentAt(lease, rents, reference.slice(0, 7)) };
}

/** Le bail à mettre en avant : en cours, sinon le prochain à venir, sinon le dernier terminé. */
export function currentLease(states: readonly LeaseState[]): LeaseState | null {
  const byStart = [...states].sort((a, b) => a.lease.startDate.localeCompare(b.lease.startDate));
  return byStart.find((s) => s.status === "en_cours" || s.status === "conge") ?? byStart.find((s) => s.status === "a_venir") ?? byStart.at(-1) ?? null;
}

const frDate = (iso: string) => iso.split("-").reverse().join("/");

/** Contrôle partagé par le formulaire et le backend : message d'erreur, ou null si le bail est valide. */
export function validateLease(lease: LeaseDates & { id?: string }, others: readonly (LeaseDates & { id: string })[]): string | null {
  if ((lease.noticeBy == null) !== (lease.noticeDate == null)) return "Indiquez qui donne congé et à quelle date.";
  if (lease.noticeDate && lease.noticeDate < lease.startDate) return "Le congé ne peut pas précéder le début du bail.";
  if (lease.actualEnd && lease.actualEnd < lease.startDate) return "Le départ ne peut pas précéder le début du bail.";
  const end = leaseEnd(lease);
  for (const other of others) {
    if (other.id === lease.id) continue;
    const otherEnd = leaseEnd(other);
    const overlaps = (otherEnd == null || lease.startDate <= otherEnd) && (end == null || other.startDate <= end);
    if (overlaps) return `Ce bien a déjà un bail sur cette période (début le ${frDate(other.startDate)}). Indiquez d'abord le congé ou la fin de ce bail.`;
  }
  return null;
}

export const RENT_EXCEPTION_KINDS = ["impaye", "vide", "montant"] as const;
export type RentExceptionKind = (typeof RENT_EXCEPTION_KINDS)[number];
export const RENT_EXCEPTION_LABELS: Record<RentExceptionKind, string> = { impaye: "Impayé", vide: "Mois vide", montant: "Montant différent" };

/** Écart signalé sur un mois : sans signalement, le loyer prévu est réputé perçu. */
export interface RentException {
  id: string;
  leaseId: string;
  /** AAAA-MM */
  month: string;
  kind: RentExceptionKind;
  /** Loyer reçu hors charges (kind « montant »). */
  amount: number | null;
  comment: string;
}

export interface RentMonth {
  leaseId: string;
  month: string;
  /** Part du mois où le logement est occupé (0 à 1). */
  occupied: number;
  expectedRent: number;
  expectedCharges: number;
  receivedRent: number;
  receivedCharges: number;
  status: "paye" | RentExceptionKind;
  exception: RentException | null;
}

const nextMonthStart = (month: string) => addMonths(`${month}-01`, 1);
export const daysInMonth = (month: string) => daysBetween(`${month}-01`, nextMonthStart(month));

/** Mois du bail échus ou en cours à `asOf`, pour le bien entier ; le premier et le dernier sont au prorata des jours. */
export function rentMonths(lease: Lease, rents: readonly LeaseRent[], exceptions: readonly RentException[], asOf: string): RentMonth[] {
  if (asOf < lease.startDate) return [];
  const end = leaseEnd(lease);
  const lastMonth = end != null && end.slice(0, 7) < asOf.slice(0, 7) ? end.slice(0, 7) : asOf.slice(0, 7);
  const out: RentMonth[] = [];
  for (let month = lease.startDate.slice(0, 7); month <= lastMonth; month = nextMonthStart(month).slice(0, 7)) {
    const monthStart = `${month}-01`;
    const monthEnd = addDays(nextMonthStart(month), -1);
    const from = lease.startDate > monthStart ? lease.startDate : monthStart;
    const to = end != null && end < monthEnd ? end : monthEnd;
    const fraction = from > to ? 0 : (daysBetween(from, to) + 1) / daysInMonth(month);
    const { rent, charges } = leaseRentAt(lease, rents, month);
    const expectedRent = roundCents(rent * fraction);
    const expectedCharges = roundCents(charges * fraction);
    const exception = exceptions.find((e) => e.leaseId === lease.id && e.month === month) ?? null;
    const base = { leaseId: lease.id, month, exception };
    if (exception?.kind === "impaye") out.push({ ...base, occupied: fraction, expectedRent, expectedCharges, receivedRent: 0, receivedCharges: 0, status: "impaye" });
    else if (exception?.kind === "vide") out.push({ ...base, occupied: 0, expectedRent: 0, expectedCharges: 0, receivedRent: 0, receivedCharges: 0, status: "vide" });
    else if (exception?.kind === "montant") out.push({ ...base, occupied: fraction, expectedRent, expectedCharges, receivedRent: exception.amount ?? expectedRent, receivedCharges: expectedCharges, status: "montant" });
    else out.push({ ...base, occupied: fraction, expectedRent, expectedCharges, receivedRent: expectedRent, receivedCharges: expectedCharges, status: "paye" });
  }
  return out;
}
