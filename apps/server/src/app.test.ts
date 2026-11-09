import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { rawFor } from "@hamac/backend";
import { testProvider } from "@hamac/backend/testkit";
import { createApp, type SignupMode } from "./app";

type App = Awaited<ReturnType<typeof createApp>>;
const SETUP = "code-installation-test";
let current: App | null = null;
afterEach(async () => {
  await current?.close();
  current = null;
});

async function server(signup: SignupMode = "invite", trustProxy = true) {
  current = await createApp({ provider: testProvider(), dataDir: null, signup, secureCookies: false, trustProxy, staticDir: null, appVersion: "test", autoRefreshPrices: false, setupCode: SETUP });
  await rawFor(await testProvider().session()).exec("TRUNCATE comptes.users, comptes.tenants, comptes.sessions, comptes.invites CASCADE");
  return current;
}

/** Petit client : garde le cookie de session comme un navigateur. */
function client(s: App, ipAddr = "1.1.1.1") {
  let cookie = "";
  const req = async (method: string, path: string, body?: unknown, headers: Record<string, string> = { "x-hamac": "1" }) => {
    const res = await s.app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": ipAddr, ...(cookie ? { cookie } : {}), ...headers },
      // Le premier compte de chaque instance de test utilise le code d'installation.
      body: body === undefined ? undefined : JSON.stringify(path.endsWith("/signup") ? { invite: SETUP, ...(body as object) } : body),
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

const SIGNUP = { method: "POST", headers: { "content-type": "application/json", "x-hamac": "1" }, body: JSON.stringify({ email: "a@exemple.fr", password: "motdepasse-long", invite: SETUP }) };

describe("HTTPS", () => {
  it("refuse le HTTP simple hors de cette machine, sauf autorisation explicite", async () => {
    const s = await server("open", false);
    const res = await s.app.request("http://hamac.exemple.fr/api/auth/signup", SIGNUP);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Connexion refusée : ouvrez Hamac en HTTPS." });
    expect((await s.app.request("http://hamac.exemple.fr/api/auth/config")).status).toBe(200);
  });

  it("derrière le proxy : cookie __Host- Secure et HSTS ; X-Forwarded-Proto ignoré sans proxy de confiance", async () => {
    const s = await server("open", true);
    const res = await s.app.request("http://hamac.exemple.fr/api/auth/signup", { ...SIGNUP, headers: { ...SIGNUP.headers, "x-forwarded-proto": "https", "x-forwarded-for": "1.1.1.1" } });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^__Host-hamac_session=/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Strict/);
    expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const me = await s.app.request("http://hamac.exemple.fr/api/auth/me", { headers: { cookie: cookie.split(";")[0]!, "x-forwarded-proto": "https" } });
    expect(await me.json()).toEqual({ email: "a@exemple.fr" });

    const direct = await server("open", false);
    expect((await direct.app.request("http://hamac.exemple.fr/api/auth/signup", { ...SIGNUP, headers: { ...SIGNUP.headers, "x-forwarded-proto": "https" } })).status).toBe(403);
  });

  it("en local, le HTTP reste possible, sans cookie Secure (refusé par Safari sur localhost)", async () => {
    const s = await server("open", false);
    const res = await s.app.request("/api/auth/signup", SIGNUP);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^hamac_session=/);
    expect(res.headers.get("set-cookie")).not.toMatch(/Secure/);
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });
});

