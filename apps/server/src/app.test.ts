import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, type SignupMode } from "./app";

let current: ReturnType<typeof createApp> | null = null;
afterEach(() => current?.close());

function server(signup: SignupMode = "invite") {
  current = createApp({ dataDir: mkdtempSync(join(tmpdir(), "hamac-srv-")), signup, secureCookies: false, staticDir: null, appVersion: "test", autoRefreshPrices: false });
  return current;
}

/** Petit client : garde le cookie de session comme un navigateur. */
function client(s: ReturnType<typeof createApp>, ipAddr = "1.1.1.1") {
  let cookie = "";
  const req = async (method: string, path: string, body?: unknown, headers: Record<string, string> = { "x-hamac": "1" }) => {
    const res = await s.app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": ipAddr, ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  return {
    req,
    rpc: (name: string, input?: unknown) => req("POST", `/api/rpc/${name}`, input ?? null),
  };
}

describe("serveur web", () => {
  it("premier compte sans invitation, puis invitation obligatoire et à usage unique", async () => {
    const s = server();
    const admin = client(s);
    expect((await admin.req("POST", "/api/auth/signup", { email: "admin@exemple.fr", password: "motdepasse-long" })).status).toBe(200);

    const friend = client(s, "2.2.2.2");
    expect((await friend.req("POST", "/api/auth/signup", { email: "ami@exemple.fr", password: "motdepasse-long" })).status).toBe(403);
    const code = s.users.createInvite();
    expect((await friend.req("POST", "/api/auth/signup", { email: "ami@exemple.fr", password: "motdepasse-long", invite: code })).status).toBe(200);
    const other = client(s, "3.3.3.3");
    expect((await other.req("POST", "/api/auth/signup", { email: "autre@exemple.fr", password: "motdepasse-long", invite: code })).status).toBe(403);
  });

  it("chaque utilisateur a sa propre base, totalement isolée", async () => {
    const s = server("open");
    const a = client(s, "1.1.1.1");
    const b = client(s, "2.2.2.2");
    await a.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "motdepasse-long" });
    await b.req("POST", "/api/auth/signup", { email: "b@exemple.fr", password: "motdepasse-long" });
    await a.rpc("workspace.createStarter");
    const wa = await a.rpc("workspace.load");
    const wb = await b.rpc("workspace.load");
    expect(((wa.json.data as { accounts: unknown[] }).accounts).length).toBe(7);
    expect(((wb.json.data as { accounts: unknown[] }).accounts).length).toBe(0);
    const info = await a.rpc("system.info");
    expect((info.json.data as { mode: string; databasePath: string }).mode).toBe("web");
    expect((info.json.data as { databasePath: string }).databasePath).not.toMatch(/sqlite/);
  });

  it("refuse l'API sans session, et sans l'en-tête anti-CSRF", async () => {
    const s = server("open");
    const anon = client(s);
    expect((await anon.rpc("workspace.load")).status).toBe(401);
    await anon.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "motdepasse-long" });
    expect((await anon.rpc("workspace.load")).status).toBe(200);
    expect((await anon.req("POST", "/api/rpc/workspace.load", null, {})).status).toBe(403);
  });

  it("connexion, mauvais mot de passe, déconnexion", async () => {
    const s = server("open");
    const c = client(s);
    await c.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "motdepasse-long" });
    await c.req("POST", "/api/auth/logout");
    expect((await c.req("GET", "/api/auth/me")).status).toBe(401);
    expect((await c.req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "faux-mot-de-passe" })).status).toBe(401);
    expect((await c.req("POST", "/api/auth/login", { email: "A@Exemple.fr", password: "motdepasse-long" })).status).toBe(200);
    expect((await c.req("GET", "/api/auth/me")).json).toEqual({ email: "a@exemple.fr" });
  });

  it("refuse un mot de passe trop court et limite les tentatives", async () => {
    const s = server("open");
    const c = client(s);
    expect((await c.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "court" })).status).toBe(400);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await c.req("POST", "/api/auth/login", { email: "x@exemple.fr", password: "nimportequoi" })).status;
    expect(last).toBe(429);
  });
});
