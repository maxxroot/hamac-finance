import { z } from "zod";
import { PlanParams } from "@hamac/core";
import type {
  Account,
  Asset,
  BondPlan,
  ContributionPlan,
  ContributionSkip,
  FundRate,
  PlannedExpense,
  PricePoint,
  Statement,
  Transaction,
} from "@hamac/core";
import {
  AccountInput,
  AssetInput,
  BondPlanInput,
  FundRateInput,
  ManualPriceInput,
  PlanInput,
  PlannedExpenseInput,
  SkipInput,
  StatementInput,
  TransactionInput,
} from "./entities";

/**
 * Chaque procédure déclare son entrée et sa sortie avec zod.
 * Le backend valide les deux ; l'interface en déduit les types.
 * Ajouter une fonctionnalité = ajouter une entrée ici + son handler côté backend.
 */

export const SystemInfo = z.object({
  appVersion: z.string(),
  mode: z.enum(["desktop", "web"]),
  databasePath: z.string(),
  schemaVersion: z.string(),
  sqliteVersion: z.string(),
  backupsDir: z.string().nullable(),
});
export type SystemInfo = z.infer<typeof SystemInfo>;

export const SettingKey = z.enum(["ui.privacyMode", "ui.lastRoute", "ui.onboardingDone"]);
export type SettingKey = z.infer<typeof SettingKey>;

/** Tout l'espace de travail de l'utilisateur, chargé en une fois (quelques milliers de lignes au plus). */
export interface Workspace {
  params: PlanParams;
  accounts: Account[];
  assets: Asset[];
  transactions: Transaction[];
  plans: ContributionPlan[];
  skips: ContributionSkip[];
  bondPlans: BondPlan[];
  fundRates: FundRate[];
  statements: Statement[];
  plannedExpenses: PlannedExpense[];
  /** Historique allégé des cours : dernier point de chaque mois (dont le dernier cours connu). */
  prices: PricePoint[];
  priceStatus: PriceStatus | null;
}

export interface PriceStatus {
  at: string;
  updated: number;
  errors: Array<{ assetId: string; name: string; message: string }>;
}

export interface AssetCandidate {
  source: "openfigi" | "coingecko";
  kind: import("@hamac/core").AssetKind;
  name: string;
  isin: string | null;
  symbol: string | null;
  exchange: string | null;
  couponRate: number | null;
  maturityDate: string | null;
  detail: string;
}

const ok = z.object({ ok: z.literal(true) });
const byId = z.object({ id: z.string().min(1) });
// Les sorties d'entités sont construites par le backend à partir de lignes déjà validées.
const entity = <T>() => z.custom<T>(() => true);

export const procedures = {
  "system.info": { input: z.void(), output: SystemInfo },
  "settings.get": { input: z.object({ key: SettingKey }), output: z.unknown() },
  "settings.set": { input: z.object({ key: SettingKey, value: z.unknown() }), output: z.void() },

  "workspace.load": { input: z.void(), output: entity<Workspace>() },
  "workspace.createStarter": { input: z.void(), output: ok },

  "params.update": { input: PlanParams, output: PlanParams },

  "accounts.upsert": { input: AccountInput, output: entity<Account>() },
  "accounts.delete": { input: byId, output: ok },

  "assets.upsert": { input: AssetInput, output: entity<Asset>() },
  "assets.delete": { input: byId, output: ok },

  "transactions.upsert": { input: TransactionInput, output: entity<Transaction>() },
  "transactions.delete": { input: byId, output: ok },

  "plans.set": { input: PlanInput, output: entity<ContributionPlan>() },
  "plans.delete": { input: byId, output: ok },
  "skips.upsert": { input: SkipInput, output: entity<ContributionSkip>() },
  "skips.delete": { input: byId, output: ok },

  "bondPlans.upsert": { input: BondPlanInput, output: entity<BondPlan>() },
  "bondPlans.delete": { input: byId, output: ok },
  "fundRates.set": { input: FundRateInput, output: entity<FundRate>() },
  "fundRates.delete": { input: z.object({ accountId: z.string(), year: z.number().int() }), output: ok },
  "statements.upsert": { input: StatementInput, output: entity<Statement>() },
  "statements.delete": { input: byId, output: ok },
  "plannedExpenses.upsert": { input: PlannedExpenseInput, output: entity<PlannedExpense>() },
  "plannedExpenses.delete": { input: byId, output: ok },

  "prices.setManual": { input: ManualPriceInput, output: ok },
  "prices.refresh": { input: z.void(), output: entity<PriceStatus>() },
  "assets.search": { input: z.object({ query: z.string().trim().min(2).max(80) }), output: entity<{ candidates: AssetCandidate[]; errors: string[] }>() },
} as const;

export type Procedures = typeof procedures;
export type ProcName = keyof Procedures;
export type ProcInput<N extends ProcName> = z.input<Procedures[N]["input"]>;
export type ProcOutput<N extends ProcName> = z.output<Procedures[N]["output"]>;
