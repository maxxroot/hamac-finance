import { and, desc, eq, or, sql } from "drizzle-orm";
import { one } from "../db/driver";
import { AssetInput, RpcError, type accountsProcedures } from "@hamac/api";
import { LIVRET_LABELS, canBeJoint, addMonth, dayOfMonth, monthOf, uniqueAccountConflict, holdsEuroFunds, type Account } from "@hamac/core";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { mapAccount, mapInstitution, mapStatement, loadParams } from "../repo";
import { newId, nowIso, toCents } from "../db/units";
import { OK, type Parsed, type DomainHandlers } from "./_types";
import { count } from "./_shared";
import { journalHandlers } from "./journal";
import { assetsHandlers } from "./assets";

/** Comptes, taux datés, établissements, relevés, taux servis des fonds euros et documents fiscaux. */

export const accountsHandlers: DomainHandlers<typeof accountsProcedures> = {
  async "accounts.upsert"(input, ctx) {
    // Un nouveau contrat reçoit son fonds euros dans la même transaction : refusé, rien n'est créé.
    return ctx.raw.transaction(() => upsertAccount(input, ctx));
  },

  async "accountRates.set"(input, ctx) {
    if (!(await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, input.accountId)).limit(1).then(one))) throw new RpcError("NOT_FOUND", "Compte introuvable.");
    await setRate(ctx, input);
    return OK;
  },

  async "accountRates.delete"({ id }, ctx) {
    const row = await ctx.db.select().from(t.accountRates).where(eq(t.accountRates.id, id)).limit(1).then(one);
    await ctx.db.delete(t.accountRates).where(eq(t.accountRates.id, id));
    if (row) await syncCurrentRate(ctx, row.accountId);
    return OK;
  },

  async "accounts.delete"({ id }, ctx) {
    const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(or(eq(t.transactions.accountId, id), eq(t.transactions.counterAccountId, id))).limit(1).then(one));
    if (used > 0) throw new RpcError("CONFLICT", `Ce compte a ${used} opération(s) : archivez-le plutôt que de le supprimer.`);
    const projects = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.crowdProjects).where(eq(t.crowdProjects.accountId, id)).limit(1).then(one));
    if (projects > 0) throw new RpcError("CONFLICT", `Cette plateforme a ${projects} projet(s) : archivez-la plutôt que de la supprimer.`);
    const account = await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, id)).limit(1).then(one);
    await ctx.db.delete(t.accounts).where(eq(t.accounts.id, id));
    // Son fonds euros par défaut part avec lui s'il ne sert nulle part ailleurs.
    if (account?.defaultAssetId) await deleteUnusedEuroFund(ctx, account.defaultAssetId);
    return OK;
  },

  async "fundRates.set"(input, ctx) {
    const asset = await ctx.db.select().from(t.assets).where(eq(t.assets.id, input.assetId)).limit(1).then(one);
    if (asset?.kind !== "fonds_euros") throw new RpcError("VALIDATION", "Un taux servi se rattache à un fonds euros.");
    await ctx.db
      .insert(t.fundRates)
      .values(input)
      .onConflictDoUpdate({ target: [t.fundRates.accountId, t.fundRates.assetId, t.fundRates.year], set: { rate: input.rate, comment: input.comment } });
    return { ...input };
  },

  async "fundRates.delete"({ accountId, assetId, year }, ctx) {
    await ctx.db.delete(t.fundRates).where(and(eq(t.fundRates.accountId, accountId), eq(t.fundRates.assetId, assetId), eq(t.fundRates.year, year)));
    return OK;
  },

  async "statements.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { accountId: input.accountId, date: input.date, valueCents: toCents(input.value), comment: input.comment, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.statements).set(row).where(eq(t.statements.id, id));
    else await ctx.db.insert(t.statements).values({ id, ...row });
    return mapStatement((await ctx.db.select().from(t.statements).where(eq(t.statements.id, id)).limit(1).then(one))!);
  },

  async "statements.delete"({ id }, ctx) {
    await ctx.db.delete(t.statements).where(eq(t.statements.id, id));
    return OK;
  },

  async "institutions.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { name: input.name, kind: input.kind, website: input.website, score: input.score, comment: input.comment, offers: JSON.stringify(input.offers), tax: JSON.stringify(input.tax), protection: JSON.stringify(input.protection), updatedAt: nowIso() };
    if (input.id) {
      const res = await ctx.db.update(t.institutions).set(row).where(eq(t.institutions.id, id)).returning({ id: t.institutions.id });
      if (!res.length) throw new RpcError("NOT_FOUND", "Établissement introuvable.");
    } else await ctx.db.insert(t.institutions).values({ id, ...row });
    return mapInstitution((await ctx.db.select().from(t.institutions).where(eq(t.institutions.id, id)).limit(1).then(one))!);
  },

  async "taxStatements.save"({ institutionId, year, amounts }, ctx) {
    await ctx.raw.transaction(async () => {
      await ctx.db.delete(t.taxStatementAmounts).where(and(eq(t.taxStatementAmounts.institutionId, institutionId), eq(t.taxStatementAmounts.year, year)));
      if (amounts.length) await ctx.db.insert(t.taxStatementAmounts).values(amounts.map((a) => ({ institutionId, year, box: a.box, amountCents: toCents(a.amount) })));
    });
    return OK;
  },

  async "institutions.delete"({ id }, ctx) {
    // Les comptes rattachés gardent leur historique et repassent sur les frais par défaut.
    await ctx.db.update(t.accounts).set({ institutionId: null, updatedAt: nowIso() }).where(eq(t.accounts.institutionId, id));
    await ctx.db.delete(t.institutions).where(eq(t.institutions.id, id));
    return OK;
  },
};

