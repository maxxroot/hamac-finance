import { z } from "zod";
import { DISMEMBERMENTS, DOCUMENT_KINDS, ENERGY_LETTERS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, LEASE_GUARANTEE_KINDS, LEASE_KINDS, LEASE_NOTICE_BY, LOT_KINDS, NOTICE_LEVELS, PAYMENT_METHODS, PROPERTY_KINDS, PROPERTY_OWNERSHIPS, PROPERTY_TYPES, RENTAL_MODES } from "@hamac/core";
import { id, isoDate, month, money, text } from "../common";

/** Entrées validées : biens immobiliers, sociétés, lots, baux, locataires, loyers et charges. */

export const PropertyInput = z.object({
  id: id.optional(),
  kind: z.enum(PROPERTY_KINDS),
  ownership: z.enum(PROPERTY_OWNERSHIPS).default("nom_propre"),
  name: text(120).min(1, "Nom requis"),
  value: money.min(0),
  valueDate: isoDate.nullable().default(null),
  purchasePrice: money.min(0).nullable().default(null),
  purchaseDate: isoDate.nullable().default(null),
  newBuild: z.boolean().default(false),
  notaryFees: money.min(0).default(0),
  agencyFees: money.min(0).default(0),
  initialWorks: money.min(0).default(0),
  otherFees: money.min(0).default(0),
  propertyType: z.enum(PROPERTY_TYPES).nullable().default(null),
  address: text(200).default(""),
  postalCode: text(10).default(""),
  city: text(120).default(""),
  surface: z.number().positive("Surface invalide").max(1_000_000).nullable().default(null),
  rooms: z.number().int().min(0).max(999).nullable().default(null),
  bedrooms: z.number().int().min(0).max(999).nullable().default(null),
  floor: z.number().int().min(-10).max(300).nullable().default(null),
  buildYear: z.number().int().min(1000).max(2200).nullable().default(null),
  outdoor: text(120).default(""),
  parking: z.boolean().default(false),
  cellar: z.boolean().default(false),
  heating: text(120).default(""),
  coOwnership: z.boolean().default(false),
  syndic: text(120).default(""),
  dpe: z.enum(ENERGY_LETTERS).nullable().default(null),
  ges: z.enum(ENERGY_LETTERS).nullable().default(null),
  dpeDate: isoDate.nullable().default(null),
  dpeReminders: z.boolean().default(true),
  rentalMode: z.enum(RENTAL_MODES).default("vide"),
  share: z.number().gt(0, "Part détenue requise").max(1).default(1),
  companyId: id.nullable().default(null),
  dismemberment: z.enum(DISMEMBERMENTS).default("pleine"),
  usufructBirthDate: isoDate.nullable().default(null),
  usufructEnd: isoDate.nullable().default(null),
  inAllocation: z.boolean().nullable().default(null),
  classId: id.nullable().default(null),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
})
  .refine((p) => p.dismemberment === "pleine" || p.usufructBirthDate != null || p.usufructEnd != null, { path: ["usufructBirthDate"], message: "Indiquez la date de naissance de l'usufruitier, ou la fin de l'usufruit s'il est à durée fixe." });
export type PropertyInput = z.input<typeof PropertyInput>;

export const PropertySaleInput = z.object({
  id,
  saleDate: isoDate,
  salePrice: money.min(0),
  saleFees: money.min(0).default(0),
  closeLoans: z.boolean().default(true),
});

export const PropertyValueInput = z.object({
  propertyId: id,
  date: isoDate,
  value: money.min(0),
});

