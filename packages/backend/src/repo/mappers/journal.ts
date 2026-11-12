import type { ContributionPlan, ContributionSkip, Transaction, TxType } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents, fromCentsOrNull } from "../../db/units";

/** Lignes de la base → opérations et versements programmés. */

export function mapTx(r: typeof t.transactions.$inferSelect): Transaction {
  return {
    id: r.id,
    date: r.date,
    type: r.type as TxType,
    accountId: r.accountId,
    assetId: r.assetId,
    counterAccountId: r.counterAccountId,
    counterAssetId: r.counterAssetId,
    counterQuantity: r.counterQuantity,
    amount: fromCents(r.amountCents),
    quantity: r.quantity,
    fee: fromCentsOrNull(r.feeCents),
    comment: r.comment,
    externalId: r.externalId,
    gross: fromCentsOrNull(r.grossCents),
    withheldIncomeTax: fromCentsOrNull(r.withheldIncomeTaxCents),
    withheldSocial: fromCentsOrNull(r.withheldSocialCents),
    withheldForeign: fromCentsOrNull(r.withheldForeignCents),
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
