import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { rawFor } from "@hamac/backend";
import { testProvider } from "@hamac/backend/testkit";
import { createApp } from "./app";

/** Jetons d'accès et route /api/mcp, de bout en bout par HTTP. */

type App = Awaited<ReturnType<typeof createApp>>;
const SETUP = "code-installation-test";
const PASSWORD = "motdepasse-long";
let current: App | null = null;
afterEach(async () => {
  await current?.close();
  current = null;
});

async function server(mcp = true) {
  current = await createApp({ provider: testProvider(), dataDir: null, signup: "open", secureCookies: false, trustProxy: true, staticDir: null, appVersion: "test", autoRefreshPrices: false, setupCode: SETUP, mcp });
  await rawFor(await testProvider().session()).exec("TRUNCATE comptes.users, comptes.tenants, comptes.sessions, comptes.invites, comptes.api_tokens CASCADE");
  return current;
}

/** Un compte avec sa session, comme un navigateur. */
async function account(s: App, email: string) {
  let cookie = "";
  const req = async (method: string, path: string, body?: unknown) => {
    const res = await s.app.request(path, { method, headers: { "content-type": "application/json", "x-hamac": "1", "x-forwarded-for": "1.1.1.1", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0]!;
    return { status: res.status, json: (await res.json()) as any };
  };
  expect((await req("POST", "/api/auth/signup", { email, password: PASSWORD, invite: SETUP })).status).toBe(200);
  return { req, cookie: () => cookie };
}

/** Un client MCP réduit au protocole : JSON-RPC sur POST, réponse JSON. */
function mcp(s: App, token: string | null, headers: Record<string, string> = {}) {
  let id = 0;
  return async (method: string, params: unknown = {}) => {
    const res = await s.app.request("/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    return { status: res.status, headers: res.headers, json: (await res.json().catch(() => null)) as any };
  };
}

const INIT = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } };
const toolNames = (r: { json: any }) => (r.json.result.tools as Array<{ name: string }>).map((t) => t.name);

describe("jetons d'accès", () => {
  it("création avec le mot de passe ; le jeton n'est montré qu'une fois", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    expect((await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "read", days: 90, password: "faux-mot-de-passe" })).status).toBe(400);
    expect((await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "admin", days: 90, password: PASSWORD })).status).toBe(400);
    const created = await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "read", days: 90, password: PASSWORD });
    expect(created.status).toBe(200);
    expect(created.json.token).toMatch(/^hamac_[A-Za-z0-9_-]{43}$/);
    const list = await a.req("GET", "/api/auth/tokens");
    expect(list.json).toMatchObject({ enabled: true, tokens: [{ name: "Claude", scope: "read", lastUsedAt: null }] });
    expect(JSON.stringify(list.json)).not.toContain(created.json.token);
  });

  it("sans session ni en-tête anti-CSRF : refusé", async () => {
    const s = await server();
    const res = await s.app.request("/api/auth/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(403);
    expect((await s.app.request("/api/auth/tokens")).status).toBe(401);
  });
});

