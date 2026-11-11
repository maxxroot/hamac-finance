import { z } from "zod";
import { PRICE_PROVIDERS, PlanParams, PlanParamsInput, type PriceProvider } from "@hamac/core";
import type {
  AccountRate,
  Institution,
  Account,
  Asset,
  BondPlan,
  Company,
  ContributionPlan,
  ContributionSkip,
  FundRate,
  Gift,
  CrowdProject,
  IrlData,
  Lease,
  LeaseRent,
  OtherAsset,
  OtherAssetValue,
  Loan,
  PlannedExpense,
  LoanPrepayment,
  PropertyDocument,
  PropertyExpense,
  PropertyIncome,
  PropertyValue,
  RentException,
  Property,
  PricePoint,
  Statement,
  TaxStatementAmount,
  Transaction,
} from "@hamac/core";
import {
  AccountInput,
  AccountRateInput,
  AssetInput,
  MarketSeriesInput,
  BondPlanInput,
  CompanyInput,
  InstitutionInput,
  FundRateInput,
  GiftInput,
  ManualPriceInput,
  PlanInput,
  CrowdImportInput,
  CrowdProjectInput,
  LeaseInput,
  OtherAssetInput,
  OtherAssetValueInput,
  LeaseRentInput,
  LoanInput,
  PlannedExpenseInput,
  LoanPrepaymentInput,
  PropertyDocumentInput,
  PropertyExpenseInput,
  PropertyIncomeInput,
  PropertyInput,
  PropertySaleInput,
  PropertyValueInput,
  RentExceptionInput,
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
  databasePath: z.string(),
  schemaVersion: z.string(),
  databaseVersion: z.string(),
  backupsDir: z.string().nullable(),
});
export type SystemInfo = z.infer<typeof SystemInfo>;

export const SettingKey = z.enum(["ui.privacyMode", "ui.theme", "ui.lastRoute", "ui.onboardingDone", "import.formats", "taxes.yearEnd"]);
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
  properties: Property[];
  /** Sociétés (SCI) qui détiennent des biens. */
  companies: Company[];
  /** Donations faites et reçues. */
  gifts: Gift[];
  /** Or, objets de valeur, véhicules, parts de société, sommes prêtées, et leurs estimations passées. */
  otherAssets: OtherAsset[];
  otherAssetValues: OtherAssetValue[];
  leases: Lease[];
  leaseRents: LeaseRent[];
  rentExceptions: RentException[];
  propertyExpenses: PropertyExpense[];
  propertyValues: PropertyValue[];
  propertyIncomes: PropertyIncome[];
  propertyDocuments: PropertyDocument[];
  crowdProjects: CrowdProject[];
  loans: Loan[];
  institutions: Institution[];
  /** Montants lus sur les documents fiscaux des établissements. */
  taxStatements: TaxStatementAmount[];
  accountRates: AccountRate[];
  /** Historique allégé des cours : dernier point de chaque mois (dont le dernier cours connu). */
  prices: PricePoint[];
  priceStatus: PriceStatus | null;
}

/** Sauvegarde complète et portable, lignes brutes de chaque table. */
export interface DataDump {
  format: "hamac";
  version: 1;
  /** Absent ou « sqlite » : sauvegarde de l'ancienne application de bureau. */
  engine?: "sqlite" | "postgres";
  schemaVersion: string;
  exportedAt: string;
  appVersion: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

export interface PriceStatus {
  at: string;
  updated: number;
  errors: Array<{ assetId: string; name: string; message: string }>;
  /** Détail par titre à cours automatique : source qui a répondu, dernier cours, essais échoués. */
  assets?: Array<{ assetId: string; name: string; provider: PriceProvider | null; lastDate: string | null; message: string | null; tried: Array<{ provider: PriceProvider; message: string }> }>;
  /** Prochaine actualisation automatique. */
  nextAt?: string;
  twelveData?: { used: number; limit: number; assets: number; intervalMinutes: number } | null;
}

/** Réglages des sources de cours, tels que vus par l'interface (la clé n'en sort jamais entière). */
export interface MarketSettings {
  /** Réservé à l'administrateur de l'instance. */
  canEdit: boolean;
  order: Array<{ id: PriceProvider; enabled: boolean }>;
  twelveData: {
    /** La clé elle-même reste sur le serveur (fichier .env). */
    configured: boolean;
    used: number;
    limit: number;
    /** Titres pouvant passer par Twelve Data à chaque actualisation. */
    assets: number;
    intervalMinutes: number;
  };
}

/** Historique long d'un titre, pour le comparer sans l'ajouter au portefeuille. */
export interface MarketSeries {
  /** Vrai si les dividendes distribués sont inclus, comme s'ils étaient réinvestis. */
  dividends: boolean;
  points: Array<{ date: string; price: number }>;
}

export interface AssetCandidate {
  source: "openfigi" | "coingecko" | "euronext";
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

