import { z } from "zod";
import type { Account, FundRate, Institution, Statement } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { AccountInput, AccountRateInput, FundRateInput, InstitutionInput, StatementInput } from "./inputs";

/** Comptes, établissements, taux datés, relevés et documents fiscaux des établissements. */

export const accountsProcedures = {
  "accounts.upsert": { input: AccountInput, output: entity<Account>() },
  "accounts.delete": { input: byId, output: ok },
  "accountRates.set": { input: AccountRateInput, output: ok },
  "accountRates.delete": { input: byId, output: ok },
  "fundRates.set": { input: FundRateInput, output: entity<FundRate>() },
  "fundRates.delete": { input: z.object({ accountId: z.string(), assetId: z.string(), year: z.number().int() }), output: ok },
  "statements.upsert": { input: StatementInput, output: entity<Statement>() },
  "statements.delete": { input: byId, output: ok },
  "institutions.upsert": { input: InstitutionInput, output: entity<Institution>() },
  "institutions.delete": { input: byId, output: ok },
  /** Remplace les montants lus sur le document fiscal d'un établissement, pour une année. */
  "taxStatements.save": {
    input: z.object({
      institutionId: z.string().min(1),
      year: z.number().int().min(2000).max(2100),
      amounts: z.array(z.object({ box: z.string().trim().min(1).max(8), amount: z.number().finite() })).max(40),
    }),
    output: ok,
  },
} as const;
