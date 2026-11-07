import { and, desc, eq, or, sql } from "drizzle-orm";
import { AccountInput, RpcError, type ProcInput, type ProcName, type ProcOutput, type Procedures } from "@hamac/api";
import type { output } from "zod";
import { DEFAULT_CHECKLIST, LIVRET_LEGAL_CEILINGS, PlanParams, validateTransaction, type Account, type Asset } from "@hamac/core";
import { exportDump, importDump } from "./dump";
import type { BackendContext } from "./context";
import { searchAssets } from "./market";
import { refreshPrices } from "./market/refresh";
import * as t from "./db/schema";
import {
  loadWorkspace,
  mapAccount,
  mapAsset,
  mapBondPlan,
  mapChecklist,
  mapInstitution,
  mapExpense,
  mapPlan,
  mapSkip,
  mapStatement,
  mapTx,
  newId,
  nowIso,
  saveParams,
  toCents,
} from "./repo";

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

async function syncCurrentRate(ctx: BackendContext, accountId: string) {
  // Historique sans doublon : un taux identique au précédent n'apporte rien, on le retire.
  const all = await ctx.db.select().from(t.accountRates).where(eq(t.accountRates.accountId, accountId)).orderBy(t.accountRates.fromDate).all();
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
    .get();
  if (cur) await ctx.db.update(t.accounts).set({ rate: cur.rate }).where(eq(t.accounts.id, accountId));
}

async function count(query: Promise<{ n: number } | undefined>): Promise<number> {
  return (await query)?.n ?? 0;
}

