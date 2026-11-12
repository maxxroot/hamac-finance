/**
 * Locataires et garanties d'un bail.
 * On ne garde que ce qui sert à la gestion : pas de date de naissance ni de pièce d'identité.
 * Garanties : caution d'une personne (loi n° 89-462 du 6 juillet 1989, art. 22-1), garantie Visale d'Action Logement,
 * assurance loyers impayés souscrite par le propriétaire, caution bancaire ; consulté sur service-public.gouv.fr le 12/11/2026.
 */

export interface Renter {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Adresse après le départ, pour rendre le dépôt de garantie ou envoyer un décompte. */
  forwardingAddress: string;
  comment: string;
}

/** Lien entre un bail et un de ses locataires ; l'ordre suit la saisie. */
export interface LeaseRenter {
  leaseId: string;
  renterId: string;
  sortOrder: number;
}

export const LEASE_GUARANTEE_KINDS = ["caution", "visale", "gli", "bancaire", "autre"] as const;
export type LeaseGuaranteeKind = (typeof LEASE_GUARANTEE_KINDS)[number];
export const LEASE_GUARANTEE_LABELS: Record<LeaseGuaranteeKind, string> = {
  caution: "Caution d'une personne",
  visale: "Garantie Visale",
  gli: "Assurance loyers impayés",
  bancaire: "Caution bancaire",
  autre: "Autre garantie",
};

export interface LeaseGuarantee {
  id: string;
  leaseId: string;
  kind: LeaseGuaranteeKind;
  /** Nom de la personne qui se porte caution, de l'assureur ou de la banque. */
  name: string;
  /** Téléphone, e-mail ou adresse, en texte libre. */
  contact: string;
  /** Montant maximal garanti, s'il est fixé. */
  amount: number | null;
  /** Fin de l'engagement, si elle est fixée. */
  until: string | null;
  comment: string;
  sortOrder: number;
}

export const renterName = (r: Pick<Renter, "firstName" | "lastName">) => [r.firstName.trim(), r.lastName.trim()].filter(Boolean).join(" ");

/** « Alice », « Alice et Bruno », « Alice, Bruno et Chloé ». */
export function joinNames(names: readonly string[]): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} et ${list.at(-1)}`;
}

/** Locataires d'un bail, dans l'ordre de saisie. */
export function leaseRenters<R extends Pick<Renter, "id">>(leaseId: string, links: readonly LeaseRenter[], renters: readonly R[]): R[] {
  const byId = new Map(renters.map((r) => [r.id, r]));
  return links
    .filter((l) => l.leaseId === leaseId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => byId.get(l.renterId))
    .filter((r): r is R => r != null);
}

/** Noms des locataires d'un bail, pour l'affichage et les courriers ; chaîne vide s'il n'y en a pas. */
export const leaseRenterNames = (leaseId: string, links: readonly LeaseRenter[], renters: readonly Renter[]) => joinNames(leaseRenters(leaseId, links, renters).map(renterName));
