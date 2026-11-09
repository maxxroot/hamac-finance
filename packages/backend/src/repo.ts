import { desc, sql } from "drizzle-orm";
import { one } from "./db/driver";
import type {
  AccountRate,
  Institution,
  InstitutionKind,
  Account,
  AccountKind,
  Asset,
  AssetKind,
  BondPlan,
  ContributionPlan,
  ContributionSkip,
  FundRate,
  LivretType,
  CrowdProject,
  Loan,
  PlannedExpense,
  Property,
  PriceSource,
  PricePoint,
  Statement,
  Transaction,
  TxType,
} from "@hamac/core";
import { normalizeParams, Offers, type PlanParams } from "@hamac/core";
import type { Workspace } from "@hamac/api";
import { eq } from "drizzle-orm";
import * as t from "./db/schema";
import type { Db } from "./db/postgres";
import { instrumentKey } from "./market/index";
import { mergePrices, type PriceRow } from "./market/merge";
import type { SharedMarket } from "./market/shared";

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
    institutionId: r.institutionId,
    openedOn: r.openedOn,
    depositCeiling: fromCentsOrNull(r.depositCeilingCents),
    rate: r.rate,
    role: r.role,
    beneficiaryClause: r.beneficiaryClause,
    entryFeeRate: r.entryFeeRate,
    managementFeeRate: r.managementFeeRate,
    monthsToInvest: r.monthsToInvest,
    inAllocation: r.inAllocation,
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
    priceProvider: (r.priceProvider as Asset["priceProvider"]) ?? null,
    priceUrl: r.priceUrl,
    pricePath: r.pricePath,
    classId: r.classId,
    inAllocation: r.inAllocation,
    manualPrice: r.manualPrice,
    manualPriceDate: r.manualPriceDate,
    targetWeight: r.targetWeight,
    ter: r.ter,
    couponRate: r.couponRate,
    maturityDate: r.maturityDate,
    couponFrequency: r.couponFrequency,
    nextCouponDate: r.nextCouponDate,
    issuer: r.issuer,
    bondKind: (r.bondKind as Asset["bondKind"]) ?? null,
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
    externalId: r.externalId,
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

export const mapCrowdProject = (r: typeof t.crowdProjects.$inferSelect): CrowdProject => ({
  id: r.id,
  accountId: r.accountId,
  name: r.name,
  amount: fromCents(r.amountCents),
  rate: r.rate,
  startDate: r.startDate,
  termMonths: r.termMonths,
  repayment: r.repayment as CrowdProject["repayment"],
  status: r.status as CrowdProject["status"],
  statusDate: r.statusDate,
  repaidCapital: r.repaidCapitalCents == null ? null : fromCents(r.repaidCapitalCents),
  expectedRecovery: r.expectedRecoveryCents == null ? null : fromCents(r.expectedRecoveryCents),
  inAllocation: r.inAllocation,
  comment: r.comment,
  externalId: r.externalId,
  extendedTo: r.extendedTo,
});

export const mapProperty = (r: typeof t.properties.$inferSelect): Property => ({
  id: r.id,
  kind: r.kind as Property["kind"],
  name: r.name,
  value: fromCents(r.valueCents),
  valueDate: r.valueDate,
  purchasePrice: r.purchasePriceCents == null ? null : fromCents(r.purchasePriceCents),
  purchaseDate: r.purchaseDate,
  share: r.share,
  inAllocation: r.inAllocation,
  classId: r.classId,
  comment: r.comment,
  archived: r.archived,
});

export const mapLoan = (r: typeof t.loans.$inferSelect): Loan => ({
  id: r.id,
  kind: r.kind as Loan["kind"],
  name: r.name,
  propertyId: r.propertyId,
  principal: fromCents(r.principalCents),
  rate: r.rate,
  termMonths: r.termMonths,
  firstPayment: r.firstPayment,
  insuranceMode: r.insuranceMode as Loan["insuranceMode"],
  insurance: fromCents(r.insuranceCents),
  insuranceRate: r.insuranceRate,
  manualPayment: r.manualPaymentCents == null ? null : fromCents(r.manualPaymentCents),
  manualBalance: r.manualBalanceCents == null ? null : fromCents(r.manualBalanceCents),
  manualBalanceDate: r.manualBalanceDate,
  archived: r.archived,
});

