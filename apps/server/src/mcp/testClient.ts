import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { TokenScope } from "../auth/apiTokens";
import { ConfirmationStore } from "./confirmations";
import { DraftStore } from "./drafts";
import type { Call } from "./engine";
import { createMcpServer } from "./server";

/** Pour les tests : le serveur MCP branché au client officiel, en mémoire, sur un backend de test. */

export interface TestStores {
  drafts: DraftStore;
  confirmations: ConfirmationStore;
}

export const testStores = (): TestStores => ({ drafts: new DraftStore(), confirmations: new ConfirmationStore() });

export async function connectTestClient(call: Call, stores: TestStores, scope: TokenScope = "write", tenantId = "t1") {
  const server = createMcpServer({ call, scope, tenantId, ...stores, appVersion: "test" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ text: string }>)[0]!.text;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { isError: res.isError === true, text, json: res.isError ? null : (JSON.parse(text) as any) };
  };
  return { client, tool, instructions: client.getInstructions() };
}