  "params.update": { input: PlanParamsInput, output: PlanParams },

  "accounts.upsert": { input: AccountInput, output: entity<Account>() },
  "accounts.delete": { input: byId, output: ok },
  "accountRates.set": { input: AccountRateInput, output: ok },
  "accountRates.delete": { input: byId, output: ok },

  "assets.upsert": { input: AssetInput, output: entity<Asset>() },
  "assets.delete": { input: byId, output: ok },

  "transactions.upsert": { input: TransactionInput, output: entity<Transaction>() },
  "transactions.delete": { input: byId, output: ok },
  /** Achat d'un titre pas encore connu : crée le titre et l'opération ensemble (tout ou rien). */
  "transactions.createWithAsset": { input: z.object({ asset: AssetInput, transaction: TransactionInput }), output: entity<{ asset: Asset; transaction: Transaction }>() },

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
  "crowdProjects.upsert": { input: CrowdProjectInput, output: entity<CrowdProject>() },
  "crowdProjects.delete": { input: byId, output: ok },
  "crowdProjects.applyImport": { input: CrowdImportInput, output: entity<{ transactions: number; projects: number }>() },
  "otherAssets.upsert": { input: OtherAssetInput, output: entity<OtherAsset>() },
  "otherAssets.delete": { input: byId, output: ok },
  "otherAssetValues.add": { input: OtherAssetValueInput, output: ok },
  "otherAssetValues.delete": { input: byId, output: ok },
  "gifts.upsert": { input: GiftInput, output: entity<Gift>() },
  "gifts.delete": { input: byId, output: ok },
  "companies.upsert": { input: CompanyInput, output: entity<Company>() },
  "companies.delete": { input: byId, output: ok },
  "properties.upsert": { input: PropertyInput, output: entity<Property>() },
  "properties.delete": { input: byId, output: ok },
  "properties.sell": { input: PropertySaleInput, output: ok },
  "properties.cancelSale": { input: byId, output: ok },
  "propertyValues.add": { input: PropertyValueInput, output: ok },
  "propertyValues.delete": { input: byId, output: ok },
  "leases.upsert": { input: LeaseInput, output: entity<Lease>() },
  "leases.delete": { input: byId, output: ok },
  "leaseRents.upsert": { input: LeaseRentInput, output: entity<LeaseRent>() },
  "leaseRents.delete": { input: byId, output: ok },
  "rentExceptions.set": { input: RentExceptionInput, output: entity<RentException>() },
  "rentExceptions.delete": { input: byId, output: ok },
  "propertyExpenses.upsert": { input: PropertyExpenseInput, output: entity<PropertyExpense>() },
  "propertyExpenses.delete": { input: byId, output: ok },
  "propertyIncomes.upsert": { input: PropertyIncomeInput, output: entity<PropertyIncome>() },
  "propertyIncomes.delete": { input: byId, output: ok },
  "propertyDocuments.upsert": { input: PropertyDocumentInput, output: entity<PropertyDocument>() },
  "propertyDocuments.delete": { input: byId, output: ok },
  "loanPrepayments.upsert": { input: LoanPrepaymentInput, output: entity<LoanPrepayment>() },
  "loanPrepayments.delete": { input: byId, output: ok },
  "loans.upsert": { input: LoanInput, output: entity<Loan>() },
  "loans.delete": { input: byId, output: ok },

  "prices.setManual": { input: ManualPriceInput, output: ok },
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

  "transactions.bulkCreate": {
    input: z.object({ items: z.array(TransactionInput).min(1).max(5000) }),
    output: entity<{ created: number; errors: Array<{ index: number; message: string }> }>(),
  },
  "data.export": { input: z.void(), output: entity<DataDump>() },
  "data.import": { input: z.object({ dump: z.unknown(), confirm: z.literal("REMPLACER") }), output: entity<{ tables: Record<string, number> }>() },

  "prices.refresh": { input: z.void(), output: entity<PriceStatus>() },
  "market.settings": { input: z.void(), output: entity<MarketSettings>() },
  "market.irl": { input: z.void(), output: entity<IrlData>() },
  "market.configure": {
    input: z.object({
      order: z.array(z.object({ id: z.enum(PRICE_PROVIDERS), enabled: z.boolean() })),
    }),
    output: entity<MarketSettings>(),
  },
  "assets.search": { input: z.object({ query: z.string().trim().min(2).max(80) }), output: entity<{ candidates: AssetCandidate[]; errors: string[] }>() },
  "market.series": { input: MarketSeriesInput, output: entity<MarketSeries>() },
} as const;

export type Procedures = typeof procedures;
export type ProcName = keyof Procedures;
export type ProcInput<N extends ProcName> = z.input<Procedures[N]["input"]>;
export type ProcOutput<N extends ProcName> = z.output<Procedures[N]["output"]>;
