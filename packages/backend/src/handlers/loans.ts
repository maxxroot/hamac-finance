import { eq } from "drizzle-orm";
import { one } from "../db/driver";
import { RpcError, type loansProcedures } from "@hamac/api";
import { loanHasProperty } from "@hamac/core";
import * as t from "../db/schema";
import { newId, nowIso, toCents, mapLoan, mapLoanPrepayment } from "../repo";
import { OK, type DomainHandlers } from "./_types";

/** Crédits et remboursements anticipés. */

export const loansHandlers: DomainHandlers<typeof loansProcedures> = {
  async "loanPrepayments.upsert"(input, ctx) {
    const loan = await ctx.db.select().from(t.loans).where(eq(t.loans.id, input.loanId)).limit(1).then(one);
    if (!loan) throw new RpcError("NOT_FOUND", "Crédit introuvable.");
    const id = input.id ?? newId();
    const row = { loanId: input.loanId, date: input.date, amountCents: toCents(input.amount), feeCents: toCents(input.fee), mode: input.mode, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.loanPrepayments).set(row).where(eq(t.loanPrepayments.id, id));
    else await ctx.db.insert(t.loanPrepayments).values({ id, ...row });
    return mapLoanPrepayment((await ctx.db.select().from(t.loanPrepayments).where(eq(t.loanPrepayments.id, id)).limit(1).then(one))!);
  },

  async "loanPrepayments.delete"({ id }, ctx) {
    await ctx.db.delete(t.loanPrepayments).where(eq(t.loanPrepayments.id, id));
    return OK;
  },

  async "loans.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = {
      kind: input.kind,
      name: input.name,
      propertyId: loanHasProperty(input.kind) ? input.propertyId : null,
      share: input.share,
      principalCents: toCents(input.principal),
      rate: input.rate,
      termMonths: input.termMonths,
      firstPayment: input.firstPayment,
      insuranceMode: input.insuranceMode,
      // Une seule valeur garde un sens selon le mode : pas de reste d'une saisie précédente.
      insuranceCents: input.insuranceMode === "montant" ? toCents(input.insurance) : 0,
      insuranceRate: input.insuranceMode === "montant" ? 0 : input.insuranceRate,
      manualPaymentCents: input.manualPayment == null ? null : toCents(input.manualPayment),
      manualBalanceCents: input.manualBalance == null ? null : toCents(input.manualBalance),
      manualBalanceDate: input.manualBalanceDate,
      archived: input.archived,
      ...(input.archived ? {} : { closedOn: null }),
      deferredMonths: input.deferredMonths,
      deferredKind: input.deferredKind,
      updatedAt: nowIso(),
    };
    if (input.id) await ctx.db.update(t.loans).set(row).where(eq(t.loans.id, id));
    else await ctx.db.insert(t.loans).values({ id, ...row });
    const prepayments = (await ctx.db.select().from(t.loanPrepayments).where(eq(t.loanPrepayments.loanId, id))).map(mapLoanPrepayment);
    return mapLoan((await ctx.db.select().from(t.loans).where(eq(t.loans.id, id)).limit(1).then(one))!, prepayments);
  },

  async "loans.delete"({ id }, ctx) {
    await ctx.db.delete(t.loans).where(eq(t.loans.id, id));
    return OK;
  },
};
