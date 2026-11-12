import type { BondPlan, CrowdProject } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { BondPlanInput, CrowdImportInput, CrowdProjectInput } from "./inputs";

/** Obligations gardées jusqu'à l'échéance et crowdlending. */

export const investmentsProcedures = {
  "bondPlans.upsert": { input: BondPlanInput, output: entity<BondPlan>() },
  "bondPlans.delete": { input: byId, output: ok },
  "crowdProjects.upsert": { input: CrowdProjectInput, output: entity<CrowdProject>() },
  "crowdProjects.delete": { input: byId, output: ok },
  "crowdProjects.applyImport": { input: CrowdImportInput, output: entity<{ transactions: number; projects: number }>() },
} as const;
