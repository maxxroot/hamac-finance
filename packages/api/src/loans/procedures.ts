import type { Loan, LoanPrepayment } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { LoanInput, LoanPrepaymentInput } from "./inputs";

/** Crédits et remboursements anticipés. */

export const loansProcedures = {
  "loanPrepayments.upsert": { input: LoanPrepaymentInput, output: entity<LoanPrepayment>() },
  "loanPrepayments.delete": { input: byId, output: ok },
  "loans.upsert": { input: LoanInput, output: entity<Loan>() },
  "loans.delete": { input: byId, output: ok },
} as const;
