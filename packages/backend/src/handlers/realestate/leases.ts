import { eq } from "drizzle-orm";
import { one } from "../../db/driver";
import { RenterInput, RpcError, type realestateProcedures } from "@hamac/api";
import type { output } from "zod";
import { dpeFreezesRent, leaseCanBeRevised, revisedRent, revisionStillPossible, revisionEffectiveDate, validateLease, defaultLotName, leaseKindsFor, lotIsActive, lotIsAnnex, RENTAL_MODE_LABELS, type RentalMode, type Lot, type EnergyLetter } from "@hamac/core";
import type { BackendContext } from "../../context";
import * as t from "../../db/schema";
import { mapLease, mapLeaseRent, mapLot, mapRenter } from "../../repo";
import { newId, nowIso, toCents } from "../../db/units";
import { OK, type DomainHandlers } from "../_types";

/** Lots, locataires, baux et loyers des baux (révisions comprises). */

export const leaseHandlers = {
  async "lots.upsert"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    const id = input.id ?? newId();
    if (input.id) {
      const before = await ctx.db.select().from(t.lots).where(eq(t.lots.id, id)).limit(1).then(one);
      if (!before || before.propertyId !== input.propertyId) throw new RpcError("NOT_FOUND", "Lot introuvable.");
      // Un lot déjà loué garde sa nature : ses baux en dépendent.
      if (before.kind !== input.kind && (await ctx.db.select({ id: t.leases.id }).from(t.leases).where(eq(t.leases.lotId, id)).limit(1)).length) {
        throw new RpcError("CONFLICT", "Ce lot a déjà des baux : sa nature ne peut plus changer. Archivez-le et créez-en un autre.");
      }
    }
    const row = { propertyId: input.propertyId, name: input.name, kind: input.kind, surface: input.surface, targetRentCents: input.targetRent == null ? null : toCents(input.targetRent), comment: input.comment, archived: input.archived, sortOrder: input.sortOrder, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.lots).set(row).where(eq(t.lots.id, id));
    else await ctx.db.insert(t.lots).values({ id, ...row });
    return mapLot((await ctx.db.select().from(t.lots).where(eq(t.lots.id, id)).limit(1).then(one))!);
  },

  async "lots.delete"({ id }, ctx) {
    if ((await ctx.db.select({ id: t.leases.id }).from(t.leases).where(eq(t.leases.lotId, id)).limit(1)).length) {
      throw new RpcError("CONFLICT", "Ce lot a des baux : archivez-le plutôt, pour garder leur historique.");
    }
    await ctx.db.delete(t.lots).where(eq(t.lots.id, id));
    return OK;
  },

  async "renters.upsert"(input, ctx) {
    return mapRenter(await saveRenter(ctx, input));
  },

  async "renters.delete"({ id }, ctx) {
    if ((await ctx.db.select({ id: t.leaseRenters.leaseId }).from(t.leaseRenters).where(eq(t.leaseRenters.renterId, id)).limit(1)).length) {
      throw new RpcError("CONFLICT", "Ce locataire figure sur un bail : retirez-le d'abord du bail.");
    }
    await ctx.db.delete(t.renters).where(eq(t.renters.id, id));
    return OK;
  },

  async "leases.upsert"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (property.kind !== "locatif") throw new RpcError("CONFLICT", "Seul un investissement locatif peut avoir un bail.");
    const mode = property.rentalMode as RentalMode;
    const before = input.id ? await ctx.db.select().from(t.leases).where(eq(t.leases.id, input.id)).limit(1).then(one) : undefined;
    if (input.id && (!before || before.propertyId !== input.propertyId)) throw new RpcError("NOT_FOUND", "Bail introuvable.");
    return ctx.raw.transaction(async () => {
      const lots = (await ctx.db.select().from(t.lots).where(eq(t.lots.propertyId, input.propertyId))).map(mapLot);
      const lotId = input.lotId ?? before?.lotId ?? (await defaultLot(ctx, property.id, mode, lots));
      const lot = lots.find((l) => l.id === lotId) ?? (await ctx.db.select().from(t.lots).where(eq(t.lots.id, lotId)).limit(1).then((r) => (r[0] ? mapLot(r[0]) : undefined)));
      if (!lot || lot.propertyId !== input.propertyId) throw new RpcError("NOT_FOUND", "Lot introuvable.");
      // Un bail existant garde son type même si le mode de location du bien a changé depuis.
      if ((!before || before.kind !== input.kind || before.lotId !== lotId) && !leaseKindsFor(mode, lot.kind).includes(input.kind)) {
        throw new RpcError("VALIDATION", `Ce type de bail ne correspond pas à ce lot en ${RENTAL_MODE_LABELS[mode].toLowerCase()}.`);
      }
      const others = (await ctx.db.select().from(t.leases).where(eq(t.leases.propertyId, input.propertyId))).map(mapLease);
      const allLots = lots.some((l) => l.id === lot.id) ? lots : [...lots, lot];
      const error = validateLease({ ...input, lotId }, others, allLots);
      if (error) throw new RpcError("VALIDATION", error);
      const id = input.id ?? newId();
      const row = {
        propertyId: input.propertyId,
        lotId,
        kind: input.kind,
        startDate: input.startDate,
        durationMonths: input.durationMonths,
        rentCents: toCents(input.rent),
        chargesCents: toCents(input.charges),
        depositCents: toCents(input.deposit),
        noticeBy: input.noticeBy,
        noticeDate: input.noticeDate,
        noticeMonths: input.noticeBy === "locataire" ? input.noticeMonths : null,
        actualEnd: input.actualEnd,
        comment: input.comment,
        reminders: input.reminders,
        depositReturnedCents: input.depositReturned == null ? null : toCents(input.depositReturned),
        depositReturnedOn: input.depositReturnedOn,
        depositReason: input.depositReturned == null ? "" : input.depositReason,
        landlord: input.landlord,
        tenantInsuranceUntil: input.tenantInsuranceUntil,
        revisable: input.revisable,
        irlQuarter: input.irlQuarter,
        landlordAddress: input.landlordAddress,
        dueDay: input.dueDay,
        updatedAt: nowIso(),
      };
      if (input.id) await ctx.db.update(t.leases).set(row).where(eq(t.leases.id, id));
      else await ctx.db.insert(t.leases).values({ id, ...row });

      // Locataires : repris par leur id, sinon créés ; l'ordre de la liste est celui des courriers.
      const renterIds: string[] = [];
      for (const r of input.renters) {
        const saved = await saveRenter(ctx, r);
        if (!renterIds.includes(saved.id)) renterIds.push(saved.id);
      }
      await ctx.db.delete(t.leaseRenters).where(eq(t.leaseRenters.leaseId, id));
      if (renterIds.length) await ctx.db.insert(t.leaseRenters).values(renterIds.map((renterId, sortOrder) => ({ leaseId: id, renterId, sortOrder })));

      // Garanties : la liste envoyée remplace celle du bail.
      const kept = input.guarantees.flatMap((g) => (g.id ? [g.id] : []));
      const existing = await ctx.db.select({ id: t.leaseGuarantees.id }).from(t.leaseGuarantees).where(eq(t.leaseGuarantees.leaseId, id));
      for (const g of existing.filter((x) => !kept.includes(x.id))) await ctx.db.delete(t.leaseGuarantees).where(eq(t.leaseGuarantees.id, g.id));
      const known = new Set(existing.map((x) => x.id));
      for (const [sortOrder, g] of input.guarantees.entries()) {
        const set = { kind: g.kind, name: g.name, contact: g.contact, amountCents: g.amount == null ? null : toCents(g.amount), until: g.until, comment: g.comment, sortOrder, updatedAt: nowIso() };
        if (g.id && known.has(g.id)) await ctx.db.update(t.leaseGuarantees).set(set).where(eq(t.leaseGuarantees.id, g.id));
        else await ctx.db.insert(t.leaseGuarantees).values({ id: newId(), leaseId: id, ...set });
      }
      return mapLease((await ctx.db.select().from(t.leases).where(eq(t.leases.id, id)).limit(1).then(one))!);
    });
  },

  async "leases.delete"({ id }, ctx) {
    await ctx.db.delete(t.leases).where(eq(t.leases.id, id));
    return OK;
  },

  async "leaseRents.upsert"(input, ctx) {
    const lease = await ctx.db.select().from(t.leases).where(eq(t.leases.id, input.leaseId)).limit(1).then(one);
    if (!lease) throw new RpcError("NOT_FOUND", "Bail introuvable.");
    const r = input.revision;
    if (r) {
      const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, lease.propertyId)).limit(1).then(one);
      if (!leaseCanBeRevised(mapLease(lease))) throw new RpcError("CONFLICT", "Ce bail ne prévoit pas de révision annuelle.");
      if (dpeFreezesRent((property?.dpe ?? null) as EnergyLetter | null)) throw new RpcError("CONFLICT", "Avec une note DPE F ou G, le loyer ne peut pas être révisé.");
      if (!revisionStillPossible(r.anniversary, r.demandDate)) throw new RpcError("VALIDATION", "Plus d'un an après l'anniversaire : la révision de cette année n'est plus possible.");
      if (input.rent > revisedRent(r.previousRent, r.indexOld, r.indexNew)) throw new RpcError("VALIDATION", "Le nouveau loyer dépasse la variation de l'indice.");
    }
    // Une révision prend effet à sa demande, jamais avant l'anniversaire.
    const fromMonth = r ? revisionEffectiveDate(r.anniversary, r.demandDate).slice(0, 7) : input.fromMonth;
    if (fromMonth <= lease.startDate.slice(0, 7)) throw new RpcError("VALIDATION", "Un nouveau loyer s'applique après le premier mois du bail. Pour corriger le loyer de départ, modifiez le bail.");
    const id = input.id ?? newId();
    const set = {
      fromMonth,
      rentCents: toCents(input.rent),
      chargesCents: toCents(input.charges),
      revisionAnniversary: r?.anniversary ?? null,
      revisionDemandDate: r?.demandDate ?? null,
      revisionPreviousRentCents: r ? toCents(r.previousRent) : null,
      revisionQuarterNew: r?.quarterNew ?? null,
      revisionQuarterOld: r?.quarterOld ?? null,
      revisionIndexNew: r?.indexNew ?? null,
      revisionIndexOld: r?.indexOld ?? null,
      updatedAt: nowIso(),
    };
    const saved = await ctx.db
      .insert(t.leaseRents)
      .values({ id, leaseId: input.leaseId, ...set })
      .onConflictDoUpdate({ target: [t.leaseRents.leaseId, t.leaseRents.fromMonth], set })
      .returning();
    return mapLeaseRent(saved[0]);
  },

  async "leaseRents.delete"({ id }, ctx) {
    await ctx.db.delete(t.leaseRents).where(eq(t.leaseRents.id, id));
    return OK;
  },
} satisfies Partial<DomainHandlers<typeof realestateProcedures>>;

