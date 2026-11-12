import { addDays, addMonths, daysBetween, isIsoDate, roundCents } from "../base";
import { lotIsAnnex, type Lot, type LotKind, type RentalMode } from "./lots";
import type { PropertyOwnership } from "./realestate";

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
  /** Lot loué : le logement entier, une chambre, un parking… */
  lotId: string;
  kind: LeaseKind;
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
  /** Rappeler les échéances de ce bail dans les alertes. */
  reminders: boolean;
  /** Dépôt rendu au locataire à sa sortie, sa date et le motif d'une retenue ; null tant qu'il n'est pas rendu. */
  depositReturned: number | null;
  depositReturnedOn: string | null;
  depositReason: string;
  /** Nom du propriétaire, pour les quittances. */
  landlord: string;
  /** Fin de validité de l'attestation d'assurance du locataire. */
  tenantInsuranceUntil: string | null;
  /** Le bail contient une clause de révision annuelle. */
  revisable: boolean;
  /** Trimestre de référence de l'indice (1 à 4) ; null = celui du dernier indice publié à la date du bail. */
  irlQuarter: number | null;
  landlordAddress: string;
  /** Jour du mois où le loyer est dû (1 à 31, ramené au dernier jour des mois plus courts). */
  dueDay: number;
}

/** Nouveau loyer (révision annuelle…), en vigueur à partir d'un mois. */
export interface LeaseRent {
  id: string;
  leaseId: string;
  /** AAAA-MM */
  fromMonth: string;
  rent: number;
  charges: number;
  /** Détail de la révision annuelle qui a donné ce loyer ; absent pour un loyer saisi à la main. */
  revision?: LeaseRevision | null;
}