export const handlers: Handlers = {
  async "system.info"(_input, ctx) {
    const { sqlite_version } = ctx.raw.prepare("SELECT sqlite_version() AS sqlite_version").get() as {
      sqlite_version: string;
    };
    return {
      appVersion: ctx.appVersion,
      mode: ctx.mode,
      databasePath: ctx.displayPath ?? ctx.databasePath,
      schemaVersion: ctx.schemaVersion,
      sqliteVersion: sqlite_version,
      backupsDir: ctx.displayPath ? (ctx.backupsDir ? "Sauvegardes quotidiennes sur le serveur" : null) : ctx.backupsDir,
    };
  },

  async "settings.get"({ key }, ctx) {
    const row = await ctx.db.select().from(t.settings).where(eq(t.settings.key, key)).get();
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
    return loadWorkspace(ctx.db);
  },

  async "workspace.createStarter"(_input, ctx) {
    const existing = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.accounts).get());
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
    const params = PlanParams.parse(input);
    await saveParams(ctx.db, params);
    return params;
  },

  async "accounts.upsert"(input, ctx) {
    const id = input.id ?? newId();
    if (input.institutionId && !(await ctx.db.select().from(t.institutions).where(eq(t.institutions.id, input.institutionId)).get())) {
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
      sortOrder: input.sortOrder,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (input.id) {
      const current = await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, id)).get();
      if (!current) throw new RpcError("NOT_FOUND", "Compte introuvable.");
      if (current.kind !== input.kind) {
        const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(or(eq(t.transactions.accountId, id), eq(t.transactions.counterAccountId, id))).get());
        if (used > 0) throw new RpcError("CONFLICT", "Impossible de changer le type d'un compte qui a déjà des opérations.");
      }
      await ctx.db.update(t.accounts).set(row).where(eq(t.accounts.id, id));
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
        .get();
      if (!current || current.rate !== input.rate) await setRate(ctx, { accountId: id, fromDate: from, rate: input.rate, comment: "" });
    }
    return mapAccount((await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, id)).get())!);
  },

  async "accountRates.set"(input, ctx) {
    if (!(await ctx.db.select().from(t.accounts).where(eq(t.accounts.id, input.accountId)).get())) throw new RpcError("NOT_FOUND", "Compte introuvable.");
    await setRate(ctx, input);
    return OK;
  },

  async "accountRates.delete"({ id }, ctx) {
    const row = await ctx.db.select().from(t.accountRates).where(eq(t.accountRates.id, id)).get();
    await ctx.db.delete(t.accountRates).where(eq(t.accountRates.id, id));
    if (row) await syncCurrentRate(ctx, row.accountId);
    return OK;
  },

  async "accounts.delete"({ id }, ctx) {
    const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(or(eq(t.transactions.accountId, id), eq(t.transactions.counterAccountId, id))).get());
    if (used > 0) throw new RpcError("CONFLICT", `Ce compte a ${used} opération(s) : archivez-le plutôt que de le supprimer.`);
    await ctx.db.delete(t.accounts).where(eq(t.accounts.id, id));
    return OK;
  },

  async "assets.upsert"(input, ctx) {
    const id = input.id ?? newId();
    if (input.isin) {
      const dup = await ctx.db.select().from(t.assets).where(and(eq(t.assets.isin, input.isin), sql`${t.assets.id} <> ${id}`)).get();
      if (dup) throw new RpcError("CONFLICT", `Un titre avec l'ISIN ${input.isin} existe déjà : « ${dup.name} ».`);
    }
    const isBond = input.kind === "obligation";
    const row = {
      kind: input.kind,
      name: input.name,
      isin: input.isin,
      symbol: input.symbol,
      priceSource: isBond && input.priceSource === "auto" ? "modele" : input.priceSource,
      manualPrice: input.manualPrice,
      manualPriceDate: input.manualPriceDate,
      targetWeight: input.targetWeight,
      ter: input.ter,
      couponRate: isBond ? input.couponRate : null,
      maturityDate: isBond ? input.maturityDate : null,
      couponFrequency: isBond ? (input.couponFrequency ?? 1) : null,
      issuer: input.issuer,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (isBond && (row.couponRate == null || !row.maturityDate)) {
      throw new RpcError("VALIDATION", "Une obligation nécessite un taux de coupon et une date d'échéance.");
    }
    if (input.id) {
      const current = await ctx.db.select().from(t.assets).where(eq(t.assets.id, id)).get();
      if (!current) throw new RpcError("NOT_FOUND", "Titre introuvable.");
      await ctx.db.update(t.assets).set(row).where(eq(t.assets.id, id));
    } else {
      await ctx.db.insert(t.assets).values({ id, ...row });
    }
    return mapAsset((await ctx.db.select().from(t.assets).where(eq(t.assets.id, id)).get())!);
  },

  async "assets.delete"({ id }, ctx) {
    const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(eq(t.transactions.assetId, id)).get());
    if (used > 0) throw new RpcError("CONFLICT", `Ce titre apparaît dans ${used} opération(s) : archivez-le plutôt que de le supprimer.`);
    await ctx.db.delete(t.assets).where(eq(t.assets.id, id));
    return OK;
  },

  async "transactions.upsert"(input, ctx) {
    const [accounts, assets] = await Promise.all([ctx.db.select().from(t.accounts).all(), ctx.db.select().from(t.assets).all()]);
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
      updatedAt: nowIso(),
    };
    if (input.id) {
      const res = await ctx.db.update(t.transactions).set(row).where(eq(t.transactions.id, id)).returning({ id: t.transactions.id });
      if (res.length === 0) throw new RpcError("NOT_FOUND", "Opération introuvable.");
    } else {
      await ctx.db.insert(t.transactions).values({ id, ...row });
    }
    return mapTx((await ctx.db.select().from(t.transactions).where(eq(t.transactions.id, id)).get())!);
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
      .get();
    const id = existing?.id ?? newId();
    if (existing) {
      await ctx.db.update(t.contributionPlans).set({ amountCents: toCents(input.amount), comment: input.comment, updatedAt: nowIso() }).where(eq(t.contributionPlans.id, id));
    } else {
      await ctx.db.insert(t.contributionPlans).values({ id, accountId: input.accountId, fromMonth: input.fromMonth, amountCents: toCents(input.amount), comment: input.comment });
    }
    return mapPlan((await ctx.db.select().from(t.contributionPlans).where(eq(t.contributionPlans.id, id)).get())!);
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
    return mapSkip((await ctx.db.select().from(t.contributionSkips).where(eq(t.contributionSkips.id, id)).get())!);
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
    return mapBondPlan((await ctx.db.select().from(t.bondPlans).where(eq(t.bondPlans.id, id)).get())!);
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
    return mapStatement((await ctx.db.select().from(t.statements).where(eq(t.statements.id, id)).get())!);
  },

  async "statements.delete"({ id }, ctx) {
    await ctx.db.delete(t.statements).where(eq(t.statements.id, id));
    return OK;
  },

  async "plannedExpenses.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { year: input.year, amountCents: toCents(input.amount), label: input.label, accountId: input.accountId, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.plannedExpenses).set(row).where(eq(t.plannedExpenses.id, id));
    else await ctx.db.insert(t.plannedExpenses).values({ id, ...row });
    return mapExpense((await ctx.db.select().from(t.plannedExpenses).where(eq(t.plannedExpenses.id, id)).get())!);
  },

  async "plannedExpenses.delete"({ id }, ctx) {
    await ctx.db.delete(t.plannedExpenses).where(eq(t.plannedExpenses.id, id));
    return OK;
  },

  async "prices.setManual"({ assetId, date, price }, ctx) {
    const asset = await ctx.db.select().from(t.assets).where(eq(t.assets.id, assetId)).get();
    if (!asset) throw new RpcError("NOT_FOUND", "Titre introuvable.");
    await ctx.db.update(t.assets).set({ manualPrice: price, manualPriceDate: date, updatedAt: nowIso() }).where(eq(t.assets.id, assetId));
    await ctx.db
      .insert(t.prices)
      .values({ assetId, date, price, source: "manuel" })
      .onConflictDoUpdate({ target: [t.prices.assetId, t.prices.date], set: { price, source: "manuel" } });
    return OK;
  },

  async "checklist.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const existing = input.id ? await ctx.db.select().from(t.checklistItems).where(eq(t.checklistItems.id, id)).get() : undefined;
    const doneAt = input.done ? (existing?.doneAt ?? nowIso()) : null;
    const row = { label: input.label, note: input.note, done: input.done, doneAt, sortOrder: input.sortOrder, updatedAt: nowIso() };
    if (existing) await ctx.db.update(t.checklistItems).set(row).where(eq(t.checklistItems.id, id));
    else await ctx.db.insert(t.checklistItems).values({ id, ...row });
    return mapChecklist((await ctx.db.select().from(t.checklistItems).where(eq(t.checklistItems.id, id)).get())!);
  },

  async "checklist.delete"({ id }, ctx) {
    await ctx.db.delete(t.checklistItems).where(eq(t.checklistItems.id, id));
    return OK;
  },

  async "checklist.seedDefaults"(_input, ctx) {
    const n = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.checklistItems).get());
    if (n > 0) throw new RpcError("CONFLICT", "La liste contient déjà des démarches.");
    let i = 0;
    for (const item of DEFAULT_CHECKLIST) await ctx.db.insert(t.checklistItems).values({ id: newId(), label: item.label, note: item.note ?? "", sortOrder: i++ });
    return OK;
  },

  async "institutions.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { name: input.name, kind: input.kind, website: input.website, score: input.score, comment: input.comment, offers: JSON.stringify(input.offers), updatedAt: nowIso() };
    if (input.id) {
      const res = await ctx.db.update(t.institutions).set(row).where(eq(t.institutions.id, id)).returning({ id: t.institutions.id });
      if (!res.length) throw new RpcError("NOT_FOUND", "Établissement introuvable.");
    } else await ctx.db.insert(t.institutions).values({ id, ...row });
    return mapInstitution((await ctx.db.select().from(t.institutions).where(eq(t.institutions.id, id)).get())!);
  },

  async "institutions.delete"({ id }, ctx) {
    // Les comptes rattachés gardent leur historique et repassent sur les frais par défaut.
    await ctx.db.update(t.accounts).set({ institutionId: null, updatedAt: nowIso() }).where(eq(t.accounts.institutionId, id));
    await ctx.db.delete(t.institutions).where(eq(t.institutions.id, id));
    return OK;
  },

  async "transactions.bulkCreate"({ items }, ctx) {
    const [accounts, assets] = await Promise.all([ctx.db.select().from(t.accounts).all(), ctx.db.select().from(t.assets).all()]);
    const accMap = new Map<string, Account>(accounts.map((a) => [a.id, mapAccount(a)]));
    const assetMap = new Map<string, Asset>(assets.map((a) => [a.id, mapAsset(a)]));
    const errors: Array<{ index: number; message: string }> = [];
    const valid = items.filter((tx, index) => {
      const errs = validateTransaction(tx, accMap, assetMap);
      if (errs.length) errors.push({ index, message: errs.map((e) => e.message).join(" ") });
      return errs.length === 0;
    });
    // Tout ou rien pour les lignes valides : une transaction SQLite.
    ctx.raw.exec("BEGIN IMMEDIATE");
    try {
      const stmt = ctx.raw.prepare(
        "INSERT INTO transactions (id, date, type, account_id, asset_id, counter_account_id, amount_cents, quantity, fee_cents, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const tx of valid) {
        stmt.run(newId(), tx.date, tx.type, tx.accountId, tx.assetId, tx.counterAccountId, toCents(tx.amount), tx.quantity, tx.fee == null ? null : toCents(tx.fee), tx.comment);
      }
      ctx.raw.exec("COMMIT");
    } catch (e) {
      ctx.raw.exec("ROLLBACK");
      throw e;
    }
    return { created: valid.length, errors };
  },

  async "data.export"(_input, ctx) {
    return exportDump(ctx);
  },

  async "data.import"({ dump }, ctx) {
    return { tables: importDump(ctx, dump) };
  },

  async "prices.refresh"(_input, ctx) {
    return refreshPrices(ctx);
  },

  async "assets.search"({ query }, ctx) {
    return searchAssets(ctx.fetcher, query);
  },
};

