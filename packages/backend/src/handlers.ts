import { and, desc, eq, or, sql } from "drizzle-orm";
import { one } from "./db/driver";
import { AccountInput, RpcError, type MarketSettings, type ProcInput, type ProcName, type ProcOutput, type Procedures } from "@hamac/api";
import type { output } from "zod";
import { LIVRET_LABELS, LIVRET_LEGAL_CEILINGS, PlanParamsInput, crowdExtensionError, addMonth, dayOfMonth, monthOf, loanHasProperty, uniqueAccountConflict, validateLease, validateTransaction, type Account, type Asset } from "@hamac/core";
import { exportDump, importDump } from "./dump";
import type { BackendContext } from "./context";
import { searchAssets } from "./market";
import { MarketError } from "./market/http";
import { refreshPrices } from "./market/refresh";
import { TwelveDataBudget } from "./market/twelvedata";
import * as t from "./db/schema";
import {
  loadWorkspace,
  mapAccount,
  mapAsset,
  mapBondPlan,
  mapInstitution,
  mapExpense,
  mapPlan,
  mapSkip,
  mapStatement,
  mapTx,
  newId,
  nowIso,
  saveParams,
  toCents, mapCrowdProject, mapLease, mapLeaseRent, mapLoan, mapLoanPrepayment, mapProperty, mapPropertyDocument, mapPropertyExpense, mapPropertyIncome, mapRentException, loadParams } from "./repo";

/** Les handlers reçoivent l'entrée APRÈS validation zod (valeurs par défaut appliquées). */
type Parsed<N extends ProcName> = output<Procedures[N]["input"]>;
type Handlers = { [N in ProcName]: (input: Parsed<N>, ctx: BackendContext) => Promise<ProcOutput<N>> };

const OK = { ok: true as const };

/** Enregistre un taux daté (un seul par compte et par date) puis met à jour le taux courant du compte. */
async function setRate(ctx: BackendContext, r: { accountId: string; fromDate: string; rate: number; comment: string }) {
  await ctx.db
    .insert(t.accountRates)
    .values({ id: newId(), ...r })
    .onConflictDoUpdate({ target: [t.accountRates.accountId, t.accountRates.fromDate], set: { rate: r.rate, comment: r.comment, updatedAt: nowIso() } });
  await syncCurrentRate(ctx, r.accountId);
}

