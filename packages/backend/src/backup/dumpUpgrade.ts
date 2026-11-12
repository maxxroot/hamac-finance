import { randomUUID } from "node:crypto";
import { rentalModeFromLeases, type LeaseKind } from "@hamac/core";
import type { SqlValue } from "../db/driver";

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

const num = (v: SqlValue | undefined) => (typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : typeof v === "string" && v.trim() !== "" ? Number(v) : 0);

/**
 * Sauvegarde d'avant le suivi strict des loyers (migration 0025) : mêmes reprises que la migration.
 * « Montant différent » devient un paiement de ce montant plus les charges du mois ; « mois vide » devient une remise ;
 * « impayé » ne crée rien, et le mois reste dû. Modifie `tables` en place.
 */
export function upgradeLegacyRentExceptions(tables: Tables): void {
  const exceptions = Array.isArray(tables.rent_exceptions) ? tables.rent_exceptions : [];
  delete tables.rent_exceptions;
  if (!exceptions.length) return;
  const leases = new Map((Array.isArray(tables.leases) ? tables.leases : []).map((l) => [String(l.id), l]));
  const rents = Array.isArray(tables.lease_rents) ? tables.lease_rents : [];
  const payments = (tables.rent_payments = Array.isArray(tables.rent_payments) ? tables.rent_payments : []);
  const waivers = (tables.rent_waivers = Array.isArray(tables.rent_waivers) ? tables.rent_waivers : []);
  for (const e of exceptions) {
    const leaseId = String(e.lease_id);
    const month = String(e.month);
    if (e.kind === "montant" && e.amount_cents != null) {
      const revision = rents.filter((r) => r.lease_id === leaseId && String(r.from_month) <= month).sort((a, b) => String(b.from_month).localeCompare(String(a.from_month)))[0];
      const charges = revision ? num(revision.charges_cents) : num(leases.get(leaseId)?.charges_cents);
      payments.push({ id: randomUUID(), lease_id: leaseId, month, date: `${month}-01`, amount_cents: num(e.amount_cents) + charges, method: "autre", comment: "Repris du montant signalé avant le suivi des paiements" });
    } else if (e.kind === "vide") waivers.push({ id: randomUUID(), lease_id: leaseId, month, comment: str(e.comment) || "Ancien « mois vide »" });
  }
}

/**
 * Sauvegarde d'avant les fonds euros comme supports (migration 0028) : mêmes reprises que la migration.
 * Chaque contrat d'assurance-vie ou de PER reçoit son fonds euros comme support par défaut, et ses taux
 * servis y sont rattachés. Modifie `tables` en place.
 */
export function upgradeLegacyEuroFunds(tables: Tables): void {
  const accounts = Array.isArray(tables.accounts) ? tables.accounts : [];
  if (accounts.length === 0 || accounts.some((a) => "default_asset_id" in a)) return;
  const assets = (tables.assets = Array.isArray(tables.assets) ? tables.assets : []);
  const contracts = new Set<string>();
  for (const a of accounts) {
    a.default_asset_id = null;
    if (a.kind !== "assurance_vie" && a.kind !== "per") continue;
    const id = String(a.id);
    contracts.add(id);
    assets.push({ id: `fe-${id}`, kind: "fonds_euros", name: `Fonds euros (${str(a.name)})`, price_source: "modele" });
    a.default_asset_id = `fe-${id}`;
  }
  const rates = Array.isArray(tables.fund_rates) ? tables.fund_rates : [];
  tables.fund_rates = rates.filter((r) => contracts.has(String(r.account_id))).map((r) => ({ ...r, asset_id: `fe-${String(r.account_id)}` }));
}
