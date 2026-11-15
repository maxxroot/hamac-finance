import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer, type McpContext } from "./server";

/** Un import CSV de plusieurs années, encodé en JSON, avec de la marge. */
export const MAX_MCP_BODY = 8 * 1024 * 1024;

/**
 * Une requête MCP, sans état (décision 0009) : un serveur et un transport par requête, réponse JSON.
 * L'authentification et les limites sont faites avant, dans `http/app.ts`.
 */
export async function handleMcpRequest(request: Request, ctx: McpContext): Promise<Response> {
  const server = createMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: MAX_MCP_BODY });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close().catch(() => undefined);
  }
}
