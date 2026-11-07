import { desc, sql } from "drizzle-orm";
import type {
  ChecklistItem,
  Comparison,
  Account,
  AccountKind,
  Asset,
  AssetKind,
  BondPlan,
  ContributionPlan,
  ContributionSkip,
  FundRate,
  LivretType,
  PlannedExpense,
  PriceSource,
  PricePoint,
  Statement,
  Transaction,
  TxType,
} from "@hamac/core";
import { normalizeParams, type PlanParams } from "@hamac/core";
import type { Workspace } from "@hamac/api";
import { eq } from "drizzle-orm";
import * as t from "./db/schema";
import type { Db } from "./db/sqlite";

export const toCents = (euros: number) => Math.round(euros * 100);
export const fromCents = (cents: number) => cents / 100;
const fromCentsOrNull = (c: number | null) => (c == null ? null : c / 100);
export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export const PARAMS_KEY = "plan.parameters";
export const PRICE_STATUS_KEY = "prices.status";

export function mapAccount(r: typeof t.accounts.$inferSelect): Account {
  return {
    id: r.id,
    kind: r.kind as AccountKind,
    livretType: (r.livretType as LivretType | null) ?? null,
    name: r.name,
    institution: r.institution,
    openedOn: r.openedOn,
    depositCeiling: fromCentsOrNull(r.depositCeilingCents),
    rate: r.rate,
    role: r.role,
    beneficiaryClause: r.beneficiaryClause,
    entryFeeRate: r.entryFeeRate,
    managementFeeRate: r.managementFeeRate,
    monthsToInvest: r.monthsToInvest,
    sortOrder: r.sortOrder,
    archived: r.archived,
  };
}

export function mapAsset(r: typeof t.assets.$inferSelect): Asset {
  return {
    id: r.id,
    kind: r.kind as AssetKind,
    name: r.name,
    isin: r.isin,
    symbol: r.symbol,
    priceSource: r.priceSource as PriceSource,
    manualPrice: r.manualPrice,
    manualPriceDate: r.manualPriceDate,
    targetWeight: r.targetWeight,
    ter: r.ter,
    couponRate: r.couponRate,
    maturityDate: r.maturityDate,
    couponFrequency: r.couponFrequency,
    issuer: r.issuer,
    archived: r.archived,
  };
}

export function mapTx(r: typeof t.transactions.$inferSelect): Transaction {
  return {
    id: r.id,
    date: r.date,
    type: r.type as TxType,
    accountId: r.accountId,
    assetId: r.assetId,
    counterAccountId: r.counterAccountId,
    amount: fromCents(r.amountCents),
    quantity: r.quantity,
    fee: fromCentsOrNull(r.feeCents),
    comment: r.comment,
  };
}

export const mapPlan = (r: typeof t.contributionPlans.$inferSelect): ContributionPlan => ({
  id: r.id,
  accountId: r.accountId,
  fromMonth: r.fromMonth,
  amount: fromCents(r.amountCents),
  comment: r.comment,
});
export const mapSkip = (r: typeof t.contributionSkips.$inferSelect): ContributionSkip => ({
  id: r.id,
  accountId: r.accountId,
  month: r.month,
  amount: fromCents(r.amountCents),
  comment: r.comment,
});
export const mapBondPlan = (r: typeof t.bondPlans.$inferSelect): BondPlan => ({
  id: r.id,
  accountId: r.accountId,
  label: r.label,
  targetYear: r.targetYear,
  nominal: fromCents(r.nominalCents),
  comment: r.comment,
});
export const mapFundRate = (r: typeof t.fundRates.$inferSelect): FundRate => ({ ...r });
export const mapStatement = (r: typeof t.statements.$inferSelect): Statement => ({
  id: r.id,
  accountId: r.accountId,
  date: r.date,
  value: fromCents(r.valueCents),
  comment: r.comment,
});
export const mapExpense = (r: typeof t.plannedExpenses.$inferSelect): PlannedExpense => ({
  id: r.id,
  year: r.year,
  amount: fromCents(r.amountCents),
  label: r.label,
  accountId: r.accountId,
});

export const mapChecklist = (r: typeof t.checklistItems.$inferSelect): ChecklistItem => ({ id: r.id, label: r.label, note: r.note, done: r.done, doneAt: r.doneAt, sortOrder: r.sortOrder });
export const mapComparison = (r: typeof t.comparisons.$inferSelect): Comparison => ({
  id: r.id,
  kind: r.kind as Comparison["kind"],
  name: r.name,
  values: JSON.parse(r.values),
  score: r.score,
  comment: r.comment,
});

export async function loadParams(db: Db): Promise<PlanParams> {
  const row = await db.select().from(t.settings).where(eq(t.settings.key, PARAMS_KEY)).get();
  return normalizeParams(row ? JSON.parse(row.value) : null);
}

export async function saveParams(db: Db, params: PlanParams): Promise<void> {
  const value = JSON.stringify(params);
  const updatedAt = nowIso();
  await db
    .insert(t.settings)
    .values({ key: PARAMS_KEY, value, updatedAt })
    .onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt } });
}

export async function loadWorkspace(db: Db): Promise<Workspace> {
  const [params, accounts, assets, txs, plans, skips, bondPlans, fundRates, statements, expenses, prices, status, checklist, comparisons] = await Promise.all([
    loadParams(db),
    db.select().from(t.accounts).orderBy(t.accounts.sortOrder, t.accounts.name).all(),
    db.select().from(t.assets).orderBy(t.assets.name).all(),
    db.select().from(t.transactions).orderBy(desc(t.transactions.date), desc(t.transactions.createdAt)).all(),
    db.select().from(t.contributionPlans).orderBy(t.contributionPlans.fromMonth).all(),
    db.select().from(t.contributionSkips).orderBy(t.contributionSkips.month).all(),
    db.select().from(t.bondPlans).orderBy(t.bondPlans.targetYear).all(),
    db.select().from(t.fundRates).orderBy(t.fundRates.year).all(),
    db.select().from(t.statements).orderBy(desc(t.statements.date)).all(),
    db.select().from(t.plannedExpenses).orderBy(t.plannedExpenses.year).all(),
    // Historique allégé : dernier cours de chaque mois pour chaque titre.
    db
      .select()
      .from(t.prices)
      .where(sql`(${t.prices.assetId}, ${t.prices.date}) IN (SELECT asset_id, MAX(date) FROM prices GROUP BY asset_id, substr(date, 1, 7))`)
      .all(),
    db.select().from(t.settings).where(eq(t.settings.key, PRICE_STATUS_KEY)).get(),
    db.select().from(t.checklistItems).orderBy(t.checklistItems.sortOrder, t.checklistItems.createdAt).all(),
    db.select().from(t.comparisons).orderBy(t.comparisons.createdAt).all(),
  ]);
  return {
    params,
    accounts: accounts.map(mapAccount),
    assets: assets.map(mapAsset),
    transactions: txs.map(mapTx),
    plans: plans.map(mapPlan),
    skips: skips.map(mapSkip),
    bondPlans: bondPlans.map(mapBondPlan),
    fundRates: fundRates.map(mapFundRate),
    statements: statements.map(mapStatement),
    plannedExpenses: expenses.map(mapExpense),
    prices: prices.map((p): PricePoint => ({ ...p })),
    priceStatus: status ? JSON.parse(status.value) : null,
    checklist: checklist.map(mapChecklist),
    comparisons: comparisons.map(mapComparison),
  };
}