async function keepPastValue(ctx: BackendContext, propertyId: string, date: string, valueCents: number) {
  const set = { valueCents, updatedAt: nowIso() };
  await ctx.db.insert(t.propertyValues).values({ id: newId(), propertyId, date, ...set }).onConflictDoUpdate({ target: [t.propertyValues.propertyId, t.propertyValues.date], set });
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

async function count(query: Promise<{ n: number } | undefined>): Promise<number> {
  return (await query)?.n ?? 0;
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
  await handlers["plans.set"]({ accountId, fromMonth: from, amount: 0, comment: "Compte archivé" }, ctx);
}

async function marketSettings(ctx: BackendContext): Promise<MarketSettings> {
  const state = await ctx.market.state();
  const n = await ctx.market.twelveDataCount(state);
  const key = state.twelveDataKey;
  return {
    canEdit: ctx.isAdmin,
    order: state.order,
    twelveData: { configured: !!key, used: key ? new TwelveDataBudget(key, state.usage, ctx.market.dailyLimit).usage.used : 0, limit: ctx.market.dailyLimit, assets: n, intervalMinutes: ctx.market.intervalMinutes(n) },
  };
}

export const handlers: Handlers = {
  async "system.info"(_input, ctx) {
    return {
      appVersion: ctx.appVersion,
      databasePath: ctx.displayPath,
      schemaVersion: ctx.schemaVersion,
      databaseVersion: await ctx.raw.version(),
      backupsDir: ctx.backupsDir ? "Copie sur le serveur avant chaque migration" : null,
    };
  },

  async "settings.get"({ key }, ctx) {
    const row = await ctx.db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1).then(one);
    return row ? JSON.parse(row.value) : null;
  },

  async "settings.set"({ key, value }, ctx) {
    const json = JSON.stringify(value ?? null);
    const updatedAt = nowIso();
    await ctx.db
      .insert(t.settings)
      .values({ key, value: json, updatedAt })
      .onConflictDoUpdate({ target: t.settings.key, set: { value: json, updatedAt } });
  },

  async "workspace.load"(_input, ctx) {
    return loadWorkspace(ctx.db, ctx.market);
  },

  async "workspace.createStarter"(_input, ctx) {
    const existing = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.accounts).limit(1).then(one));
    if (existing > 0) throw new RpcError("CONFLICT", "Des comptes existent déjà : la structure type n'est proposée que sur une base vide.");
    const starter: Array<ProcInput<"accounts.upsert">> = [
      { kind: "livret", livretType: "LEP", name: "LEP", depositCeiling: LIVRET_LEGAL_CEILINGS.LEP, rate: 0.025, role: "Matelas de sécurité, à garder plein", sortOrder: 1 },
      { kind: "livret", livretType: "LDDS", name: "LDDS", depositCeiling: LIVRET_LEGAL_CEILINGS.LDDS, rate: 0.017, role: "Voiture, maison, imprévus", sortOrder: 2 },
      { kind: "livret", livretType: "LIVRET_A", name: "Livret A", depositCeiling: LIVRET_LEGAL_CEILINGS.LIVRET_A, rate: 0.017, role: "Débordement si le LDDS est plein", sortOrder: 3 },
      { kind: "assurance_vie", name: "Assurance-vie", role: "Amortisseur, capital garanti (fonds euros)", sortOrder: 4 },
      { kind: "cto", name: "Compte-titres", role: "Obligations à taux fixe, gardées jusqu'à l'échéance", sortOrder: 5 },
      { kind: "pea", name: "PEA", role: "Long terme, jamais vendu dans une baisse", monthsToInvest: 12, sortOrder: 6 },
      { kind: "crypto", name: "Crypto", role: "Hors allocation : petite part, peut perdre 80 %", sortOrder: 7 },
    ];
    for (const a of starter) await handlers["accounts.upsert"](AccountInput.parse(a), ctx);
    return OK;
  },

  async "params.update"(input, ctx) {
    const params = PlanParamsInput.parse(input);
    await saveParams(ctx.db, params);
    return params;
  },

  async "accounts.upsert"(input, ctx) {
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
    const row = {
      kind: input.kind,
      livretType: input.kind === "livret" ? (input.livretType ?? "AUTRE") : null,
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
      sortOrder: input.sortOrder,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (input.id) {
      const current = await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, id)).limit(1).then(one);
      if (!current) throw new RpcError("NOT_FOUND", "Compte introuvable.");
      if (current.kind !== input.kind) {
        const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(or(eq(t.transactions.accountId, id), eq(t.transactions.counterAccountId, id))).limit(1).then(one));
        if (used > 0) throw new RpcError("CONFLICT", "Impossible de changer le type d'un compte qui a déjà des opérations.");
      }
      await ctx.db.update(t.accounts).set(row).where(eq(t.accounts.id, id));
      if (input.archived && !current.archived) await stopPlans(ctx, id);
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
    await ctx.db.delete(t.accounts).where(eq(t.accounts.id, id));
    return OK;
  },

  async "assets.upsert"(input, ctx) {
    const id = input.id ?? newId();
    if (input.isin) {
      const dup = await ctx.db.select().from(t.assets).where(and(eq(t.assets.isin, input.isin), sql`${t.assets.id} <> ${id}`)).limit(1).then(one);
      if (dup) throw new RpcError("CONFLICT", `Un titre avec l'ISIN ${input.isin} existe déjà : « ${dup.name} ».`);
    }
    const isBond = input.kind === "obligation";
    const row = {
      kind: input.kind,
      name: input.name,
      isin: input.isin,
      symbol: input.symbol,
      priceSource: isBond && input.priceSource === "auto" ? "modele" : input.priceSource,
      priceProvider: input.priceProvider,
      priceUrl: input.priceUrl,
      pricePath: input.pricePath,
      classId: input.classId,
      inAllocation: input.inAllocation,
      manualPrice: input.manualPrice,
      manualPriceDate: input.manualPriceDate,
      targetWeight: input.targetWeight,
      ter: input.ter,
      couponRate: isBond ? input.couponRate : null,
      maturityDate: isBond ? input.maturityDate : null,
      couponFrequency: isBond ? (input.couponFrequency ?? 1) : null,
      nextCouponDate: isBond ? input.nextCouponDate : null,
      issuer: input.issuer,
      bondKind: isBond ? (input.bondKind ?? null) : null,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (isBond && (row.couponRate == null || !row.maturityDate)) {
      throw new RpcError("VALIDATION", "Une obligation nécessite un taux de coupon et une date d'échéance.");
    }
    if (isBond && row.nextCouponDate && row.nextCouponDate > row.maturityDate!) {
      throw new RpcError("VALIDATION", "La date du prochain coupon doit précéder l'échéance.");
    }
    if (input.id) {
      const current = await ctx.db.select().from(t.assets).where(eq(t.assets.id, id)).limit(1).then(one);
      if (!current) throw new RpcError("NOT_FOUND", "Titre introuvable.");
      await ctx.db.update(t.assets).set(row).where(eq(t.assets.id, id));
    } else {
      await ctx.db.insert(t.assets).values({ id, ...row });
    }
    return mapAsset((await ctx.db.select().from(t.assets).where(eq(t.assets.id, id)).limit(1).then(one))!);
  },

  async "assets.delete"({ id }, ctx) {
    const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(eq(t.transactions.assetId, id)).limit(1).then(one));
    if (used > 0) throw new RpcError("CONFLICT", `Ce titre apparaît dans ${used} opération(s) : archivez-le plutôt que de le supprimer.`);
    await ctx.db.delete(t.assets).where(eq(t.assets.id, id));
    return OK;
  },

  async "transactions.upsert"(input, ctx) {
    const [accounts, assets] = await Promise.all([ctx.db.select().from(t.accounts), ctx.db.select().from(t.assets)]);
    const accMap = new Map<string, Account>(accounts.map((a) => [a.id, mapAccount(a)]));
    const assetMap = new Map<string, Asset>(assets.map((a) => [a.id, mapAsset(a)]));
    const errors = validateTransaction(input, accMap, assetMap);
    if (errors.length) throw new RpcError("VALIDATION", errors.map((e) => e.message).join(" "), errors);

    const id = input.id ?? newId();
    const row = {
      date: input.date,
      type: input.type,
      accountId: input.accountId,
      assetId: input.assetId,
      counterAccountId: input.counterAccountId,
      amountCents: toCents(input.amount),
      quantity: input.quantity,
      feeCents: input.fee == null ? null : toCents(input.fee),
      comment: input.comment,
      grossCents: input.gross == null ? null : toCents(input.gross),
      withheldIncomeTaxCents: input.withheldIncomeTax == null ? null : toCents(input.withheldIncomeTax),
      withheldSocialCents: input.withheldSocial == null ? null : toCents(input.withheldSocial),
      withheldForeignCents: input.withheldForeign == null ? null : toCents(input.withheldForeign),
      updatedAt: nowIso(),
    };
    if (input.id) {
      const res = await ctx.db.update(t.transactions).set(row).where(eq(t.transactions.id, id)).returning({ id: t.transactions.id });
      if (res.length === 0) throw new RpcError("NOT_FOUND", "Opération introuvable.");
    } else {
      await ctx.db.insert(t.transactions).values({ id, ...row });
    }
    return mapTx((await ctx.db.select().from(t.transactions).where(eq(t.transactions.id, id)).limit(1).then(one))!);
  },

  async "transactions.createWithAsset"({ asset, transaction }, ctx) {
    // Une seule transaction : si l'opération est refusée, le titre n'est pas créé.
    return ctx.raw.transaction(async () => {
      const created = await handlers["assets.upsert"](asset, ctx);
      const tx = await handlers["transactions.upsert"]({ ...transaction, assetId: created.id }, ctx);
      return { asset: created, transaction: tx };
    });
  },

  async "transactions.delete"({ id }, ctx) {
    await ctx.db.delete(t.transactions).where(eq(t.transactions.id, id));
    return OK;
  },

  async "plans.set"(input, ctx) {
    const existing = await ctx.db
      .select()
      .from(t.contributionPlans)
      .where(and(eq(t.contributionPlans.accountId, input.accountId), eq(t.contributionPlans.fromMonth, input.fromMonth)))
      .limit(1).then(one);
    const id = existing?.id ?? newId();
    if (existing) {
      await ctx.db.update(t.contributionPlans).set({ amountCents: toCents(input.amount), comment: input.comment, updatedAt: nowIso() }).where(eq(t.contributionPlans.id, id));
    } else {
      await ctx.db.insert(t.contributionPlans).values({ id, accountId: input.accountId, fromMonth: input.fromMonth, amountCents: toCents(input.amount), comment: input.comment });
    }
    return mapPlan((await ctx.db.select().from(t.contributionPlans).where(eq(t.contributionPlans.id, id)).limit(1).then(one))!);
  },

  async "plans.delete"({ id }, ctx) {
    await ctx.db.delete(t.contributionPlans).where(eq(t.contributionPlans.id, id));
    return OK;
  },

  async "skips.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { accountId: input.accountId, month: input.month, amountCents: toCents(input.amount), comment: input.comment, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.contributionSkips).set(row).where(eq(t.contributionSkips.id, id));
    else await ctx.db.insert(t.contributionSkips).values({ id, ...row });
    return mapSkip((await ctx.db.select().from(t.contributionSkips).where(eq(t.contributionSkips.id, id)).limit(1).then(one))!);
  },

  async "skips.delete"({ id }, ctx) {
    await ctx.db.delete(t.contributionSkips).where(eq(t.contributionSkips.id, id));
    return OK;
  },

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

  async "fundRates.set"(input, ctx) {
    await ctx.db
      .insert(t.fundRates)
      .values(input)
      .onConflictDoUpdate({ target: [t.fundRates.accountId, t.fundRates.year], set: { rate: input.rate, comment: input.comment } });
    return { ...input };
  },

  async "fundRates.delete"({ accountId, year }, ctx) {
    await ctx.db.delete(t.fundRates).where(and(eq(t.fundRates.accountId, accountId), eq(t.fundRates.year, year)));
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

  async "properties.upsert"(input, ctx) {
    const id = input.id ?? newId();
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
      share: input.share,
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

  async "leases.upsert"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (property.kind !== "locatif") throw new RpcError("CONFLICT", "Seul un investissement locatif peut avoir un bail.");
    const others = (await ctx.db.select().from(t.leases).where(eq(t.leases.propertyId, input.propertyId))).map(mapLease);
    const error = validateLease(input, others);
    if (error) throw new RpcError("VALIDATION", error);
    const id = input.id ?? newId();
    const row = {
      propertyId: input.propertyId,
      kind: input.kind,
      tenant: input.tenant,
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
      guarantor: input.guarantor,
      tenantInsuranceUntil: input.tenantInsuranceUntil,
      updatedAt: nowIso(),
    };
    if (input.id) await ctx.db.update(t.leases).set(row).where(eq(t.leases.id, id));
    else await ctx.db.insert(t.leases).values({ id, ...row });
    return mapLease((await ctx.db.select().from(t.leases).where(eq(t.leases.id, id)).limit(1).then(one))!);
  },

  async "leases.delete"({ id }, ctx) {
    await ctx.db.delete(t.leases).where(eq(t.leases.id, id));
    return OK;
  },

  async "leaseRents.upsert"(input, ctx) {
    const lease = await ctx.db.select().from(t.leases).where(eq(t.leases.id, input.leaseId)).limit(1).then(one);
    if (!lease) throw new RpcError("NOT_FOUND", "Bail introuvable.");
    if (input.fromMonth <= lease.startDate.slice(0, 7)) throw new RpcError("VALIDATION", "Un nouveau loyer s'applique après le premier mois du bail. Pour corriger le loyer de départ, modifiez le bail.");
    const id = input.id ?? newId();
    const set = { fromMonth: input.fromMonth, rentCents: toCents(input.rent), chargesCents: toCents(input.charges), updatedAt: nowIso() };
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

  async "rentExceptions.set"(input, ctx) {
    const lease = await ctx.db.select().from(t.leases).where(eq(t.leases.id, input.leaseId)).limit(1).then(one);
    if (!lease) throw new RpcError("NOT_FOUND", "Bail introuvable.");
    if (input.month < lease.startDate.slice(0, 7)) throw new RpcError("VALIDATION", "Ce mois précède le début du bail.");
    const set = { kind: input.kind, amountCents: input.kind === "montant" ? toCents(input.amount!) : null, comment: input.comment, updatedAt: nowIso() };
    const saved = await ctx.db
      .insert(t.rentExceptions)
      .values({ id: newId(), leaseId: input.leaseId, month: input.month, ...set })
      .onConflictDoUpdate({ target: [t.rentExceptions.leaseId, t.rentExceptions.month], set })
      .returning();
    return mapRentException(saved[0]);
  },

  async "rentExceptions.delete"({ id }, ctx) {
    await ctx.db.delete(t.rentExceptions).where(eq(t.rentExceptions.id, id));
    return OK;
  },

  async "propertyExpenses.upsert"(input, ctx) {
    const property = await ctx.db.select().from(t.properties).where(eq(t.properties.id, input.propertyId)).limit(1).then(one);
    if (!property) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    if (input.yearly && input.untilYear != null && input.untilYear < Number(input.date.slice(0, 4))) throw new RpcError("VALIDATION", "La dernière année précède la date de la dépense.");
    const id = input.id ?? newId();
    const row = { propertyId: input.propertyId, date: input.date, category: input.category, amountCents: toCents(input.amount), label: input.label, yearly: input.yearly, untilYear: input.yearly ? input.untilYear : null, improvement: input.category === "travaux" && input.improvement, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.propertyExpenses).set(row).where(eq(t.propertyExpenses.id, id));
    else await ctx.db.insert(t.propertyExpenses).values({ id, ...row });
    return mapPropertyExpense((await ctx.db.select().from(t.propertyExpenses).where(eq(t.propertyExpenses.id, id)).limit(1).then(one))!);
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

  async "propertyExpenses.delete"({ id }, ctx) {
    await ctx.db.delete(t.propertyExpenses).where(eq(t.propertyExpenses.id, id));
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

  async "plannedExpenses.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { year: input.year, amountCents: toCents(input.amount), label: input.label, accountId: input.accountId, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.plannedExpenses).set(row).where(eq(t.plannedExpenses.id, id));
    else await ctx.db.insert(t.plannedExpenses).values({ id, ...row });
    return mapExpense((await ctx.db.select().from(t.plannedExpenses).where(eq(t.plannedExpenses.id, id)).limit(1).then(one))!);
  },

  async "plannedExpenses.delete"({ id }, ctx) {
    await ctx.db.delete(t.plannedExpenses).where(eq(t.plannedExpenses.id, id));
    return OK;
  },

  async "prices.setManual"({ assetId, date, price }, ctx) {
    const asset = await ctx.db.select().from(t.assets).where(eq(t.assets.id, assetId)).limit(1).then(one);
    if (!asset) throw new RpcError("NOT_FOUND", "Titre introuvable.");
    await ctx.db.update(t.assets).set({ manualPrice: price, manualPriceDate: date, updatedAt: nowIso() }).where(eq(t.assets.id, assetId));
    await ctx.db
      .insert(t.prices)
      .values({ assetId, date, price, source: "manuel" })
      .onConflictDoUpdate({ target: [t.prices.assetId, t.prices.date], set: { price, source: "manuel" } });
    return OK;
  },

  async "institutions.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { name: input.name, kind: input.kind, website: input.website, score: input.score, comment: input.comment, offers: JSON.stringify(input.offers), tax: JSON.stringify(input.tax), updatedAt: nowIso() };
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

  async "transactions.bulkCreate"({ items }, ctx) {
    const [accounts, assets] = await Promise.all([ctx.db.select().from(t.accounts), ctx.db.select().from(t.assets)]);
    const accMap = new Map<string, Account>(accounts.map((a) => [a.id, mapAccount(a)]));
    const assetMap = new Map<string, Asset>(assets.map((a) => [a.id, mapAsset(a)]));
    const errors: Array<{ index: number; message: string }> = [];
    const valid = items.filter((tx, index) => {
      const errs = validateTransaction(tx, accMap, assetMap);
      if (errs.length) errors.push({ index, message: errs.map((e) => e.message).join(" ") });
      return errs.length === 0;
    });
    // Tout ou rien pour les lignes valides.
    await ctx.raw.transaction(async () => {
      const insert = "INSERT INTO transactions (id, date, type, account_id, asset_id, counter_account_id, amount_cents, quantity, fee_cents, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      for (const tx of valid) {
        await ctx.raw.run(insert, [newId(), tx.date, tx.type, tx.accountId, tx.assetId, tx.counterAccountId, toCents(tx.amount), tx.quantity, tx.fee == null ? null : toCents(tx.fee), tx.comment]);
      }
    });
    return { created: valid.length, errors };
  },

  async "data.export"(_input, ctx) {
    return await exportDump(ctx);
  },

  async "data.import"({ dump }, ctx) {
    return { tables: await importDump(ctx, dump) };
  },

  async "prices.refresh"(_input, ctx) {
    return refreshPrices(ctx);
  },

  async "market.settings"(_input, ctx) {
    return marketSettings(ctx);
  },

  async "market.configure"({ order }, ctx) {
    if (!ctx.isAdmin) throw new RpcError("UNAUTHORIZED", "Réservé à l'administrateur de l'instance.");
    await ctx.market.configure(order);
    return marketSettings(ctx);
  },

  async "assets.search"({ query }, ctx) {
    return searchAssets(ctx.fetcher, query);
  },

  async "market.series"(input, ctx) {
    try {
      return await ctx.market.series(input);
    } catch (e) {
      if (e instanceof MarketError) throw new RpcError("NOT_FOUND", e.message);
      throw e;
    }
  },
};