describe("/api/mcp", () => {
  it("sans jeton, jeton inconnu ou cookie seul : 401 avec WWW-Authenticate", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    const none = await mcp(s, null)("initialize", INIT);
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe('Bearer realm="hamac"');
    expect((await mcp(s, "hamac_inconnu")("initialize", INIT)).status).toBe(401);
    expect((await mcp(s, null, { cookie: a.cookie() })("initialize", INIT)).status).toBe(401);
  });

  it("jeton en lecture : initialisation, outils de lecture seulement, données du bon compte", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    const b = await account(s, "b@exemple.fr");
    await a.req("POST", "/api/rpc/accounts.upsert", { kind: "pea", name: "PEA de A" });
    await b.req("POST", "/api/rpc/accounts.upsert", { kind: "cto", name: "CTO de B" });
    const { token } = (await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "read", days: 30, password: PASSWORD })).json;
    const rpc = mcp(s, token);
    const init = await rpc("initialize", INIT);
    expect(init.status).toBe(200);
    expect(init.json.result.serverInfo).toMatchObject({ name: "hamac", version: "test" });
    expect(toolNames(await rpc("tools/list"))).not.toContain("prepare_import");
    const listed = await rpc("tools/call", { name: "list_accounts", arguments: {} });
    expect(JSON.parse(listed.json.result.content[0].text).map((x: { name: string }) => x.name)).toEqual(["PEA de A"]);
    expect((await a.req("GET", "/api/auth/tokens")).json.tokens[0].lastUsedAt).not.toBeNull();
  });

  it("client MCP officiel en HTTP : connexion, consignes, appel d'outil", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    await a.req("POST", "/api/rpc/accounts.upsert", { kind: "livret", livretType: "LIVRET_A", name: "Livret A" });
    const { token } = (await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "write", days: 30, password: PASSWORD })).json;
    const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
      fetch: (url, init) => Promise.resolve(s.app.request(String(url), init)),
    });
    const client = new Client({ name: "test", version: "1" });
    await client.connect(transport);
    expect(client.getInstructions()).toContain("prepare_import");
    const res = await client.callTool({ name: "list_accounts", arguments: {} });
    expect(JSON.parse((res.content as Array<{ text: string }>)[0]!.text)[0]).toMatchObject({ name: "Livret A", kind: "livret" });
    await client.close();
  });

  it("jeton en écriture : outils d'import présents", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    const { token } = (await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "write", days: 30, password: PASSWORD })).json;
    expect(toolNames(await mcp(s, token)("tools/list"))).toEqual(expect.arrayContaining(["prepare_import", "apply_import", "undo_import"]));
  });

  it("autre origine refusée ; seule la méthode POST est acceptée", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    const { token } = (await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "read", days: 30, password: PASSWORD })).json;
    expect((await mcp(s, token, { origin: "https://autre-site.exemple" })("initialize", INIT)).status).toBe(403);
    expect((await mcp(s, token, { origin: "http://localhost" })("initialize", INIT)).status).toBe(200);
    const get = await s.app.request("/api/mcp", { headers: { authorization: `Bearer ${token}` } });
    expect(get.status).toBe(405);
  });

  it("révocation, changement de mot de passe : le jeton ne marche plus", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    const first = (await a.req("POST", "/api/auth/tokens", { name: "Un", scope: "read", days: 30, password: PASSWORD })).json;
    const second = (await a.req("POST", "/api/auth/tokens", { name: "Deux", scope: "read", days: 30, password: PASSWORD })).json;
    expect((await a.req("POST", "/api/auth/tokens/revoke", { id: first.id })).status).toBe(200);
    expect((await mcp(s, first.token)("initialize", INIT)).status).toBe(401);
    expect((await mcp(s, second.token)("initialize", INIT)).status).toBe(200);
    await a.req("POST", "/api/auth/password", { current: PASSWORD, next: "nouveau-mot-de-passe" });
    expect((await mcp(s, second.token)("initialize", INIT)).status).toBe(401);
  });

  it("un compte ne révoque pas le jeton d'un autre", async () => {
    const s = await server();
    const a = await account(s, "a@exemple.fr");
    const b = await account(s, "b@exemple.fr");
    const { id, token } = (await a.req("POST", "/api/auth/tokens", { name: "A", scope: "read", days: 30, password: PASSWORD })).json;
    expect((await b.req("POST", "/api/auth/tokens/revoke", { id })).status).toBe(404);
    expect((await mcp(s, token)("initialize", INIT)).status).toBe(200);
  });

  it("assistants coupés sur l'instance (HAMAC_MCP=0) : ni route ni création de jeton", async () => {
    const s = await server(false);
    const a = await account(s, "a@exemple.fr");
    expect((await a.req("POST", "/api/auth/tokens", { name: "Claude", scope: "read", days: 30, password: PASSWORD })).status).toBe(403);
    expect((await a.req("GET", "/api/auth/tokens")).json).toEqual({ enabled: false, tokens: [] });
    expect((await mcp(s, "hamac_x")("initialize", INIT)).status).toBe(404);
  });
});
