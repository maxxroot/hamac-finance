import { leaseRenterNames, type Lease, type Property } from "@hamac/core";
import type { Workspace } from "@hamac/api";

/** Adresse du logement pour les courriers : l'adresse saisie, sinon le nom du bien, avec le lot s'il y en a plusieurs. */
export function leasePlace(property: Property, lease: Lease, ws: Pick<Workspace, "lots">): string {
  const address = [property.address, [property.postalCode, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || property.name;
  const lots = ws.lots.filter((l) => l.propertyId === property.id);
  const lot = lots.length > 1 ? lots.find((l) => l.id === lease.lotId) : undefined;
  return lot ? `${address} (${lot.name.toLowerCase()})` : address;
}

/** Destinataires d'un courrier : les locataires du bail, sinon « le locataire ». */
export const leaseAddressee = (lease: Lease, ws: Pick<Workspace, "leaseRenters" | "renters">, fallback = "Le locataire") => leaseRenterNames(lease.id, ws.leaseRenters, ws.renters) || fallback;