describe("serveur web", () => {
  it("le premier compte exige le code d'installation, valable une seule fois", async () => {
    const s = await server("open");
    expect((await client(s).req("POST", "/api/auth/signup", { email: "pirate@exemple.fr", password: "motdepasse-long", invite: "" })).status).toBe(403);
    expect((await client(s, "2.2.2.2").req("POST", "/api/auth/signup", { email: "pirate@exemple.fr", password: "motdepasse-long", invite: "au-hasard" })).status).toBe(403);
    expect(await s.users.count()).toBe(0);
    expect((await client(s, "3.3.3.3").req("POST", "/api/auth/signup", { email: "admin@exemple.fr", password: "motdepasse-long" })).status).toBe(200);
    expect((await s.users.list())[0]).toMatchObject({ email: "admin@exemple.fr", isAdmin: true });
  });

  it("une ancienne empreinte scrypt est convertie en Argon2id à la connexion", async () => {
    const s = await server("open");
    const c = client(s);
    await c.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "motdepasse-long" });
    const db = rawFor(await testProvider().session());
    const salt = randomBytes(16);
    await db.run("UPDATE comptes.users SET password_hash = ?", [`scrypt$${salt.toString("base64")}$${scryptSync("ancien-mot-de-passe", salt, 64, { N: 16384, r: 8, p: 1 }).toString("base64")}`]);
    expect((await c.req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "ancien-mot-de-passe" })).status).toBe(200);
    expect((await db.get<{ h: string }>("SELECT password_hash AS h FROM comptes.users"))?.h).toMatch(/^\$argon2id\$/);
    expect((await c.req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "ancien-mot-de-passe" })).status).toBe(200);
  });

  it("premier compte avec son code, puis invitation obligatoire et à usage unique", async () => {
    const s = await server();
    const admin = client(s);
    expect((await admin.req("POST", "/api/auth/signup", { email: "admin@exemple.fr", password: "motdepasse-long" })).status).toBe(200);

    const friend = client(s, "2.2.2.2");
    expect((await friend.req("POST", "/api/auth/signup", { email: "ami@exemple.fr", password: "motdepasse-long" })).status).toBe(403);
    const code = await s.users.createInvite();
    expect((await friend.req("POST", "/api/auth/signup", { email: "ami@exemple.fr", password: "motdepasse-long", invite: code })).status).toBe(200);
    const other = client(s, "3.3.3.3");
    expect((await other.req("POST", "/api/auth/signup", { email: "autre@exemple.fr", password: "motdepasse-long", invite: code })).status).toBe(403);
  });

  const login = (c: ReturnType<typeof client>, email: string, password = "mauvais") => c.req("POST", "/api/auth/login", { email, password });

  it("sans proxy de confiance, changer X-Forwarded-For ne contourne pas la limite", async () => {
    const s = await server("open", false);
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await login(client(s, `9.9.9.${i}`), "inconnu@exemple.fr")).status;
    expect(last).toBe(429);
  });

  it("derrière un proxy : seule l'adresse ajoutée par le proxy compte", async () => {
    const s = await server("open", true);
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await login(client(s, `${i}.1.1.1, 7.7.7.7`), `a${i}@exemple.fr`)).status;
    expect(last).toBe(429);
    expect((await login(client(s, "8.8.8.8"), "b@exemple.fr")).status).toBe(401);
  });

  it("un même compte visé depuis 20 adresses est bloqué ; une connexion réussie remet à zéro", async () => {
    const s = await server("open", true);
    expect((await client(s, "1.0.0.1").req("POST", "/api/auth/signup", { email: "cible@exemple.fr", password: "motdepasse-long" })).status).toBeLessThan(300);
    for (let i = 0; i < 19; i++) await login(client(s, `2.0.0.${i}`), "cible@exemple.fr");
    expect((await login(client(s, "3.0.0.1"), "cible@exemple.fr", "motdepasse-long")).status).toBe(200);
    for (let i = 0; i < 20; i++) await login(client(s, `4.0.0.${i}`), "cible@exemple.fr");
    expect((await login(client(s, "5.0.0.1"), "cible@exemple.fr", "motdepasse-long")).status).toBe(429);
  });

  it("chaque utilisateur a sa propre base, totalement isolée", async () => {
    const s = await server("open");
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
    expect((info.json.data as { databasePath: string }).databasePath).not.toMatch(/sqlite/);
  });

  it("refuse l'API sans session, et sans l'en-tête anti-CSRF", async () => {
    const s = await server("open");
    const anon = client(s);
    expect((await anon.rpc("workspace.load")).status).toBe(401);
    await anon.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "motdepasse-long" });
    expect((await anon.rpc("workspace.load")).status).toBe(200);
    expect((await anon.req("POST", "/api/rpc/workspace.load", null, {})).status).toBe(403);
  });

  it("connexion, mauvais mot de passe, déconnexion", async () => {
    const s = await server("open");
    const c = client(s);
    await c.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "motdepasse-long" });
    await c.req("POST", "/api/auth/logout");
    expect((await c.req("GET", "/api/auth/me")).status).toBe(401);
    expect((await c.req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "faux-mot-de-passe" })).status).toBe(401);
    expect((await c.req("POST", "/api/auth/login", { email: "A@Exemple.fr", password: "motdepasse-long" })).status).toBe(200);
    expect((await c.req("GET", "/api/auth/me")).json).toEqual({ email: "a@exemple.fr" });
  });

  it("changer son mot de passe vérifie l'ancien et ferme les autres sessions", async () => {
    const s = await server("open");
    const here = client(s);
    await here.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "ancien-mot-de-passe" });
    const phone = client(s, "2.2.2.2");
    await phone.req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "ancien-mot-de-passe" });
    expect((await here.req("POST", "/api/auth/password", { current: "faux-mot-de-passe", next: "nouveau-mot-de-passe" })).json).toEqual({ error: "Mot de passe actuel incorrect." });
    expect((await here.req("POST", "/api/auth/password", { current: "ancien-mot-de-passe", next: "court" })).status).toBe(400);
    expect((await client(s, "3.3.3.3").req("POST", "/api/auth/password", { current: "ancien-mot-de-passe", next: "nouveau-mot-de-passe" })).status).toBe(401);
    expect((await here.req("POST", "/api/auth/password", { current: "ancien-mot-de-passe", next: "nouveau-mot-de-passe" }, {})).status).toBe(403);
    expect((await here.req("POST", "/api/auth/password", { current: "ancien-mot-de-passe", next: "nouveau-mot-de-passe" })).status).toBe(200);
    expect((await here.req("GET", "/api/auth/me")).status).toBe(200);
    expect((await phone.req("GET", "/api/auth/me")).status).toBe(401);
    expect((await client(s, "4.4.4.4").req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "ancien-mot-de-passe" })).status).toBe(401);
    expect((await client(s, "4.4.4.4").req("POST", "/api/auth/login", { email: "a@exemple.fr", password: "nouveau-mot-de-passe" })).status).toBe(200);
  });

  it("limite la taille des requêtes, plus strictement sans session", async () => {
    const s = await server("open");
    const headers = { "content-type": "application/json", "x-hamac": "1", "x-forwarded-for": "1.1.1.1" };
    const big = JSON.stringify({ email: "a@exemple.fr", password: "x".repeat(20_000) });
    const res = await s.app.request("/api/auth/login", { method: "POST", headers: { ...headers, "content-length": String(big.length) }, body: big });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Requête trop volumineuse." });
    // Sans longueur annoncée, la lecture s'arrête aussi à la limite.
    expect((await s.app.request("/api/auth/login", { method: "POST", headers, body: big })).status).not.toBe(200);
    const rpc = await s.app.request("/api/rpc/workspace.load", { method: "POST", headers: { ...headers, "content-length": String(40 * 1024 * 1024) }, body: "null" });
    expect(rpc.status).toBe(413);
  });

  it("deux inscriptions simultanées ne peuvent pas partager une invitation", async () => {
    const s = await server();
    await client(s).req("POST", "/api/auth/signup", { email: "admin@exemple.fr", password: "motdepasse-long" });
    const code = await s.users.createInvite();
    const results = await Promise.all(["b", "c", "d"].map((n, i) => client(s, `5.5.5.${i}`).req("POST", "/api/auth/signup", { email: `${n}@exemple.fr`, password: "motdepasse-long", invite: code })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 403, 403]);
    expect(await s.users.count()).toBe(2);
    expect((await s.users.list()).filter((u) => u.isAdmin)).toHaveLength(1);
    const tenants = await rawFor(await testProvider().session()).get<{ n: number }>("SELECT COUNT(*)::int AS n FROM comptes.tenants");
    expect(tenants?.n).toBe(2);
  });

  it("une adresse déjà prise ne consomme pas l'invitation", async () => {
    const s = await server();
    await client(s).req("POST", "/api/auth/signup", { email: "admin@exemple.fr", password: "motdepasse-long" });
    const code = await s.users.createInvite();
    expect((await client(s, "6.6.6.1").req("POST", "/api/auth/signup", { email: "admin@exemple.fr", password: "motdepasse-long", invite: code })).status).toBe(409);
    expect((await client(s, "6.6.6.2").req("POST", "/api/auth/signup", { email: "ami@exemple.fr", password: "motdepasse-long", invite: code })).status).toBe(200);
  });

  it("refuse un mot de passe trop court et limite les tentatives", async () => {
    const s = await server("open");
    const c = client(s);
    expect((await c.req("POST", "/api/auth/signup", { email: "a@exemple.fr", password: "court" })).status).toBe(400);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await c.req("POST", "/api/auth/login", { email: "x@exemple.fr", password: "nimportequoi" })).status;
    expect(last).toBe(429);
  });
});
