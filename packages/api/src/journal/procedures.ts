import { z } from "zod";
import type { Asset, ContributionPlan, ContributionSkip, Transaction } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { AssetInput } from "../assets";
import { PlanInput, SkipInput, TransactionInput } from "./inputs";

/** Journal des opérations et versements programmés. */

export const journalProcedures = {
  "transactions.upsert": { input: TransactionInput, output: entity<Transaction>() },
  "transactions.delete": { input: byId, output: ok },
  /** Achat d'un titre pas encore connu : crée le titre et l'opération ensemble (tout ou rien). */
  "transactions.createWithAsset": { input: z.object({ asset: AssetInput, transaction: TransactionInput }), output: entity<{ asset: Asset; transaction: Transaction }>() },
  /** Retrait, et versement de la même somme sur un autre compte : les deux opérations ensemble (tout ou rien). */
  "transactions.createWithdrawalAndDeposit": { input: z.object({ withdrawal: TransactionInput, deposit: TransactionInput }), output: entity<{ withdrawal: Transaction; deposit: Transaction }>() },
  "plans.set": { input: PlanInput, output: entity<ContributionPlan>() },
  "plans.delete": { input: byId, output: ok },
  "skips.upsert": { input: SkipInput, output: entity<ContributionSkip>() },
  "skips.delete": { input: byId, output: ok },
  "transactions.bulkCreate": {
    input: z.object({ items: z.array(TransactionInput).min(1).max(5000) }),
    output: entity<{ created: number; errors: Array<{ index: number; message: string }> }>(),
  },
} as const;
