import type { ConfirmationStore } from "../../confirmations";
import type { Call } from "../../engine";
import type { ToolRegistrar } from "../registrar";
import { registerTaxEstimateTools } from "./_estimate";
import { registerTaxReportTool } from "./_report";
import { registerTaxStatementTools } from "./_statement";

/** Fiscalité : récapitulatif pour la déclaration, estimations, fin d'année, paramètres ; saisie des IFU en deux temps. */
export function registerTaxTools(tool: ToolRegistrar, call: Call, write: { confirmations: ConfirmationStore; tenantId: string } | null): void {
  registerTaxReportTool(tool, call);
  registerTaxEstimateTools(tool, call);
  if (write) registerTaxStatementTools(tool, call, write.confirmations, write.tenantId);
}