export interface LeaseRevision {
  anniversary: string;
  demandDate: string;
  previousRent: number;
  /** AAAA-Qn */
  quarterNew: string;
  quarterOld: string;
  indexNew: number;
  indexOld: number;
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

/** Loyer hors charges du mois en cours, tous lots du bien confondus : la somme des baux en cours. */
export function monthlyRentNow(leases: readonly Lease[], rents: readonly LeaseRent[], today: string): number | null {
  const running = leases.map((l) => leaseState(l, rents, today)).filter((s) => s.status === "en_cours" || s.status === "conge");
  return running.length ? roundCents(running.reduce((sum, s) => sum + s.rent, 0)) : null;
}

const frDate = (iso: string) => iso.split("-").reverse().join("/");

type LotRef = { lotId?: string | null };

/**
 * Deux baux du même bien se gênent s'ils portent sur le même lot, ou si l'un loue le logement entier et l'autre une chambre.
 * Sans lot connu (anciennes données, tests), tous les baux du bien portent sur le même logement.
 */
function leasesClash(a: LotRef, b: LotRef, lots: readonly Pick<Lot, "id" | "kind">[]): boolean {
  if (a.lotId == null || b.lotId == null || a.lotId === b.lotId) return true;
  const kinds = new Set([lots.find((l) => l.id === a.lotId)?.kind, lots.find((l) => l.id === b.lotId)?.kind]);
  return kinds.has("logement") && kinds.has("chambre");
}

/**
 * Contrôle partagé par le formulaire et le backend : message d'erreur, ou null si le bail est valide.
 * `others` : les autres baux du bien ; `lots` : ses lots.
 */
export function validateLease(lease: LeaseDates & LotRef & { id?: string }, others: readonly (LeaseDates & LotRef & { id: string })[], lots: readonly Pick<Lot, "id" | "kind">[] = []): string | null {
  // Pendant la saisie : une date vide ou incomplète, ou une durée nulle, ne permettent aucun calcul d'échéance.
  if (!isIsoDate(lease.startDate)) return "Indiquez la date de début du bail.";
  if (lease.durationMonths < 1) return "Indiquez la durée du bail.";
  if ((lease.noticeBy == null) !== (lease.noticeDate == null)) return "Indiquez qui donne congé et à quelle date.";
  if (lease.noticeDate && lease.noticeDate < lease.startDate) return "Le congé ne peut pas précéder le début du bail.";
  if (lease.actualEnd && lease.actualEnd < lease.startDate) return "Le départ ne peut pas précéder le début du bail.";
  const end = leaseEnd(lease);
  for (const other of others) {
    if (other.id === lease.id || !leasesClash(lease, other, lots)) continue;
    const otherEnd = leaseEnd(other);
    const overlaps = (otherEnd == null || lease.startDate <= otherEnd) && (end == null || other.startDate <= end);
    if (!overlaps) continue;
    const sameLot = lease.lotId == null || other.lotId == null || lease.lotId === other.lotId;
    return sameLot
      ? `Ce logement a déjà un bail sur cette période (début le ${frDate(other.startDate)}). Indiquez d'abord le congé ou la fin de ce bail.`
      : `Le logement entier et une chambre ne peuvent pas être loués en même temps (bail du ${frDate(other.startDate)}). Indiquez d'abord le congé ou la fin de ce bail.`;
  }
  return null;
}

/** Jours après l'échéance avant qu'un loyer non pointé soit signalé : sans rapprochement bancaire, le temps de le voir arriver. */
export const RENT_GRACE_DAYS = 10;

export const PAYMENT_METHODS = ["virement", "prelevement", "cheque", "especes", "caf", "garant", "autre"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  virement: "Virement",
  prelevement: "Prélèvement",
  cheque: "Chèque",
  especes: "Espèces",
  caf: "Aide au logement (CAF)",
  garant: "Garant",
  autre: "Autre",
};

/** Somme reçue pour le loyer et les charges d'un mois ; un mois peut en recevoir plusieurs. */
export interface RentPayment {
  id: string;
  leaseId: string;
  /** Mois concerné, AAAA-MM. */
  month: string;
  /** Date de réception. */
  date: string;
  amount: number;
  method: PaymentMethod;
  comment: string;
}

/** Mois remis au locataire (mois offert, franchise après travaux) : rien n'est dû. */
export interface RentWaiver {
  id: string;
  leaseId: string;
  month: string;
  comment: string;
}

/** Ce qui a été pointé : paiements reçus et mois remis. */
export interface RentLedger {
  payments: readonly RentPayment[];
  waivers: readonly RentWaiver[];
}
export const NO_RENT_LEDGER: RentLedger = { payments: [], waivers: [] };
/** Registre des loyers à partir des données chargées. */
export const rentLedgerOf = (d: { rentPayments?: readonly RentPayment[]; rentWaivers?: readonly RentWaiver[] }): RentLedger => ({ payments: d.rentPayments ?? [], waivers: d.rentWaivers ?? [] });

export const RENT_STATUSES = ["a_venir", "attendu", "recu", "partiel", "non_recu", "remis"] as const;
export type RentStatus = (typeof RENT_STATUSES)[number];
export const RENT_STATUS_LABELS: Record<RentStatus, string> = {
  a_venir: "À venir",
  attendu: "Attendu",
  recu: "Reçu",
  partiel: "Reçu en partie",
  non_recu: "Non reçu",
  remis: "Remis",
};

export interface RentMonth {
  leaseId: string;
  month: string;
  /** Part du mois où le logement est occupé (0 à 1). */
  occupied: number;
  /** Loyer et charges prévus par le bail pour ce mois, au prorata des jours. */
  expectedRent: number;
  expectedCharges: number;
  /** Ce que le locataire doit pour ce mois : rien si le mois est remis. */
  due: number;
  /** Total pointé pour ce mois, trop-perçu compris. */
  paid: number;
  /** Part de ce qui est dû qui a été reçue, répartie entre loyer et charges au prorata. */
  receivedRent: number;
  receivedCharges: number;
  /** Reste dû ; 0 une fois tout reçu. */
  outstanding: number;
  /** Date à laquelle le loyer est dû. */
  dueDate: string;
  status: RentStatus;
  payments: RentPayment[];
  waiver: RentWaiver | null;
}

const nextMonthStart = (month: string) => addMonths(`${month}-01`, 1);
export const daysInMonth = (month: string) => daysBetween(`${month}-01`, nextMonthStart(month));

/** Date d'échéance d'un mois : le jour prévu au bail, au plus le dernier jour du mois. */
export const rentDueDate = (month: string, dueDay: number) => `${month}-${String(Math.min(Math.max(1, dueDay), daysInMonth(month))).padStart(2, "0")}`;

/** Le loyer est-il dû et non réglé, passé le délai de tolérance ? */
export const rentIsLate = (m: Pick<RentMonth, "status">) => m.status === "non_recu" || m.status === "partiel";

/**
 * Mois du bail échus ou en cours à `asOf`, pour le bien entier ; le premier et le dernier sont au prorata des jours.
 * Suivi strict : un loyer n'est reçu que s'il a été pointé.
 */
export function rentMonths(lease: Lease, rents: readonly LeaseRent[], ledger: RentLedger, asOf: string): RentMonth[] {
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
    const waiver = ledger.waivers.find((w) => w.leaseId === lease.id && w.month === month) ?? null;
    const payments = ledger.payments.filter((p) => p.leaseId === lease.id && p.month === month).sort((a, b) => a.date.localeCompare(b.date));
    const paid = roundCents(payments.reduce((s, p) => s + p.amount, 0));
    const due = waiver ? 0 : roundCents(expectedRent + expectedCharges);
    const share = Math.min(paid, due);
    const receivedRent = due > 0 ? roundCents((share * expectedRent) / due) : 0;
    const dueDate = rentDueDate(month, lease.dueDay);
    const outstanding = roundCents(Math.max(0, due - paid));
    const status: RentStatus = waiver ? "remis" : outstanding === 0 ? "recu" : dueDate > asOf ? "a_venir" : daysBetween(dueDate, asOf) <= RENT_GRACE_DAYS ? "attendu" : paid > 0 ? "partiel" : "non_recu";
    out.push({ leaseId: lease.id, month, occupied: fraction, expectedRent, expectedCharges, due, paid, receivedRent, receivedCharges: roundCents(share - receivedRent), outstanding, dueDate, status, payments, waiver });
  }
  return out;
}