export const LotInput = z.object({
  id: id.optional(),
  propertyId: id,
  name: text(80).min(1, "Nom requis"),
  kind: z.enum(LOT_KINDS),
  surface: z.number().positive("Surface invalide").max(100_000).nullable().default(null),
  targetRent: money.min(0).nullable().default(null),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type LotInput = z.input<typeof LotInput>;

export const RenterInput = z
  .object({
    id: id.optional(),
    firstName: text(80).default(""),
    lastName: text(120).default(""),
    email: text(200).default(""),
    phone: text(40).default(""),
    forwardingAddress: text(300).default(""),
    comment: text(500).default(""),
  })
  .refine((r) => r.firstName !== "" || r.lastName !== "", { path: ["lastName"], message: "Indiquez le nom du locataire." });
export type RenterInput = z.input<typeof RenterInput>;

export const LeaseGuaranteeInput = z.object({
  id: id.optional(),
  kind: z.enum(LEASE_GUARANTEE_KINDS),
  name: text(120).default(""),
  contact: text(300).default(""),
  amount: money.min(0).nullable().default(null),
  until: isoDate.nullable().default(null),
  comment: text(300).default(""),
});
export type LeaseGuaranteeInput = z.input<typeof LeaseGuaranteeInput>;

export const LeaseInput = z
  .object({
    id: id.optional(),
    propertyId: id,
    /** Lot loué ; null = le seul lot du bien, créé au besoin. */
    lotId: id.nullable().default(null),
    kind: z.enum(LEASE_KINDS),
    /** Locataires du bail, dans l'ordre : créés, mis à jour ou repris par leur id. */
    renters: z.array(RenterInput).max(12).default([]),
    guarantees: z.array(LeaseGuaranteeInput).max(12).default([]),
    startDate: isoDate,
    durationMonths: z.number().int().min(1).max(600),
    rent: money.min(0),
    charges: money.min(0).default(0),
    deposit: money.min(0).default(0),
    noticeBy: z.enum(LEASE_NOTICE_BY).nullable().default(null),
    noticeDate: isoDate.nullable().default(null),
    noticeMonths: z.number().int().min(1).max(24).nullable().default(null),
    actualEnd: isoDate.nullable().default(null),
    comment: text(500).default(""),
    reminders: z.boolean().default(true),
    depositReturned: money.min(0).nullable().default(null),
    depositReturnedOn: isoDate.nullable().default(null),
    depositReason: text(200).default(""),
    landlord: text(120).default(""),
    tenantInsuranceUntil: isoDate.nullable().default(null),
    revisable: z.boolean().default(true),
    irlQuarter: z.number().int().min(1).max(4).nullable().default(null),
    landlordAddress: text(300).default(""),
    dueDay: z.number().int().min(1).max(31).default(1),
  })
  .refine((l) => (l.noticeBy == null) === (l.noticeDate == null), { path: ["noticeDate"], message: "Indiquez qui donne congé et à quelle date." })
  .refine((l) => (l.depositReturned == null) === (l.depositReturnedOn == null), { path: ["depositReturnedOn"], message: "Indiquez le montant rendu et sa date." });
export type LeaseInput = z.input<typeof LeaseInput>;

const quarter = z.string().regex(/^\d{4}-Q[1-4]$/, "Trimestre invalide");

export const LeaseRentInput = z.object({
  id: id.optional(),
  leaseId: id,
  fromMonth: month,
  rent: money.min(0),
  charges: money.min(0).default(0),
  revision: z
    .object({ anniversary: isoDate, demandDate: isoDate, previousRent: money.positive(), quarterNew: quarter, quarterOld: quarter, indexNew: z.number().positive(), indexOld: z.number().positive() })
    .nullable()
    .default(null),
});
export type LeaseRentInput = z.input<typeof LeaseRentInput>;

export const RentPaymentInput = z.object({
  id: id.optional(),
  leaseId: id,
  month,
  date: isoDate,
  amount: money.positive("Montant requis"),
  method: z.enum(PAYMENT_METHODS).default("virement"),
  comment: text(200).default(""),
});
export type RentPaymentInput = z.input<typeof RentPaymentInput>;

export const RentPaymentsInput = z.object({ payments: z.array(RentPaymentInput.omit({ id: true })).min(1).max(2_000) });
export type RentPaymentsInput = z.input<typeof RentPaymentsInput>;

export const RentWaiverInput = z.object({ leaseId: id, month, comment: text(200).default("") });
export type RentWaiverInput = z.input<typeof RentWaiverInput>;

export const RentNoticeInput = z.object({ leaseId: id, level: z.enum(NOTICE_LEVELS), sentOn: isoDate, amount: money.min(0), comment: text(200).default("") });
export type RentNoticeInput = z.input<typeof RentNoticeInput>;

export const PropertyExpenseInput = z.object({
  id: id.optional(),
  propertyId: id,
  date: isoDate,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money.positive("Montant requis"),
  label: text(120).default(""),
  yearly: z.boolean().default(false),
  untilYear: z.number().int().min(1900).max(2200).nullable().default(null),
  improvement: z.boolean().default(false),
  /** Part récupérable sur le locataire ; absente, celle proposée pour la catégorie (copropriété : réglage du plan). */
  recoverableRate: z.number().min(0).max(1).optional(),
});
export type PropertyExpenseInput = z.input<typeof PropertyExpenseInput>;

export const PropertyReminderInput = z.object({
  id: id.optional(),
  propertyId: id,
  lotId: id.nullable().default(null),
  date: isoDate,
  yearly: z.boolean().default(false),
  label: text(160).min(1, "Indiquez de quoi il s'agit"),
  comment: text(500).default(""),
  doneOn: isoDate.nullable().default(null),
});
export type PropertyReminderInput = z.input<typeof PropertyReminderInput>;

export const PropertyIncomeInput = z.object({
  id: id.optional(),
  propertyId: id,
  date: isoDate,
  category: z.enum(INCOME_CATEGORIES),
  amount: money.positive("Montant requis"),
  label: text(120).default(""),
});
export type PropertyIncomeInput = z.input<typeof PropertyIncomeInput>;

export const PropertyDocumentInput = z.object({
  id: id.optional(),
  propertyId: id,
  kind: z.enum(DOCUMENT_KINDS),
  label: text(120).min(1, "Nom requis"),
  date: isoDate.nullable().default(null),
  expiresOn: isoDate.nullable().default(null),
  location: text(300).default(""),
});
export type PropertyDocumentInput = z.input<typeof PropertyDocumentInput>;

export const CompanyInput = z.object({
  id: id.optional(),
  name: text(120).min(1, "Nom requis"),
  share: z.number().gt(0, "Part des parts requise").max(1).default(1),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
});
export type CompanyInput = z.input<typeof CompanyInput>;
