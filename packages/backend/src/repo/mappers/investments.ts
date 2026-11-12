import type { BondPlan, CrowdProject } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents } from "../../db/units";

/** Lignes de la base → plans obligataires et projets de crowdlending. */

export const mapBondPlan = (r: typeof t.bondPlans.$inferSelect): BondPlan => ({
  id: r.id,
  accountId: r.accountId,
  label: r.label,
  targetYear: r.targetYear,
  nominal: fromCents(r.nominalCents),
  comment: r.comment,
});

export const mapCrowdProject = (r: typeof t.crowdProjects.$inferSelect): CrowdProject => ({
  id: r.id,
  accountId: r.accountId,
  name: r.name,
  amount: fromCents(r.amountCents),
  rate: r.rate,
  startDate: r.startDate,
  termMonths: r.termMonths,
  repayment: r.repayment as CrowdProject["repayment"],
  status: r.status as CrowdProject["status"],
  statusDate: r.statusDate,
  repaidCapital: r.repaidCapitalCents == null ? null : fromCents(r.repaidCapitalCents),
  expectedRecovery: r.expectedRecoveryCents == null ? null : fromCents(r.expectedRecoveryCents),
  inAllocation: r.inAllocation,
  comment: r.comment,
  externalId: r.externalId,
  extendedTo: r.extendedTo,
});
