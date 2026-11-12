import { z } from "zod";
import { PlanParams, PlanParamsInput, type Account, type AccountRate, type Asset, type BondPlan, type Company, type ContributionPlan, type ContributionSkip, type CrowdProject, type FundRate, type Gift, type Goal, type Institution, type Lease, type LeaseGuarantee, type LeaseRent, type LeaseRenter, type Loan, type Lot, type OtherAsset, type OtherAssetValue, type PlannedExpense, type PricePoint, type Property, type PropertyDocument, type PropertyExpense, type PropertyIncome, type PropertyReminder, type PropertyValue, type Renter, type RentNotice, type RentPayment, type RentWaiver, type Statement, type TaxStatementAmount, type Transaction } from "@hamac/core";
import { ok, entity } from "../common";
import type { PriceStatus } from "../assets";

/** Système, réglages, espace de travail complet, paramètres du plan et sauvegardes. */

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
  /** Projets à financer. */
  goals: Goal[];
  /** Or, objets de valeur, véhicules, parts de société, sommes prêtées, et leurs estimations passées. */
  otherAssets: OtherAsset[];
  otherAssetValues: OtherAssetValue[];
  /** Ce qui se loue dans chaque bien : logement entier, chambres, annexes. */
  lots: Lot[];
  leases: Lease[];
  /** Locataires, leurs baux et les garanties des baux. */
  renters: Renter[];
  leaseRenters: LeaseRenter[];
  leaseGuarantees: LeaseGuarantee[];
  leaseRents: LeaseRent[];
  /** Loyers pointés, mois par mois, et mois remis. */
  rentPayments: RentPayment[];
  rentWaivers: RentWaiver[];
  /** Courriers de relance envoyés. */
  rentNotices: RentNotice[];
  propertyExpenses: PropertyExpense[];
  propertyValues: PropertyValue[];
  propertyIncomes: PropertyIncome[];
  propertyDocuments: PropertyDocument[];
  /** Rappels saisis à la main sur les biens loués. */
  propertyReminders: PropertyReminder[];
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

export const systemProcedures = {
  "system.info": { input: z.void(), output: SystemInfo },
  "settings.get": { input: z.object({ key: SettingKey }), output: z.unknown() },
  "settings.set": { input: z.object({ key: SettingKey, value: z.unknown() }), output: z.void() },
  "workspace.load": { input: z.void(), output: entity<Workspace>() },
  "workspace.createStarter": { input: z.void(), output: ok },
  "params.update": { input: PlanParamsInput, output: PlanParams },
  "data.export": { input: z.void(), output: entity<DataDump>() },
  "data.import": { input: z.object({ dump: z.unknown(), confirm: z.literal("REMPLACER") }), output: entity<{ tables: Record<string, number> }>() },
} as const;
