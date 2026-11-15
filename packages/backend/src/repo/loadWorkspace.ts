import { desc, eq, sql } from "drizzle-orm";
import { one } from "../db/driver";
import type { AccountRate, Goal, PricePoint, TaxStatementAmount } from "@hamac/core";
import type { Workspace } from "@hamac/api";
import * as t from "../db/schema";
import type { Db } from "../db/postgres";
import { instrumentKey } from "../market/index";
import { mergePrices, type PriceRow } from "../market/merge";
import type { SharedMarket } from "../market/shared";
import { mapAccount, mapFundRate, mapStatement, mapInstitution } from "./mappers/accounts";
import { mapAsset } from "./mappers/assets";
import { mapBondPlan, mapCrowdProject } from "./mappers/investments";
import { mapTx, mapPlan, mapSkip } from "./mappers/journal";
import { mapLoan, mapLoanPrepayment } from "./mappers/loans";
import { mapOtherAsset, mapOtherAssetValue } from "./mappers/other-assets";
import { mapExpense, mapGoal, mapGift } from "./mappers/planning";
import { mapProperty, mapCompany, mapLease, mapLot, mapRenter, mapLeaseRenter, mapLeaseGuarantee, mapPropertyReminder, mapLeaseRent, mapRentPayment, mapRentNotice, mapRentWaiver, mapPropertyValue, mapPropertyIncome, mapPropertyDocument, mapPropertyExpense } from "./mappers/realestate";
import { PRICE_STATUS_KEY, loadParams } from "./params";
import { fromCents } from "../db/units";

/**
 * Tout l'espace de travail d'un tenant en un appel (`workspace.load`) : chaque table convertie par le mapper de son domaine
 * (`mappers/<domaine>.ts`), les cours du tenant fusionnés avec ceux de l'instance (`mergePrices`).
 * Une nouvelle table s'ajoute ici et dans le type `Workspace` du contrat.
 */
export async function loadWorkspace(db: Db, market: SharedMarket): Promise<Omit<Workspace, "revision">> {
  const [params, accounts, assets, txs, plans, skips, bondPlans, fundRates, statements, expenses, prices, status, institutions, rates, propertyRows, loanRows, crowdRows, taxStatementRows, leaseRows, leaseRentRows, rentPaymentRows, expenseRows, propertyValueRows, incomeRows, documentRows, prepaymentRows, companyRows, otherAssetRows, otherAssetValueRows, giftRows, goalRows, goalAllocationRows, lotRows, renterRows, leaseRenterRows, guaranteeRows, reminderRows, waiverRows, noticeRows] = await Promise.all([
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
    db.select().from(t.taxStatementAmounts),
    db.select().from(t.leases).orderBy(t.leases.startDate),
    db.select().from(t.leaseRents).orderBy(t.leaseRents.fromMonth),
    db.select().from(t.rentPayments).orderBy(t.rentPayments.month, t.rentPayments.date),
    db.select().from(t.propertyExpenses).orderBy(desc(t.propertyExpenses.date)),
    db.select().from(t.propertyValues).orderBy(t.propertyValues.date),
    db.select().from(t.propertyIncomes).orderBy(desc(t.propertyIncomes.date)),
    db.select().from(t.propertyDocuments).orderBy(desc(t.propertyDocuments.date)),
    db.select().from(t.loanPrepayments).orderBy(t.loanPrepayments.date),
    db.select().from(t.companies).orderBy(t.companies.name),
    db.select().from(t.otherAssets).orderBy(t.otherAssets.name),
    db.select().from(t.otherAssetValues).orderBy(t.otherAssetValues.date),
    db.select().from(t.gifts).orderBy(desc(t.gifts.date)),
    db.select().from(t.goals).orderBy(t.goals.targetDate),
    db.select().from(t.goalAllocations),
    db.select().from(t.lots).orderBy(t.lots.sortOrder, t.lots.name),
    db.select().from(t.renters).orderBy(t.renters.lastName, t.renters.firstName),
    db.select().from(t.leaseRenters).orderBy(t.leaseRenters.sortOrder),
    db.select().from(t.leaseGuarantees).orderBy(t.leaseGuarantees.sortOrder),
    db.select().from(t.propertyReminders).orderBy(t.propertyReminders.date),
    db.select().from(t.rentWaivers).orderBy(t.rentWaivers.month),
    db.select().from(t.rentNotices).orderBy(t.rentNotices.sentOn),
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
    companies: companyRows.map(mapCompany),
    gifts: giftRows.map(mapGift),
    goals: goalRows.map((r) => mapGoal(r, goalAllocationRows.filter((a) => a.goalId === r.id).map((a) => ({ accountId: a.accountId, mode: a.mode as Goal["allocations"][number]["mode"], value: a.value })))),
    otherAssets: otherAssetRows.map(mapOtherAsset),
    otherAssetValues: otherAssetValueRows.map(mapOtherAssetValue),
    lots: lotRows.map(mapLot),
    leases: leaseRows.map(mapLease),
    renters: renterRows.map(mapRenter),
    leaseRenters: leaseRenterRows.map(mapLeaseRenter),
    leaseGuarantees: guaranteeRows.map(mapLeaseGuarantee),
    leaseRents: leaseRentRows.map(mapLeaseRent),
    rentPayments: rentPaymentRows.map(mapRentPayment),
    rentWaivers: waiverRows.map(mapRentWaiver),
    rentNotices: noticeRows.map(mapRentNotice),
    propertyExpenses: expenseRows.map(mapPropertyExpense),
    propertyValues: propertyValueRows.map(mapPropertyValue),
    propertyIncomes: incomeRows.map(mapPropertyIncome),
    propertyDocuments: documentRows.map(mapPropertyDocument),
    propertyReminders: reminderRows.map(mapPropertyReminder),
    loans: loanRows.map((r) => mapLoan(r, prepaymentRows.filter((p) => p.loanId === r.id).map(mapLoanPrepayment))),
    crowdProjects: crowdRows.map(mapCrowdProject),
    prices: merged.map((p): PricePoint => ({ ...p })),
    priceStatus: status ? JSON.parse(status.value) : null,
    institutions: institutions.map(mapInstitution),
    taxStatements: taxStatementRows.map((r): TaxStatementAmount => ({ institutionId: r.institutionId, year: r.year, box: r.box, amount: fromCents(r.amountCents) })),
    accountRates: rates.map((r): AccountRate => ({ id: r.id, accountId: r.accountId, fromDate: r.fromDate, rate: r.rate, comment: r.comment })),
  };
}
