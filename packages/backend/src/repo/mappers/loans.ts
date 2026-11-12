import type { Loan, LoanPrepayment } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents } from "../../db/units";

/** Lignes de la base → crédits et remboursements anticipés. */

export const mapLoan = (r: typeof t.loans.$inferSelect, prepayments: readonly LoanPrepayment[] = []): Loan => ({
  id: r.id,
  kind: r.kind as Loan["kind"],
  name: r.name,
  propertyId: r.propertyId,
  share: r.share,
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
  closedOn: r.closedOn,
  deferredMonths: r.deferredMonths,
  deferredKind: r.deferredKind as Loan["deferredKind"],
  prepayments,
});

export const mapLoanPrepayment = (r: typeof t.loanPrepayments.$inferSelect): LoanPrepayment => ({ id: r.id, loanId: r.loanId, date: r.date, amount: fromCents(r.amountCents), fee: fromCents(r.feeCents), mode: r.mode as LoanPrepayment["mode"] });
