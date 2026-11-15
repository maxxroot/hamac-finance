import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenScope } from "../auth/apiTokens";
import type { ConfirmationStore } from "./confirmations";
import type { DraftStore } from "./drafts";
import type { Call } from "./engine";
import { instructions } from "./instructions";
import { registerPrompts } from "./prompts";
import { registerAccountTools } from "./tools/accounts";
import { registerAssetTools } from "./tools/assets";
import { registerDeletionTools } from "./tools/deletions";
import { registerImportTools } from "./tools/imports";
import { registerInstitutionTools } from "./tools/institutions";
import { registerJournalTools } from "./tools/journal";
import { registrar } from "./tools/registrar";
import { registerStatementTools } from "./tools/statements";
import { registerSummaryTools } from "./tools/summary";
import { registerTaxTools } from "./tools/tax";

export interface McpContext {
  /** Appels du contrat sur le backend du tenant (`Backend.dispatch`). */
  call: Call;
  scope: TokenScope;
  tenantId: string;
  drafts: DraftStore;
  confirmations: ConfirmationStore;
  appVersion: string;
}

/** Un serveur MCP pour un appel : les outils d'écriture n'existent que pour un jeton en écriture. */
export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({ name: "hamac", title: "Hamac", version: ctx.appVersion }, { instructions: instructions(ctx.scope), capabilities: { tools: {}, prompts: {} } });
  const tool = registrar(server);
  const canWrite = ctx.scope === "write";
  registerSummaryTools(tool, ctx.call);
  registerInstitutionTools(tool, ctx.call, canWrite);
  registerAccountTools(tool, ctx.call, canWrite);
  registerAssetTools(tool, ctx.call, canWrite);
  registerJournalTools(tool, ctx.call, canWrite);
  registerStatementTools(tool, ctx.call, canWrite);
  registerTaxTools(tool, ctx.call, canWrite ? { confirmations: ctx.confirmations, tenantId: ctx.tenantId } : null);
  registerPrompts(server, ctx.scope);
  if (canWrite) {
    registerImportTools(tool, ctx.call, ctx.drafts, ctx.tenantId);
    registerDeletionTools(tool, ctx.call, ctx.confirmations, ctx.tenantId);
  }
  return server;
}
