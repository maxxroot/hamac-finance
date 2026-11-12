import type { Company, Lease, LeaseGuarantee, LeaseRenter, LeaseRent, Lot, Renter, Property, PropertyDocument, PropertyReminder, PropertyExpense, PropertyIncome, PropertyValue, RentNotice, RentPayment, RentWaiver } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents } from "../../db/units";

/** Lignes de la base → biens, sociétés, lots, baux, locataires, loyers et charges. */

export const mapProperty = (r: typeof t.properties.$inferSelect): Property => ({
  id: r.id,
  kind: r.kind as Property["kind"],
  ownership: r.ownership as Property["ownership"],
  name: r.name,
  value: fromCents(r.valueCents),
  valueDate: r.valueDate,
  purchasePrice: r.purchasePriceCents == null ? null : fromCents(r.purchasePriceCents),
  purchaseDate: r.purchaseDate,
  newBuild: r.newBuild,
  notaryFees: fromCents(r.notaryFeesCents),
  agencyFees: fromCents(r.agencyFeesCents),
  initialWorks: fromCents(r.initialWorksCents),
  otherFees: fromCents(r.otherFeesCents),
  propertyType: r.propertyType as Property["propertyType"],
  address: r.address,
  postalCode: r.postalCode,
  city: r.city,
  surface: r.surface,
  rooms: r.rooms,
  bedrooms: r.bedrooms,
  floor: r.floor,
  buildYear: r.buildYear,
  outdoor: r.outdoor,
  parking: r.parking,
  cellar: r.cellar,
  heating: r.heating,
  coOwnership: r.coOwnership,
  syndic: r.syndic,
  dpe: r.dpe as Property["dpe"],
  ges: r.ges as Property["ges"],
  dpeDate: r.dpeDate,
  dpeReminders: r.dpeReminders,
  rentalMode: r.rentalMode as Property["rentalMode"],
  saleDate: r.saleDate,
  salePrice: r.salePriceCents == null ? null : fromCents(r.salePriceCents),
  saleFees: fromCents(r.saleFeesCents),
  share: r.share,
  companyId: r.companyId,
  dismemberment: r.dismemberment as Property["dismemberment"],
  usufructBirthDate: r.usufructBirthDate,
  usufructEnd: r.usufructEnd,
  inAllocation: r.inAllocation,
  classId: r.classId,
  comment: r.comment,
  archived: r.archived,
});

export const mapCompany = (r: typeof t.companies.$inferSelect): Company => ({ id: r.id, name: r.name, share: r.share, comment: r.comment, archived: r.archived });

export const mapLease = (r: typeof t.leases.$inferSelect): Lease => ({
  id: r.id,
  propertyId: r.propertyId,
  lotId: r.lotId,
  kind: r.kind as Lease["kind"],
  startDate: r.startDate,
  durationMonths: r.durationMonths,
  rent: fromCents(r.rentCents),
  charges: fromCents(r.chargesCents),
  deposit: fromCents(r.depositCents),
  noticeBy: r.noticeBy as Lease["noticeBy"],
  noticeDate: r.noticeDate,
  noticeMonths: r.noticeMonths,
  actualEnd: r.actualEnd,
  comment: r.comment,
  reminders: r.reminders,
  depositReturned: r.depositReturnedCents == null ? null : fromCents(r.depositReturnedCents),
  depositReturnedOn: r.depositReturnedOn,
  depositReason: r.depositReason,
  landlord: r.landlord,
  tenantInsuranceUntil: r.tenantInsuranceUntil,
  revisable: r.revisable,
  irlQuarter: r.irlQuarter,
  landlordAddress: r.landlordAddress,
  dueDay: r.dueDay,
});

export const mapLot = (r: typeof t.lots.$inferSelect): Lot => ({
  id: r.id,
  propertyId: r.propertyId,
  name: r.name,
  kind: r.kind as Lot["kind"],
  surface: r.surface,
  targetRent: r.targetRentCents == null ? null : fromCents(r.targetRentCents),
  comment: r.comment,
  archived: r.archived,
  sortOrder: r.sortOrder,
});

