import { addDays } from "../base";
import { leaseState, type Lease, type LeaseRent, type LeaseState } from "./leases";
import type { Lot } from "./lots";

/** Situation d'un lot à une date, d'après ses baux : loué, bientôt loué, ou vide depuis quand. */

export interface LotStatus {
  lot: Lot;
  /** Bail en cours (congé compris), sinon null. */
  current: LeaseState | null;
  /** Prochain bail, s'il n'a pas commencé. */
  upcoming: LeaseState | null;
  /** Lendemain de la fin du dernier bail, si le lot est vide ; null s'il n'a jamais été loué. */
  vacantSince: string | null;
}

/** Où en est un lot à `today` : loué, bientôt loué, ou vide depuis quand. */
export function lotStatus(lot: Lot, leases: readonly Lease[], rents: readonly LeaseRent[], today: string): LotStatus {
  const states = leases.filter((l) => l.lotId === lot.id).map((l) => leaseState(l, rents, today));
  const current = states.find((s) => s.status === "en_cours" || s.status === "conge") ?? null;
  const upcoming = [...states].filter((s) => s.status === "a_venir").sort((a, b) => a.lease.startDate.localeCompare(b.lease.startDate))[0] ?? null;
  const ends = states.filter((s) => s.status === "termine" && s.end != null).map((s) => s.end!);
  const lastEnd = ends.reduce<string | null>((max, e) => (max == null || e > max ? e : max), null);
  return { lot, current, upcoming, vacantSince: current == null && lastEnd != null ? addDays(lastEnd, 1) : null };
}
