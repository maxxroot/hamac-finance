import { eq } from "drizzle-orm";
import { one } from "../db/driver";
import { RpcError, type investmentsProcedures } from "@hamac/api";
import { crowdExtensionError } from "@hamac/core";
import * as t from "../db/schema";
import { mapBondPlan, newId, nowIso, toCents, mapCrowdProject } from "../repo";
import { OK, type DomainHandlers } from "./_types";

/** Obligations gardées jusqu'à l'échéance et projets de crowdlending. */

export const investmentsHandlers: DomainHandlers<typeof investmentsProcedures> = {
  async "bondPlans.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { accountId: input.accountId, label: input.label, targetYear: input.targetYear, nominalCents: toCents(input.nominal), comment: input.comment, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.bondPlans).set(row).where(eq(t.bondPlans.id, id));
    else await ctx.db.insert(t.bondPlans).values({ id, ...row });
    return mapBondPlan((await ctx.db.select().from(t.bondPlans).where(eq(t.bondPlans.id, id)).limit(1).then(one))!);
  },

  async "bondPlans.delete"({ id }, ctx) {
    await ctx.db.delete(t.bondPlans).where(eq(t.bondPlans.id, id));
    return OK;
  },

  async "crowdProjects.upsert"(input, ctx) {
    const account = await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, input.accountId)).limit(1).then(one);
    if (account?.kind !== "crowdlending") throw new RpcError("VALIDATION", "Un projet doit être rattaché à une plateforme de crowdlending.");
    const extensionError = crowdExtensionError(input);
    if (extensionError) throw new RpcError("VALIDATION", extensionError);
    const id = input.id ?? newId();
    const row = {
      accountId: input.accountId,
      name: input.name,
      amountCents: toCents(input.amount),
      rate: input.rate,
      startDate: input.startDate,
      termMonths: input.termMonths,
      repayment: input.repayment,
      status: input.status,
      statusDate: input.status === "en_cours" ? null : input.statusDate,
      extendedTo: input.extendedTo,
      repaidCapitalCents: input.repaidCapital == null ? null : toCents(input.repaidCapital),
      expectedRecoveryCents: input.status === "defaut" && input.expectedRecovery != null ? toCents(input.expectedRecovery) : null,
      inAllocation: input.inAllocation,
      comment: input.comment,
      updatedAt: nowIso(),
    };
    if (input.id) await ctx.db.update(t.crowdProjects).set(row).where(eq(t.crowdProjects.id, id));
    else await ctx.db.insert(t.crowdProjects).values({ id, ...row });
    return mapCrowdProject((await ctx.db.select().from(t.crowdProjects).where(eq(t.crowdProjects.id, id)).limit(1).then(one))!);
  },

  async "crowdProjects.applyImport"({ accountId, transactions, projects }, ctx) {
    const account = await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, accountId)).limit(1).then(one);
    if (account?.kind !== "crowdlending") throw new RpcError("VALIDATION", "L'import doit viser une plateforme de crowdlending.");
    const now = nowIso();
    // Tout ou rien, et sans doublon même si le même import est envoyé deux fois.
    await ctx.raw.transaction(async () => {
      const addTx = "INSERT INTO transactions (id, date, type, account_id, amount_cents, comment, external_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING";
      const setTx = "UPDATE transactions SET date = ?, type = ?, amount_cents = ?, comment = ?, external_id = ?, updated_at = ? WHERE id = ? AND account_id = ?";
      const delTx = "DELETE FROM transactions WHERE id = ? AND account_id = ? AND external_id IS NOT NULL";
      for (const x of transactions) {
        if (x.action === "nouveau") await ctx.raw.run(addTx, [newId(), x.date, x.type, accountId, toCents(x.amount), x.comment, x.externalId]);
        else if (x.action === "modifie" && x.id) await ctx.raw.run(setTx, [x.date, x.type, toCents(x.amount), x.comment, x.externalId, now, x.id, accountId]);
        else if (x.action === "retire" && x.id) await ctx.raw.run(delTx, [x.id, accountId]);
      }
      const addProject = "INSERT INTO crowd_projects (id, account_id, name, amount_cents, start_date, repayment, status, status_date, repaid_capital_cents, comment, external_id) VALUES (?, ?, ?, ?, ?, 'in_fine', ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING";
      const setProject = "UPDATE crowd_projects SET amount_cents = ?, start_date = ?, status = ?, status_date = ?, repaid_capital_cents = ?, external_id = ?, updated_at = ? WHERE id = ? AND account_id = ?";
      for (const p of projects) {
        if (p.action === "nouveau") await ctx.raw.run(addProject, [newId(), accountId, p.name, toCents(p.amount), p.startDate, p.status, p.statusDate, toCents(p.repaidCapital), p.comment, p.externalId]);
        else if (p.id) await ctx.raw.run(setProject, [toCents(p.amount), p.startDate, p.status, p.statusDate, toCents(p.repaidCapital), p.externalId, now, p.id, accountId]);
      }
    });
    return { transactions: transactions.length, projects: projects.length };
  },

  async "crowdProjects.delete"({ id }, ctx) {
    await ctx.db.delete(t.crowdProjects).where(eq(t.crowdProjects.id, id));
    return OK;
  },
};