/**
 * Paiement qui solde un mois : le reste dû, daté de l'échéance si elle est passée (rattrapage d'un mois déjà arrivé),
 * sinon d'aujourd'hui. null s'il ne reste rien à recevoir.
 */
export function settlingPayment(m: RentMonth, today: string, method: PaymentMethod = "virement"): Omit<RentPayment, "id"> | null {
  if (m.outstanding <= 0) return null;
  return { leaseId: m.leaseId, month: m.month, date: m.dueDate < today ? m.dueDate : today, amount: m.outstanding, method, comment: "" };
}

/** Solde du locataire à `asOf` : ce qui est dû sur les mois échus, moins tout ce qui a été reçu. Négatif : il a payé d'avance. */
export function leaseBalance(lease: Lease, rents: readonly LeaseRent[], ledger: RentLedger, asOf: string): number {
  const months = rentMonths(lease, rents, ledger, asOf).filter((m) => m.dueDate <= asOf);
  const paid = ledger.payments.filter((p) => p.leaseId === lease.id && p.date <= asOf).reduce((s, p) => s + p.amount, 0);
  return roundCents(months.reduce((s, m) => s + m.due, 0) - paid);
}

/** Somme gardée sur le dépôt à la sortie : elle compte comme une recette. */
export const depositRetained = (lease: Pick<Lease, "deposit" | "depositReturned">) => (lease.depositReturned == null ? 0 : roundCents(Math.max(0, lease.deposit - lease.depositReturned)));

/** Fenêtre autour de la date anniversaire où rappeler la révision du loyer. */
const RENT_REVISION_ALERT_DAYS = 30;

/** Date anniversaire du bail si une révision de loyer est à faire autour de `today` ; null s'il n'y en a pas, ou si le loyer vient de changer. */
export function leaseRevisionDue(lease: Pick<Lease, "id" | "kind" | "startDate" | "revisable">, rents: readonly LeaseRent[], today: string): string | null {
  if (!lease.revisable || (lease.kind !== "vide" && lease.kind !== "meuble")) return null;
  for (let n = 1; ; n++) {
    const anniversary = addMonths(lease.startDate, 12 * n);
    const days = daysBetween(today, anniversary);
    if (days > RENT_REVISION_ALERT_DAYS) return null;
    if (days >= -RENT_REVISION_ALERT_DAYS) {
      const revised = rents.some((r) => r.leaseId === lease.id && r.fromMonth >= addMonths(anniversary, -2).slice(0, 7));
      return revised ? null : anniversary;
    }
  }
}

/**
 * Quittance d'un mois : le détail distingue loyer et charges ; un paiement partiel donne droit à un reçu (art. 21 de la loi du 6 juillet 1989).
 * null si rien n'a été reçu.
 */
export function rentReceipt(m: RentMonth): { kind: "quittance" | "recu"; rent: number; charges: number; total: number } | null {
  const total = roundCents(m.receivedRent + m.receivedCharges);
  if (total <= 0) return null;
  return { kind: m.outstanding > 0 ? "recu" : "quittance", rent: m.receivedRent, charges: m.receivedCharges, total };
}

// ——— Baux possibles selon le mode de location et le lot ———

/** Types de bail possibles pour un lot, selon le mode de location du bien. */
export function leaseKindsFor(mode: RentalMode, lotKind: LotKind): LeaseKind[] {
  if (lotIsAnnex(lotKind)) return ["autre"];
  switch (mode) {
    case "vide":
      return ["vide", "autre"];
    case "meuble":
      return ["meuble", "etudiant", "mobilite", "autre"];
    default:
      return ["vide", "meuble", "etudiant", "mobilite", "autre"];
  }
}

/** Mode de location déduit des baux d'un bien, pour les données d'avant les lots : celui du bail le plus récent. */
export function rentalModeFromLeases(leases: readonly { kind: LeaseKind; startDate: string }[]): RentalMode {
  const last = [...leases].sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1);
  return last == null || last.kind === "vide" || last.kind === "autre" ? "vide" : "meuble";
}