/** Enregistre un taux daté (un seul par compte et par date) puis met à jour le taux courant du compte. */
async function setRate(ctx: BackendContext, r: { accountId: string; fromDate: string; rate: number; comment: string }) {
  await ctx.db
    .insert(t.accountRates)
    .values({ id: newId(), ...r })
    .onConflictDoUpdate({ target: [t.accountRates.accountId, t.accountRates.fromDate], set: { rate: r.rate, comment: r.comment, updatedAt: nowIso() } });
  await syncCurrentRate(ctx, r.accountId);
}

async function syncCurrentRate(ctx: BackendContext, accountId: string) {
  // Historique sans doublon : un taux identique au précédent n'apporte rien, on le retire.
  const all = await ctx.db.select().from(t.accountRates).where(eq(t.accountRates.accountId, accountId)).orderBy(t.accountRates.fromDate);
  for (let i = 1; i < all.length; i++) {
    if (all[i].rate === all[i - 1].rate) {
      await ctx.db.delete(t.accountRates).where(eq(t.accountRates.id, all[i].id));
      all.splice(i--, 1);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const cur = await ctx.db
    .select()
    .from(t.accountRates)
    .where(and(eq(t.accountRates.accountId, accountId), sql`${t.accountRates.fromDate} <= ${today}`))
    .orderBy(desc(t.accountRates.fromDate))
    .limit(1).then(one);
  if (cur) await ctx.db.update(t.accounts).set({ rate: cur.rate }).where(eq(t.accounts.id, accountId));
}

/** Un compte archivé cesse de recevoir ses versements programmés ; ceux déjà passés restent dans son historique. */
async function stopPlans(ctx: BackendContext, accountId: string): Promise<void> {
  const plans = await ctx.db.select().from(t.contributionPlans).where(eq(t.contributionPlans.accountId, accountId));
  if (!plans.some((p) => p.amountCents > 0)) return;
  const today = nowIso().slice(0, 10);
  const month = monthOf(today);
  const { contributionDay } = (await loadParams(ctx.db)).profile;
  const from = dayOfMonth(month, contributionDay) <= today ? addMonth(month, 1) : month;
  await ctx.db.delete(t.contributionPlans).where(and(eq(t.contributionPlans.accountId, accountId), sql`${t.contributionPlans.fromMonth} > ${from}`));
  await journalHandlers["plans.set"]({ accountId, fromMonth: from, amount: 0, comment: "Compte archivé" }, ctx);
}

/** Création ou modification d'un compte (voir « accounts.upsert »). */
async function upsertAccount(input: Parsed<"accounts.upsert">, ctx: BackendContext): Promise<Account> {
  const id = input.id ?? newId();
  // Un seul PEA, LEP, LDDS et Livret A par personne.
  const others = (await ctx.db.select().from(t.accounts)).map(mapAccount);
  const blocking = uniqueAccountConflict(others, { id: input.id, kind: input.kind, livretType: input.kind === "livret" ? (input.livretType ?? "AUTRE") : null, archived: input.archived });
  if (blocking) {
    const what = input.kind === "pea" ? "un seul PEA" : input.kind === "pea_pme" ? "un seul PEA-PME" : `un seul ${LIVRET_LABELS[input.livretType ?? "AUTRE"]}`;
    throw new RpcError("CONFLICT", `On ne peut détenir qu'${what} par personne : « ${blocking.name} » existe déjà.`);
  }
  if (input.institutionId && !(await ctx.db.select().from(t.institutions).where(eq(t.institutions.id, input.institutionId)).limit(1).then(one))) {
    throw new RpcError("NOT_FOUND", "Établissement introuvable.");
  }
  const current = input.id ? await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, id)).limit(1).then(one) : undefined;
  if (input.id && !current) throw new RpcError("NOT_FOUND", "Compte introuvable.");
  const perKind = input.kind === "per" ? (input.perKind ?? "assurantiel") : null;
  // Un PER devenu bancaire n'a plus de fonds euros : refusé s'il en a déjà servi.
  if (current && perKind === "bancaire" && current.perKind !== "bancaire" && (await euroFundOperations(ctx, id)) > 0) {
    throw new RpcError("CONFLICT", "Ce PER a des opérations sur un fonds euros : il ne peut pas devenir un PER bancaire.");
  }
  const defaultAssetId = await defaultEuroFund(ctx, { ...input, perKind }, current?.defaultAssetId ?? null);
  const row = {
    kind: input.kind,
    livretType: input.kind === "livret" ? (input.livretType ?? "AUTRE") : null,
    perKind,
    name: input.name,
    institutionId: input.institutionId,
    openedOn: input.openedOn,
    depositCeilingCents: input.depositCeiling == null ? null : toCents(input.depositCeiling),
    rate: input.rate,
    role: input.role,
    beneficiaryClause: input.beneficiaryClause,
    entryFeeRate: input.entryFeeRate,
    managementFeeRate: input.managementFeeRate,
    monthsToInvest: input.monthsToInvest,
    inAllocation: input.inAllocation,
    defaultAssetId,
    // Seuls les comptes qui peuvent être joints gardent une part détenue.
    share: canBeJoint({ kind: input.kind, livretType: input.kind === "livret" ? (input.livretType ?? "AUTRE") : null }) ? input.share : 1,
    sortOrder: input.sortOrder,
    archived: input.archived,
    updatedAt: nowIso(),
  };
  if (current) {
    if (current.kind !== input.kind) {
      const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(or(eq(t.transactions.accountId, id), eq(t.transactions.counterAccountId, id))).limit(1).then(one));
      if (used > 0) throw new RpcError("CONFLICT", "Impossible de changer le type d'un compte qui a déjà des opérations.");
    }
    await ctx.db.update(t.accounts).set(row).where(eq(t.accounts.id, id));
    if (input.archived && !current.archived) await stopPlans(ctx, id);
    if (current.defaultAssetId && current.defaultAssetId !== defaultAssetId) {
      // Nouveau fonds par défaut : les taux servis du contrat le suivent, sauf les années qu'il a déjà.
      if (defaultAssetId) {
        await ctx.raw.run(
          `UPDATE fund_rates SET asset_id = ? WHERE account_id = ? AND asset_id = ? AND year NOT IN (SELECT year FROM fund_rates WHERE account_id = ? AND asset_id = ?)`,
          [defaultAssetId, id, current.defaultAssetId, id, defaultAssetId],
        );
      }
      // L'ancien fonds euros, s'il ne sert plus nulle part (PER devenu bancaire, fonds partagé avec un autre contrat…).
      await deleteUnusedEuroFund(ctx, current.defaultAssetId);
    }
  } else {
    await ctx.db.insert(t.accounts).values({ id, ...row });
  }
  // Livret : le taux saisi devient un taux daté (historique), si c'est un nouveau taux.
  if (input.kind === "livret" && input.rate != null) {
    const from = input.rateFrom ?? new Date().toISOString().slice(0, 10);
    const current = await ctx.db
      .select()
      .from(t.accountRates)
      .where(and(eq(t.accountRates.accountId, id), sql`${t.accountRates.fromDate} <= ${from}`))
      .orderBy(desc(t.accountRates.fromDate))
      .limit(1).then(one);
    if (!current || current.rate !== input.rate) await setRate(ctx, { accountId: id, fromDate: from, rate: input.rate, comment: "" });
  }
  return mapAccount((await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, id)).limit(1).then(one))!);
}

