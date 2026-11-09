import { addMonths } from "./dates";
import { dpeFreezesRent, type EnergyLetter } from "./energy";
import { leaseRentAt, type Lease, type LeaseRent } from "./leases";
import { roundCents } from "./money";
import { daysBetween } from "./xirr";

/**
 * Révision annuelle du loyer d'après l'indice de référence des loyers (IRL) publié par l'INSEE.
 * Sources : loi n° 89-462 du 6 juillet 1989, art. 17-1 (I et III), 25-9 (meublé) et 25-16 (bail mobilité), consultés sur legifrance.gouv.fr ;
 * formule et arrondi : service-public.gouv.fr, fiche F13723, consultés le 09/11/2026.
 */

export const IRL_ZONES = ["metropole", "corse", "outremer"] as const;
export type IrlZone = (typeof IRL_ZONES)[number];
export const IRL_ZONE_LABELS: Record<IrlZone, string> = { metropole: "France métropolitaine", corse: "Corse", outremer: "Outre-mer" };

export interface IrlPoint {
  /** AAAA-Qn */
  quarter: string;
  value: number;
  /** Date de publication au Journal officiel. */
  published: string | null;
}

export interface IrlData {
  series: Record<IrlZone, readonly IrlPoint[]>;
  checkedAt: string | null;
}

export const NO_IRL_DATA: IrlData = { series: { metropole: [], corse: [], outremer: [] }, checkedAt: null };

const OVERSEAS_POSTAL_PREFIXES = ["971", "972", "973", "974", "976"];

/** Zone de l'indice ; sans code postal : métropole. */
export function irlZone(postalCode: string): IrlZone {
  if (postalCode.startsWith("20")) return "corse";
  return OVERSEAS_POSTAL_PREFIXES.some((p) => postalCode.startsWith(p)) ? "outremer" : "metropole";
}

export function irlQuarterLabel(quarter: string): string {
  const n = Number(quarter.slice(-1));
  return `${n === 1 ? "1er" : `${n}e`} trimestre ${quarter.slice(0, 4)}`;
}

const quarterNumber = (p: IrlPoint) => Number(p.quarter.slice(-1));
const quarterYear = (p: IrlPoint) => Number(p.quarter.slice(0, 4));

/** Date à laquelle un indice est paru au plus tard, d'après le calendrier de l'INSEE (vers le 15 du mois). */
function expectedPublication(quarter: number, year: number): string {
  return quarter === 4 ? `${year + 1}-01-20` : `${year}-${String(quarter * 3 + 1).padStart(2, "0")}-20`;
}

/** Trimestre de référence : celui du bail, sinon celui du dernier indice publié à sa date (art. 17-1). */
export function leaseIrlQuarter(lease: Pick<Lease, "irlQuarter" | "startDate">, points: readonly IrlPoint[]): number {
  if (lease.irlQuarter != null) return lease.irlQuarter;
  const known = points.filter((p) => p.published != null && p.published <= lease.startDate).sort((a, b) => a.quarter.localeCompare(b.quarter)).at(-1);
  if (known) return quarterNumber(known);
  const year = Number(lease.startDate.slice(0, 4));
  const candidates = [[4, year - 1], [1, year], [2, year], [3, year]].filter(([q, y]) => expectedPublication(q, y) <= lease.startDate);
  return candidates.at(-1)?.[0] ?? 3;
}

/** Délai avant l'anniversaire à partir duquel la révision peut être préparée. */
const REVISION_LEAD_DAYS = 45;

/** Le bail prévoit une révision : vide ou meublé, jamais un bail mobilité ni un bail étudiant de neuf mois. */
export const leaseCanBeRevised = (lease: Pick<Lease, "kind" | "revisable">) => lease.revisable && (lease.kind === "vide" || lease.kind === "meuble");

/** Anniversaire dont la révision reste à faire ; null si aucun, si elle est faite, ou si l'année pour la demander est écoulée. */
export function pendingRevisionAnniversary(lease: Pick<Lease, "id" | "kind" | "startDate" | "revisable">, rents: readonly LeaseRent[], today: string): string | null {
  if (!leaseCanBeRevised(lease)) return null;
  let last: string | null = null;
  for (let n = 1; ; n++) {
    const anniversary = addMonths(lease.startDate, 12 * n);
    if (daysBetween(today, anniversary) > REVISION_LEAD_DAYS) break;
    last = anniversary;
  }
  if (last == null || daysBetween(last, today) > 365) return null;
  const limit = addMonths(last, -2).slice(0, 7);
  return rents.some((r) => r.leaseId === lease.id && r.fromMonth >= limit) ? null : last;
}

/** La révision prend effet à sa demande, jamais avant l'anniversaire (art. 17-1). */
export const revisionEffectiveDate = (anniversary: string, demandDate: string) => (demandDate > anniversary ? demandDate : anniversary);

/** Le propriétaire a un an après l'anniversaire pour la demander (art. 17-1). */
export const revisionStillPossible = (anniversary: string, demandDate: string) => demandDate <= addMonths(anniversary, 12);

/** Loyer révisé, arrondi au centime : loyer × nouvel indice / indice de l'année précédente. */
export const revisedRent = (rent: number, indexOld: number, indexNew: number) => roundCents((rent * indexNew) / indexOld);

export interface RevisionProposal {
  anniversary: string;
  zone: IrlZone;
  previousRent: number;
  charges: number;
  quarterNew: string;
  quarterOld: string;
  /** null tant que l'indice n'est pas connu : il reste à saisir. */
  indexNew: number | null;
  indexOld: number | null;
  newRent: number | null;
}

/** Révision à proposer ; null s'il n'y en a pas à faire ou si la note DPE l'interdit. */
export function proposeRevision(lease: Lease, rents: readonly LeaseRent[], data: IrlData, property: { postalCode: string; dpe: EnergyLetter | null }, today: string): RevisionProposal | null {
  const anniversary = pendingRevisionAnniversary(lease, rents, today);
  if (anniversary == null || dpeFreezesRent(property.dpe)) return null;
  const zone = irlZone(property.postalCode);
  const points = data.series[zone];
  const quarter = leaseIrlQuarter(lease, points);
  const published = points.filter((p) => quarterNumber(p) === quarter && p.published != null && p.published <= anniversary);
  let year = Number(anniversary.slice(0, 4));
  while (expectedPublication(quarter, year) > anniversary) year--;
  year = Math.max(year, ...published.map(quarterYear));
  const quarterNew = `${year}-Q${quarter}`;
  const quarterOld = `${year - 1}-Q${quarter}`;
  const value = (q: string) => points.find((p) => p.quarter === q)?.value ?? null;
  const indexNew = value(quarterNew);
  const indexOld = value(quarterOld);
  const { rent, charges } = leaseRentAt(lease, rents, anniversary.slice(0, 7));
  return { anniversary, zone, previousRent: rent, charges, quarterNew, quarterOld, indexNew, indexOld, newRent: indexNew != null && indexOld != null ? revisedRent(rent, indexOld, indexNew) : null };
}
