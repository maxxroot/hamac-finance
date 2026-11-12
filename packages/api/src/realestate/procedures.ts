import { z } from "zod";
import type { Company, Lease, LeaseRent, Lot, Property, PropertyDocument, PropertyExpense, PropertyIncome, PropertyReminder, Renter, RentNotice, RentPayment, RentWaiver } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { CompanyInput, LeaseInput, LeaseRentInput, LotInput, PropertyDocumentInput, PropertyExpenseInput, PropertyIncomeInput, PropertyInput, PropertyReminderInput, PropertySaleInput, PropertyValueInput, RenterInput, RentNoticeInput, RentPaymentInput, RentPaymentsInput, RentWaiverInput } from "./inputs";

/** Biens immobiliers, sociétés, lots, baux, locataires, loyers et charges. */

export const realestateProcedures = {
  "companies.upsert": { input: CompanyInput, output: entity<Company>() },
  "companies.delete": { input: byId, output: ok },
  "properties.upsert": { input: PropertyInput, output: entity<Property>() },
  "properties.delete": { input: byId, output: ok },
  "properties.sell": { input: PropertySaleInput, output: ok },
  "properties.cancelSale": { input: byId, output: ok },
  "propertyValues.add": { input: PropertyValueInput, output: ok },
  "propertyValues.delete": { input: byId, output: ok },
  "lots.upsert": { input: LotInput, output: entity<Lot>() },
  "lots.delete": { input: byId, output: ok },
  "renters.upsert": { input: RenterInput, output: entity<Renter>() },
  "renters.delete": { input: byId, output: ok },
  "leases.upsert": { input: LeaseInput, output: entity<Lease>() },
  "leases.delete": { input: byId, output: ok },
  "leaseRents.upsert": { input: LeaseRentInput, output: entity<LeaseRent>() },
  "leaseRents.delete": { input: byId, output: ok },
  "rentPayments.upsert": { input: RentPaymentInput, output: entity<RentPayment>() },
  /** Plusieurs loyers pointés d'un coup (« Valider le mois »), en une transaction. */
  "rentPayments.addMany": { input: RentPaymentsInput, output: z.object({ count: z.number() }) },
  "rentPayments.delete": { input: byId, output: ok },
  "rentWaivers.set": { input: RentWaiverInput, output: entity<RentWaiver>() },
  "rentWaivers.delete": { input: byId, output: ok },
  "rentNotices.add": { input: RentNoticeInput, output: entity<RentNotice>() },
  "rentNotices.delete": { input: byId, output: ok },
  "propertyExpenses.upsert": { input: PropertyExpenseInput, output: entity<PropertyExpense>() },
  "propertyExpenses.delete": { input: byId, output: ok },
  "propertyIncomes.upsert": { input: PropertyIncomeInput, output: entity<PropertyIncome>() },
  "propertyIncomes.delete": { input: byId, output: ok },
  "propertyDocuments.upsert": { input: PropertyDocumentInput, output: entity<PropertyDocument>() },
  "propertyDocuments.delete": { input: byId, output: ok },
  "propertyReminders.upsert": { input: PropertyReminderInput, output: entity<PropertyReminder>() },
  "propertyReminders.delete": { input: byId, output: ok },
} as const;