/**
 * Fonds euros par défaut d'un contrat d'assurance-vie ou de PER. Absent : celui du contrat, ou pour un
 * nouveau contrat un fonds euros à son nom ; null : aucun. Les autres comptes n'en ont pas.
 */
async function defaultEuroFund(ctx: BackendContext, input: Parsed<"accounts.upsert">, current: string | null): Promise<string | null> {
  if (!holdsEuroFunds(input)) return null;
  if (input.defaultAssetId === undefined) {
    if (input.id) return current;
    const fund = await assetsHandlers["assets.upsert"](AssetInput.parse({ kind: "fonds_euros", name: `Fonds euros (${input.name})`, priceSource: "modele" }), ctx);
    return fund.id;
  }
  if (input.defaultAssetId === null) return null;
  const asset = await ctx.db.select().from(t.assets).where(eq(t.assets.id, input.defaultAssetId)).limit(1).then(one);
  if (asset?.kind !== "fonds_euros") throw new RpcError("VALIDATION", "Le support par défaut d'un contrat doit être un fonds euros.");
  return asset.id;
}

/** Opérations d'un compte qui font entrer ou sortir l'argent d'un de ses fonds euros. */
async function euroFundOperations(ctx: BackendContext, accountId: string): Promise<number> {
  const row = await ctx.raw.get<{ n: number | string }>(
    `SELECT count(*) AS n FROM transactions tx JOIN assets a ON a.kind = 'fonds_euros'
      AND ((tx.account_id = ? AND (a.id = tx.asset_id OR (tx.type = 'arbitrage' AND a.id = tx.counter_asset_id))) OR (tx.counter_account_id = ? AND a.id = tx.counter_asset_id))`,
    [accountId, accountId],
  );
  return Number(row?.n ?? 0);
}

async function deleteUnusedEuroFund(ctx: BackendContext, assetId: string): Promise<void> {
  const usedBy = await count(
    ctx.db
      .select({ n: sql<number>`count(*)` })
      .from(t.transactions)
      .where(or(eq(t.transactions.assetId, assetId), eq(t.transactions.counterAssetId, assetId)))
      .limit(1)
      .then(one),
  );
  const defaultOf = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.accounts).where(eq(t.accounts.defaultAssetId, assetId)).limit(1).then(one));
  if (usedBy === 0 && defaultOf === 0) await ctx.db.delete(t.assets).where(and(eq(t.assets.id, assetId), eq(t.assets.kind, "fonds_euros")));
}