export function mapInstitution(r: typeof t.institutions.$inferSelect): Institution {
  // Offres validées à la lecture : une donnée ancienne ou incomplète reçoit ses valeurs par défaut.
  const parsed = Offers.safeParse(JSON.parse(r.offers));
  return { id: r.id, name: r.name, kind: r.kind as InstitutionKind, website: r.website, score: r.score, comment: r.comment, offers: parsed.success ? parsed.data : {} };
}

export async function loadParams(db: Db): Promise<PlanParams> {
  const row = await db.select().from(t.settings).where(eq(t.settings.key, PARAMS_KEY)).limit(1).then(one);
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

export async function loadWorkspace(db: Db, market: SharedMarket): Promise<Workspace> {
  const [params, accounts, assets, txs, plans, skips, bondPlans, fundRates, statements, expenses, prices, status, institutions, rates, propertyRows, loanRows, crowdRows] = await Promise.all([
    loadParams(db),
    db.select().from(t.accounts).orderBy(t.accounts.sortOrder, t.accounts.name),
    db.select().from(t.assets).orderBy(t.assets.name),
    db.select().from(t.transactions).orderBy(desc(t.transactions.date), desc(t.transactions.createdAt)),
    db.select().from(t.contributionPlans).orderBy(t.contributionPlans.fromMonth),
    db.select().from(t.contributionSkips).orderBy(t.contributionSkips.month),
    db.select().from(t.bondPlans).orderBy(t.bondPlans.targetYear),
    db.select().from(t.fundRates).orderBy(t.fundRates.year),
    db.select().from(t.statements).orderBy(desc(t.statements.date)),
    db.select().from(t.plannedExpenses).orderBy(t.plannedExpenses.year),
    // Historique allégé : dernier cours de chaque mois pour chaque titre.
    db
      .select()
      .from(t.prices)
      // Crypto : tous les jours, la plus-value d'une vente se calcule sur la valeur du portefeuille à sa date.
      .where(sql`(${t.prices.assetId}, ${t.prices.date}) IN (SELECT asset_id, MAX(date) FROM prices GROUP BY asset_id, substr(date, 1, 7)) OR ${t.prices.assetId} IN (SELECT id FROM assets WHERE kind = 'crypto')`),
    db.select().from(t.settings).where(eq(t.settings.key, PRICE_STATUS_KEY)).limit(1).then(one),
    db.select().from(t.institutions).orderBy(t.institutions.name),
    db.select().from(t.accountRates).orderBy(t.accountRates.fromDate),
    db.select().from(t.properties).orderBy(t.properties.name),
    db.select().from(t.loans).orderBy(t.loans.name),
    db.select().from(t.crowdProjects).orderBy(desc(t.crowdProjects.startDate)),
  ]);
  // Cours communs à l'instance, fusionnés avec ceux propres au tenant.
  const mappedAssets = assets.map(mapAsset);
  const keyOf = new Map(mappedAssets.flatMap((a) => { const key = instrumentKey(a); return key ? [[a.id, key] as const] : []; }));
  const common = await market.quotes([...new Set(keyOf.values())]);
  const sharedRows = [...keyOf].flatMap(([assetId, key]) => common.filter((q) => q.key === key).map((q): PriceRow => ({ assetId, date: q.date, price: q.price, source: q.source })));
  const merged = mergePrices(prices, sharedRows, new Set(mappedAssets.filter((a) => a.kind === "crypto").map((a) => a.id)));
  return {
    params,
    accounts: accounts.map(mapAccount),
    assets: mappedAssets,
    transactions: txs.map(mapTx),
    plans: plans.map(mapPlan),
    skips: skips.map(mapSkip),
    bondPlans: bondPlans.map(mapBondPlan),
    fundRates: fundRates.map(mapFundRate),
    statements: statements.map(mapStatement),
    plannedExpenses: expenses.map(mapExpense),
    properties: propertyRows.map(mapProperty),
    loans: loanRows.map(mapLoan),
    crowdProjects: crowdRows.map(mapCrowdProject),
    prices: merged.map((p): PricePoint => ({ ...p })),
    priceStatus: status ? JSON.parse(status.value) : null,
    institutions: institutions.map(mapInstitution),
    accountRates: rates.map((r): AccountRate => ({ id: r.id, accountId: r.accountId, fromDate: r.fromDate, rate: r.rate, comment: r.comment })),
  };
}