export const mapRenter = (r: typeof t.renters.$inferSelect): Renter => ({
  id: r.id,
  firstName: r.firstName,
  lastName: r.lastName,
  email: r.email,
  phone: r.phone,
  forwardingAddress: r.forwardingAddress,
  comment: r.comment,
});

export const mapLeaseRenter = (r: typeof t.leaseRenters.$inferSelect): LeaseRenter => ({ leaseId: r.leaseId, renterId: r.renterId, sortOrder: r.sortOrder });

export const mapLeaseGuarantee = (r: typeof t.leaseGuarantees.$inferSelect): LeaseGuarantee => ({
  id: r.id,
  leaseId: r.leaseId,
  kind: r.kind as LeaseGuarantee["kind"],
  name: r.name,
  contact: r.contact,
  amount: r.amountCents == null ? null : fromCents(r.amountCents),
  until: r.until,
  comment: r.comment,
  sortOrder: r.sortOrder,
});

export const mapPropertyReminder = (r: typeof t.propertyReminders.$inferSelect): PropertyReminder => ({ id: r.id, propertyId: r.propertyId, lotId: r.lotId, date: r.date, yearly: r.yearly, label: r.label, comment: r.comment, doneOn: r.doneOn });

export const mapLeaseRent = (r: typeof t.leaseRents.$inferSelect): LeaseRent => ({
  id: r.id,
  leaseId: r.leaseId,
  fromMonth: r.fromMonth,
  rent: fromCents(r.rentCents),
  charges: fromCents(r.chargesCents),
  revision:
    r.revisionAnniversary == null
      ? null
      : { anniversary: r.revisionAnniversary, demandDate: r.revisionDemandDate!, previousRent: fromCents(r.revisionPreviousRentCents!), quarterNew: r.revisionQuarterNew!, quarterOld: r.revisionQuarterOld!, indexNew: r.revisionIndexNew!, indexOld: r.revisionIndexOld! },
});

export const mapRentPayment = (r: typeof t.rentPayments.$inferSelect): RentPayment => ({ id: r.id, leaseId: r.leaseId, month: r.month, date: r.date, amount: fromCents(r.amountCents), method: r.method as RentPayment["method"], comment: r.comment });

export const mapRentNotice = (r: typeof t.rentNotices.$inferSelect): RentNotice => ({ id: r.id, leaseId: r.leaseId, level: r.level as RentNotice["level"], sentOn: r.sentOn, amount: fromCents(r.amountCents), comment: r.comment });

export const mapRentWaiver = (r: typeof t.rentWaivers.$inferSelect): RentWaiver => ({ id: r.id, leaseId: r.leaseId, month: r.month, comment: r.comment });

export const mapPropertyValue = (r: typeof t.propertyValues.$inferSelect): PropertyValue => ({ id: r.id, propertyId: r.propertyId, date: r.date, value: fromCents(r.valueCents) });

export const mapPropertyIncome = (r: typeof t.propertyIncomes.$inferSelect): PropertyIncome => ({ id: r.id, propertyId: r.propertyId, date: r.date, category: r.category as PropertyIncome["category"], amount: fromCents(r.amountCents), label: r.label });

export const mapPropertyDocument = (r: typeof t.propertyDocuments.$inferSelect): PropertyDocument => ({ id: r.id, propertyId: r.propertyId, kind: r.kind as PropertyDocument["kind"], label: r.label, date: r.date, expiresOn: r.expiresOn, location: r.location });

export const mapPropertyExpense = (r: typeof t.propertyExpenses.$inferSelect): PropertyExpense => ({
  id: r.id,
  propertyId: r.propertyId,
  date: r.date,
  category: r.category as PropertyExpense["category"],
  amount: fromCents(r.amountCents),
  label: r.label,
  yearly: r.yearly,
  untilYear: r.untilYear,
  improvement: r.improvement,
});