/** Crée ou met à jour un locataire ; un id inconnu est refusé. */
async function saveRenter(ctx: BackendContext, r: output<typeof RenterInput>) {
  const row = { firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, forwardingAddress: r.forwardingAddress, comment: r.comment, updatedAt: nowIso() };
  if (r.id) {
    const saved = await ctx.db.update(t.renters).set(row).where(eq(t.renters.id, r.id)).returning();
    if (!saved[0]) throw new RpcError("NOT_FOUND", "Locataire introuvable.");
    return saved[0];
  }
  return (await ctx.db.insert(t.renters).values({ id: newId(), ...row }).returning())[0];
}

/** Lot d'un nouveau bail quand aucun n'est choisi : le seul logement ou la seule chambre proposés, sinon un logement créé pour l'occasion. */
async function defaultLot(ctx: BackendContext, propertyId: string, mode: RentalMode, lots: readonly Lot[]): Promise<string> {
  const candidates = lots.filter((l) => lotIsActive(l, mode) && !lotIsAnnex(l.kind));
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length > 1) throw new RpcError("VALIDATION", "Choisissez le lot loué.");
  if (mode === "chambres") throw new RpcError("VALIDATION", "Ajoutez d'abord les chambres du bien, puis choisissez celle qui est louée.");
  const id = newId();
  await ctx.db.insert(t.lots).values({ id, propertyId, name: defaultLotName("logement", lots), kind: "logement" });
  return id;
}
