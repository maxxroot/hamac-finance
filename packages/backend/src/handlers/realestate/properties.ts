import { and, eq } from "drizzle-orm";
import { one } from "../../db/driver";
import { RpcError, type realestateProcedures } from "@hamac/api";
import type { BackendContext } from "../../context";
import * as t from "../../db/schema";
import { RECOVERABLE_CATEGORIES, defaultRecoverableRate } from "@hamac/core";
import { loadParams, mapPropertyReminder, mapCompany, mapProperty, mapPropertyDocument, mapPropertyExpense, mapPropertyIncome } from "../../repo";
import { newId, nowIso, toCents } from "../../db/units";
import { OK, type DomainHandlers } from "../_types";

/** Biens, sociétés, estimations, charges, revenus, documents et rappels. */

export const propertyHandlers = {
  async "companies.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { name: input.name, share: input.share, comment: input.comment, archived: input.archived, updatedAt: nowIso() };
    if (input.id) {
      const res = await ctx.db.update(t.companies).set(row).where(eq(t.companies.id, id)).returning({ id: t.companies.id });
      if (!res.length) throw new RpcError("NOT_FOUND", "Société introuvable.");
    } else await ctx.db.insert(t.companies).values({ id, ...row });
    return mapCompany((await ctx.db.select().from(t.companies).where(eq(t.companies.id, id)).limit(1).then(one))!);
  },

  async "companies.delete"({ id }, ctx) {
    // Les biens de la société restent, détenus pour la part saisie sur chacun.
    await ctx.db.delete(t.companies).where(eq(t.companies.id, id));
    return OK;
  },

  async "properties.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const viaCompany = input.ownership === "sci" || input.ownership === "sci_familiale";
    if (viaCompany && input.companyId && !(await ctx.db.select().from(t.companies).where(eq(t.companies.id, input.companyId)).limit(1).then(one))) {
      throw new RpcError("NOT_FOUND", "Société introuvable.");
    }
    const pleine = input.dismemberment === "pleine";
    const row = {
      kind: input.kind,
      ownership: input.ownership,
      name: input.name,
      valueCents: toCents(input.value),
      valueDate: input.valueDate,
      purchasePriceCents: input.purchasePrice == null ? null : toCents(input.purchasePrice),
      purchaseDate: input.purchaseDate,
      newBuild: input.newBuild,
      notaryFeesCents: toCents(input.notaryFees),
      agencyFeesCents: toCents(input.agencyFees),
      initialWorksCents: toCents(input.initialWorks),
      otherFeesCents: toCents(input.otherFees),
      propertyType: input.propertyType,
      address: input.address,
      postalCode: input.postalCode,
      city: input.city,
      surface: input.surface,
      rooms: input.rooms,
      bedrooms: input.bedrooms,
      floor: input.floor,
      buildYear: input.buildYear,
      outdoor: input.outdoor,
      parking: input.parking,
      cellar: input.cellar,
      heating: input.heating,
      coOwnership: input.coOwnership,
      syndic: input.syndic,
      dpe: input.dpe,
      ges: input.ges,
      dpeDate: input.dpeDate,
      dpeReminders: input.dpeReminders,
      rentalMode: input.rentalMode,
      share: input.share,
      companyId: viaCompany ? input.companyId : null,
      dismemberment: input.dismemberment,
      usufructBirthDate: pleine ? null : input.usufructBirthDate,
      usufructEnd: pleine ? null : input.usufructEnd,
      inAllocation: input.inAllocation,
      classId: input.classId,
      comment: input.comment,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (input.id) {
      // Une nouvelle date d'estimation : l'ancienne valeur rejoint l'historique.
      const before = await ctx.db.select().from(t.properties).where(eq(t.properties.id, id)).limit(1).then(one);
      if (before?.valueDate && before.valueDate !== input.valueDate) await keepPastValue(ctx, id, before.valueDate, before.valueCents);
    }
    if (input.id) await ctx.db.update(t.properties).set(row).where(eq(t.properties.id, id));
    else await ctx.db.insert(t.properties).values({ id, ...row });
    return mapProperty((await ctx.db.select().from(t.properties).where(eq(t.properties.id, id)).limit(1).then(one))!);
  },

  async "properties.setProvisions"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.id)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    const columns = (p: typeof input.vacancy) => ({ rate: p?.kind === "taux" ? p.value : null, cents: p?.kind === "montant" ? toCents(p.value) : null });
    const vacancy = columns(input.vacancy);
    const works = columns(input.works);
    await ctx.db
      .update(t.properties)
      .set({ vacancyRate: vacancy.rate, vacancyAmountCents: vacancy.cents, worksRate: works.rate, worksAmountCents: works.cents, updatedAt: nowIso() })
      .where(eq(t.properties.id, input.id));
    return OK;
  },

  async "properties.delete"({ id }, ctx) {
    await ctx.db.delete(t.properties).where(eq(t.properties.id, id));
    return OK;
  },

  async "properties.sell"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.id)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (property.purchaseDate && input.saleDate < property.purchaseDate) throw new RpcError("VALIDATION", "La vente ne peut pas précéder l'achat.");
    await ctx.db.update(t.properties).set({ saleDate: input.saleDate, salePriceCents: toCents(input.salePrice), saleFeesCents: toCents(input.saleFees), archived: true, updatedAt: nowIso() }).where(eq(t.properties.id, input.id));
    if (input.closeLoans) await ctx.db.update(t.loans).set({ archived: true, closedOn: input.saleDate, updatedAt: nowIso() }).where(and(eq(t.loans.propertyId, input.id), eq(t.loans.archived, false)));
    return OK;
  },

  async "properties.cancelSale"({ id }, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, id)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (property.saleDate) await ctx.db.update(t.loans).set({ archived: false, closedOn: null, updatedAt: nowIso() }).where(and(eq(t.loans.propertyId, id), eq(t.loans.closedOn, property.saleDate)));
    await ctx.db.update(t.properties).set({ saleDate: null, salePriceCents: null, saleFeesCents: 0, archived: false, updatedAt: nowIso() }).where(eq(t.properties.id, id));
    return OK;
  },

  async "propertyValues.add"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (property.valueDate != null && input.date < property.valueDate) {
      await keepPastValue(ctx, input.propertyId, input.date, toCents(input.value));
      return OK;
    }
    if (property.valueDate != null && input.date !== property.valueDate) await keepPastValue(ctx, input.propertyId, property.valueDate, property.valueCents);
    await ctx.db.update(t.properties).set({ valueCents: toCents(input.value), valueDate: input.date, updatedAt: nowIso() }).where(eq(t.properties.id, input.propertyId));
    return OK;
  },

  async "propertyValues.delete"({ id }, ctx) {
    await ctx.db.delete(t.propertyValues).where(eq(t.propertyValues.id, id));
    return OK;
  },

  async "propertyExpenses.upsert"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (input.yearly && input.untilYear != null && input.untilYear < Number(input.date.slice(0, 4))) throw new RpcError("VALIDATION", "La dernière année précède la date de la dépense.");
    const id = input.id ?? newId();
    const improvement = input.category === "travaux" && input.improvement;
    // Ni une amélioration ni l'assurance, la gestion ou les travaux du propriétaire ne se récupèrent sur le locataire.
    const recoverableRate = improvement || !RECOVERABLE_CATEGORIES.includes(input.category) ? 0 : (input.recoverableRate ?? defaultRecoverableRate(input.category, (await loadParams(ctx.db)).rental.coproRecoverable));
    const row = { propertyId: input.propertyId, date: input.date, category: input.category, amountCents: toCents(input.amount), label: input.label, yearly: input.yearly, untilYear: input.yearly ? input.untilYear : null, improvement, recoverableRate, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.propertyExpenses).set(row).where(eq(t.propertyExpenses.id, id));
    else await ctx.db.insert(t.propertyExpenses).values({ id, ...row });
    return mapPropertyExpense((await ctx.db.select().from(t.propertyExpenses).where(eq(t.propertyExpenses.id, id)).limit(1).then(one))!);
  },

  async "propertyReminders.upsert"(input, ctx) {
    if (!(await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one))) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (input.lotId) {
      const lot = await ctx.db.select().from(t.lots).where(eq(t.lots.id, input.lotId)).limit(1).then(one);
      if (!lot || lot.propertyId !== input.propertyId) throw new RpcError("NOT_FOUND", "Lot introuvable.");
    }
    const id = input.id ?? newId();
    // Un rappel annuel revient chaque année : il n'est jamais « fait ».
    const row = { propertyId: input.propertyId, lotId: input.lotId, date: input.date, yearly: input.yearly, label: input.label, comment: input.comment, doneOn: input.yearly ? null : input.doneOn, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.propertyReminders).set(row).where(eq(t.propertyReminders.id, id));
    else await ctx.db.insert(t.propertyReminders).values({ id, ...row });
    return mapPropertyReminder((await ctx.db.select().from(t.propertyReminders).where(eq(t.propertyReminders.id, id)).limit(1).then(one))!);
  },

  async "propertyReminders.delete"({ id }, ctx) {
    await ctx.db.delete(t.propertyReminders).where(eq(t.propertyReminders.id, id));
    return OK;
  },

  async "propertyIncomes.upsert"(input, ctx) {
    if (!(await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one))) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    const id = input.id ?? newId();
    const row = { propertyId: input.propertyId, date: input.date, category: input.category, amountCents: toCents(input.amount), label: input.label, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.propertyIncomes).set(row).where(eq(t.propertyIncomes.id, id));
    else await ctx.db.insert(t.propertyIncomes).values({ id, ...row });
    return mapPropertyIncome((await ctx.db.select().from(t.propertyIncomes).where(eq(t.propertyIncomes.id, id)).limit(1).then(one))!);
  },

  async "propertyIncomes.delete"({ id }, ctx) {
    await ctx.db.delete(t.propertyIncomes).where(eq(t.propertyIncomes.id, id));
    return OK;
  },

  async "propertyDocuments.upsert"(input, ctx) {
    if (!(await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one))) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    const id = input.id ?? newId();
    const row = { propertyId: input.propertyId, kind: input.kind, label: input.label, date: input.date, expiresOn: input.expiresOn, location: input.location, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.propertyDocuments).set(row).where(eq(t.propertyDocuments.id, id));
    else await ctx.db.insert(t.propertyDocuments).values({ id, ...row });
    return mapPropertyDocument((await ctx.db.select().from(t.propertyDocuments).where(eq(t.propertyDocuments.id, id)).limit(1).then(one))!);
  },

  async "propertyDocuments.delete"({ id }, ctx) {
    await ctx.db.delete(t.propertyDocuments).where(eq(t.propertyDocuments.id, id));
    return OK;
  },

  async "propertyExpenses.delete"({ id }, ctx) {
    await ctx.db.delete(t.propertyExpenses).where(eq(t.propertyExpenses.id, id));
    return OK;
  },
} satisfies Partial<DomainHandlers<typeof realestateProcedures>>;

async function keepPastValue(ctx: BackendContext, propertyId: string, date: string, valueCents: number) {
  const set = { valueCents, updatedAt: nowIso() };
  await ctx.db.insert(t.propertyValues).values({ id: newId(), propertyId, date, ...set }).onConflictDoUpdate({ target: [t.propertyValues.propertyId, t.propertyValues.date], set });
}
