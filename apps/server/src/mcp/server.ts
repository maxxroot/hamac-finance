import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenScope } from "../auth/apiTokens";
import type { DraftStore } from "./drafts";
import type { Call } from "./engine";
import { instructions } from "./instructions";
import { registerEntryTools, registerStatementCheck } from "./tools/entries";
import { registerImportTools } from "./tools/imports";
import { registerReadTools } from "./tools/read";
import { registrar } from "./tools/registrar";

export interface McpContext {
  /** Appels du contrat sur le backend du tenant (`Backend.dispatch`). */
  call: Call;
  scope: TokenScope;
  tenantId: string;
  drafts: DraftStore;
  appVersion: string;
}

/** Un serveur MCP pour un appel : les outils d'écriture n'existent que pour un jeton en écriture. */
export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({ name: "hamac", title: "Hamac", version: ctx.appVersion }, { instructions: instructions(ctx.scope), capabilities: { tools: {} } });
  const tool = registrar(server);
  registerReadTools(tool, ctx.call);
  registerStatementCheck(tool, ctx.call);
  if (ctx.scope === "write") {
    registerImportTools(tool, ctx.call, ctx.drafts, ctx.tenantId);
    registerEntryTools(tool, ctx.call);
  }
  return server;
}
