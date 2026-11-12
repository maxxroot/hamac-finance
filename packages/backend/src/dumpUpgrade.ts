import { randomUUID } from "node:crypto";
import { rentalModeFromLeases, type LeaseKind } from "@hamac/core";
import type { SqlValue } from "./db/driver";

type Row = Record<string, SqlValue>;
type Tables = Record<string, Row[]>;

const str = (v: SqlValue | undefined) => (typeof v === "string" ? v.trim() : "");

/**
 * Sauvegarde d'avant les lots (migration 0022) : ses baux n'ont pas de lot, et le locataire et le garant sont du texte.
 * Fait la même reprise que la migration : un lot « Logement » par bien loué, le mode de location du dernier bail,
 * un locataire par nom distinct et une caution par garant. Modifie `tables` en place.
 */
export function upgradeLegacyDump(tables: Tables): void {
  const leases = Array.isArray(tables.leases) ? tables.leases : [];
  if (!leases.some((l) => l.lot_id == null)) return;
  const properties = Array.isArray(tables.properties) ? tables.properties : [];
  const lots = (tables.lots = Array.isArray(tables.lots) ? tables.lots : []);
  const renters = (tables.renters = Array.isArray(tables.renters) ? tables.renters : []);
  const links = (tables.lease_renters = Array.isArray(tables.lease_renters) ? tables.lease_renters : []);
  const guarantees = (tables.lease_guarantees = Array.isArray(tables.lease_guarantees) ? tables.lease_guarantees : []);

  const lotOf = new Map<string, string>();
  for (const p of properties) {
    const id = String(p.id);
    const own = leases.filter((l) => l.property_id === id);
    if (p.kind !== "locatif" && own.length === 0) continue;
    if (p.rental_mode == null) p.rental_mode = rentalModeFromLeases(own.map((l) => ({ kind: String(l.kind) as LeaseKind, startDate: String(l.start_date) })));
    const lotId = randomUUID();
    lots.push({ id: lotId, property_id: id, name: "Logement", kind: "logement" });
    lotOf.set(id, lotId);
  }

  const renterOf = new Map<string, string>();
  for (const l of leases) {
    if (l.lot_id == null) l.lot_id = lotOf.get(String(l.property_id)) ?? null;
    const tenant = str(l.tenant);
    if (tenant) {
      const key = tenant.toLowerCase();
      let renterId = renterOf.get(key);
      if (!renterId) {
        renterId = randomUUID();
        renterOf.set(key, renterId);
        renters.push({ id: renterId, last_name: tenant });
      }
      links.push({ lease_id: l.id, renter_id: renterId, sort_order: 0 });
    }
    const guarantor = str(l.guarantor);
    if (guarantor) guarantees.push({ id: randomUUID(), lease_id: l.id, kind: "caution", name: guarantor });
  }
}
