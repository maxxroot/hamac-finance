import { InstitutionProtection, InstitutionTax, NO_INSTITUTION_TAX, NO_PROTECTION, Offers, type Account, type AccountKind, type FundRate, type Institution, type InstitutionKind, type LivretType, type PerKind, type Statement } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents, fromCentsOrNull } from "../../db/units";

/** Lignes de la base → comptes, établissements, relevés et taux servis. */

export function mapAccount(r: typeof t.accounts.$inferSelect): Account {
  return {
    id: r.id,
    kind: r.kind as AccountKind,
    livretType: (r.livretType as LivretType | null) ?? null,
    perKind: (r.perKind as PerKind | null) ?? null,
    name: r.name,
    institutionId: r.institutionId,
    openedOn: r.openedOn,
    depositCeiling: fromCentsOrNull(r.depositCeilingCents),
    rate: r.rate,
    role: r.role,
    beneficiaryClause: r.beneficiaryClause,
    entryFeeRate: r.entryFeeRate,
    managementFeeRate: r.managementFeeRate,
    monthsToInvest: r.monthsToInvest,
    inAllocation: r.inAllocation,
    defaultAssetId: r.defaultAssetId,
    share: r.share,
    sortOrder: r.sortOrder,
    archived: r.archived,
  };
}

export const mapFundRate = (r: typeof t.fundRates.$inferSelect): FundRate => ({ ...r });

export const mapStatement = (r: typeof t.statements.$inferSelect): Statement => ({
  id: r.id,
  accountId: r.accountId,
  date: r.date,
  value: fromCents(r.valueCents),
  comment: r.comment,
});

export function parseInstitutionTax(raw: string): InstitutionTax {
  const parsed = InstitutionTax.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : NO_INSTITUTION_TAX;
}

export function parseProtection(raw: string): InstitutionProtection {
  const parsed = InstitutionProtection.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : NO_PROTECTION;
}

export function mapInstitution(r: typeof t.institutions.$inferSelect): Institution {
  // Offres validées à la lecture : une donnée ancienne ou incomplète reçoit ses valeurs par défaut.
  const parsed = Offers.safeParse(JSON.parse(r.offers));
  return { id: r.id, name: r.name, kind: r.kind as InstitutionKind, website: r.website, score: r.score, comment: r.comment, offers: parsed.success ? parsed.data : {}, tax: parseInstitutionTax(r.tax), protection: parseProtection(r.protection) };
}
