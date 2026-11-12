import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rawFor } from "@hamac/backend";
import { testProvider } from "@hamac/backend/testkit";
import { createApp, type ServerConfig } from "./app";
import { runCommand } from "./commands";
import { totp } from "./totp";
import { ChallengeStore, CHALLENGE_MAX_TRIES, newRecoveryCode, normalizeRecoveryCode } from "./twoFactor";

// Chaque test démarre un serveur complet (PGlite) et hache des mots de passe en Argon2id : le délai de 5 s
// par défaut est dépassé dès que la machine est chargée.
vi.setConfig({ testTimeout: 30_000 });

type App = Awaited<ReturnType<typeof createApp>>;
const SETUP = "code-installation-test";
const KEY = Buffer.alloc(32, 7).toString("base64");
const EMAIL = "a@exemple.fr";
const PASSWORD = "motdepasse-long";
const WRONG_LOGIN = { status: 401, json: { error: "E-mail ou mot de passe incorrect." } };

let current: App | null = null;
let clock = Date.now();
afterEach(async () => {
  await current?.close();
  current = null;
  clock = Date.now();
  vi.restoreAllMocks();
});

async function server(overrides: Partial<ServerConfig> = {}) {
  await current?.close();
  current = await createApp({ provider: testProvider(), dataDir: null, signup: "open", secureCookies: false, trustProxy: true, staticDir: null, appVersion: "test", autoRefreshPrices: false, setupCode: SETUP, twoFactorKey: KEY, now: () => clock, ...overrides });
  return current;
}

async function freshServer(overrides: Partial<ServerConfig> = {}) {
  const s = await server(overrides);
  await db().then((d) => d.exec("TRUNCATE comptes.users, comptes.tenants, comptes.sessions, comptes.invites CASCADE"));
  return s;
}
const db = async () => rawFor(await testProvider().session());

function client(s: App, ipAddr = "1.1.1.1") {
  let cookie = "";
  const req = async (method: string, path: string, body?: unknown, headers: Record<string, string> = { "x-hamac": "1" }) => {
    const res = await s.app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": ipAddr, ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(path.endsWith("/signup") ? { invite: SETUP, ...(body as object) } : body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0]!.endsWith("=") ? "" : set.split(";")[0]!;
    return { status: res.status, cookieSet: !!set, json: (await res.json()) as Record<string, any> };
  };
  return {
    req,
    me: () => req("GET", "/api/auth/me"),
    login: (email = EMAIL, password = PASSWORD) => req("POST", "/api/auth/login", { email, password }),
    code: (challenge: unknown, code: string, recovery?: boolean) => req("POST", "/api/auth/login/code", { challenge, code, recovery }),
    logout: () => req("POST", "/api/auth/logout"),
  };
}

function fromBase32(text: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of text) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

/** Le pas suivant est dans la tolérance : pratique pour obtenir un code neuf sans attendre. */
const nextCode = (secret: Buffer, offset = 1) => totp(secret, clock + offset * 30_000);
const advance = (ms: number) => (clock += ms);

async function signup(s: App, ipAddr = "1.1.1.1") {
  const c = client(s, ipAddr);
  expect((await c.req("POST", "/api/auth/signup", { email: EMAIL, password: PASSWORD })).status).toBe(200);
  return c;
}

async function activated(s: App) {
  const c = await signup(s);
  const setup = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
  expect(setup.status).toBe(200);
  const secret = fromBase32(setup.json.secret);
  const confirm = await c.req("POST", "/api/auth/2fa/confirm", { code: totp(secret, clock) });
  expect(confirm.status).toBe(200);
  return { c, secret, recoveryCodes: confirm.json.recoveryCodes as string[] };
}

describe("compte sans double authentification", () => {
  it("se connecte comme avant : une seule étape, session créée, réponse inchangée", async () => {
    const s = await freshServer();
    const c = await signup(s);
    await c.logout();
    const res = await c.login();
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ email: EMAIL });
    expect(res.cookieSet).toBe(true);
    expect((await c.me()).json).toEqual({ email: EMAIL, isAdmin: true, twoFactor: { enabled: false, available: true, recoveryCodesLeft: 0 } });
  });

  it("une activation non confirmée ne change rien à la connexion et ne stocke pas le secret en clair", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const { json } = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    expect((await c.me()).json.twoFactor.enabled).toBe(false);
    const row = await (await db()).get<{ secret: string; confirmed_at: string | null }>("SELECT secret, confirmed_at FROM comptes.two_factor");
    expect(row?.confirmed_at).toBeNull();
    expect(row?.secret).toMatch(/^v1\./);
    expect(row?.secret).not.toContain(json.secret);
    await c.logout();
    expect((await c.login()).json).toEqual({ email: EMAIL });
  });
});

describe("activation", () => {
  it("exige le bon mot de passe et une session", async () => {
    const s = await freshServer();
    const c = await signup(s);
    expect((await c.req("POST", "/api/auth/2fa/setup", { password: "faux-mot-de-passe" })).status).toBe(400);
    expect((await client(s, "2.2.2.2").req("POST", "/api/auth/2fa/setup", { password: PASSWORD })).status).toBe(401);
  });

  it("propose une adresse à scanner et refuse un mauvais code sans rien activer", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const { json } = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    expect(json.uri).toBe(`otpauth://totp/Hamac:a%40exemple.fr?secret=${json.secret}&issuer=Hamac&algorithm=SHA1&digits=6&period=30`);
    expect((await c.req("POST", "/api/auth/2fa/confirm", { code: "000000" })).status).toBe(400);
    expect((await c.me()).json.twoFactor.enabled).toBe(false);
  });

  it("une activation trop ancienne doit être recommencée", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const { json } = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    advance(31 * 60_000);
    const res = await c.req("POST", "/api/auth/2fa/confirm", { code: totp(fromBase32(json.secret), clock) });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/expiré/);
  });

  it("recommencer remplace le secret : seul le dernier affiché fonctionne", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const first = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    const second = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    expect((await c.req("POST", "/api/auth/2fa/confirm", { code: totp(fromBase32(first.json.secret), clock) })).status).toBe(400);
    expect((await c.req("POST", "/api/auth/2fa/confirm", { code: totp(fromBase32(second.json.secret), clock) })).status).toBe(200);
  });

  it("confirme : 10 codes de secours, autres sessions fermées, cet appareil reste connecté", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const phone = client(s, "2.2.2.2");
    await phone.login();
    const { json } = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    const res = await c.req("POST", "/api/auth/2fa/confirm", { code: totp(fromBase32(json.secret), clock) });
    expect(res.status).toBe(200);
    expect(res.cookieSet).toBe(true);
    expect(res.json.recoveryCodes).toHaveLength(10);
    expect(new Set(res.json.recoveryCodes).size).toBe(10);
    for (const code of res.json.recoveryCodes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await c.me()).status).toBe(200);
    expect((await phone.me()).status).toBe(401);
  });

  it("déjà active : ne peut pas être relancée et n'écrase pas le secret", async () => {
    const s = await freshServer();
    const { c } = await activated(s);
    const before = await (await db()).get<{ secret: string }>("SELECT secret FROM comptes.two_factor");
    expect((await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD })).status).toBe(409);
    expect((await (await db()).get<{ secret: string }>("SELECT secret FROM comptes.two_factor"))?.secret).toBe(before?.secret);
  });

  it("/api/auth/me ne renvoie aucun secret", async () => {
    const s = await freshServer();
    const { c } = await activated(s);
    const me = await c.me();
    expect(me.json).toEqual({ email: EMAIL, isAdmin: true, twoFactor: { enabled: true, available: true, recoveryCodesLeft: 10 } });
  });
});

describe("connexion en deux étapes", () => {
  it("le mot de passe seul n'ouvre aucune session ; le code, si", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    const first = await c.login();
    expect(first.status).toBe(200);
    expect(first.cookieSet).toBe(false);
    expect(first.json).toEqual({ twoFactor: true, challenge: expect.any(String) });
    expect((await c.me()).status).toBe(401);
    expect((await c.req("POST", "/api/rpc/workspace.load", null)).status).toBe(401);
    const second = await c.code(first.json.challenge, nextCode(secret));
    expect(second.status).toBe(200);
    expect(second.cookieSet).toBe(true);
    expect(second.json).toEqual({ email: EMAIL });
    expect((await c.me()).status).toBe(200);
  });

  it("un mauvais mot de passe reçoit la même réponse, avec ou sans double authentification, et pour un compte inconnu", async () => {
    const s = await freshServer();
    await activated(s);
    const c = client(s, "2.2.2.2");
    expect(await c.login(EMAIL, "faux-mot-de-passe")).toMatchObject({ ...WRONG_LOGIN, cookieSet: false });
    expect(await c.login("inconnu@exemple.fr", "faux-mot-de-passe")).toMatchObject({ ...WRONG_LOGIN, cookieSet: false });
    const other = client(s, "3.3.3.3");
    await other.req("POST", "/api/auth/signup", { email: "b@exemple.fr", password: PASSWORD });
    expect(await c.login("b@exemple.fr", "faux-mot-de-passe")).toMatchObject({ ...WRONG_LOGIN, cookieSet: false });
  });

  it("refuse un code déjà accepté, à l'activation comme à la connexion", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const setup = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    const secret = fromBase32(setup.json.secret);
    const used = totp(secret, clock);
    await c.req("POST", "/api/auth/2fa/confirm", { code: used });
    await c.logout();
    const { json } = await c.login();
    expect((await c.code(json.challenge, used)).status).toBe(401);
    expect((await c.code(json.challenge, nextCode(secret))).status).toBe(200);
    await c.logout();
    const again = await c.login();
    expect((await c.code(again.json.challenge, nextCode(secret))).status).toBe(401);
  });

  it("deux envois simultanés du même code : un seul ouvre une session", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    const { json } = await c.login();
    const code = nextCode(secret);
    const results = await Promise.all([c.code(json.challenge, code), c.code(json.challenge, code)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(results.filter((r) => r.cookieSet)).toHaveLength(1);
  });

  it("un défi réussi ne resert pas", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    const { json } = await c.login();
    await c.code(json.challenge, nextCode(secret));
    advance(30_000);
    const res = await c.code(json.challenge, nextCode(secret));
    expect(res.status).toBe(401);
    expect(res.json.restart).toBe(true);
    expect(res.cookieSet).toBe(false);
  });

  it("un défi expire au bout de 5 minutes", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    const { json } = await c.login();
    advance(5 * 60_000 + 1);
    const res = await c.code(json.challenge, nextCode(secret));
    expect(res.status).toBe(401);
    expect(res.json.restart).toBe(true);
    expect(res.cookieSet).toBe(false);
  });

  it("un défi inconnu ou absent est refusé", async () => {
    const s = await freshServer();
    const c = client(s);
    for (const challenge of ["au-hasard", undefined, 12]) {
      const res = await c.code(challenge, "123456");
      expect(res.status).toBe(401);
      expect(res.json.restart).toBe(true);
    }
  });

  it(`après ${CHALLENGE_MAX_TRIES} essais, le défi est retiré, même avec le bon code ensuite`, async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    const { json } = await c.login();
    for (let i = 1; i <= CHALLENGE_MAX_TRIES; i++) {
      const res = await c.code(json.challenge, "000000");
      expect(res.status).toBe(401);
      expect(res.json.restart).toBe(i === CHALLENGE_MAX_TRIES);
    }
    const late = await c.code(json.challenge, nextCode(secret));
    expect(late.status).toBe(401);
    expect(late.cookieSet).toBe(false);
  });

  it("des essais simultanés ne dépassent pas la limite du défi", async () => {
    const s = await freshServer();
    const { c } = await activated(s);
    await c.logout();
    const { json } = await c.login();
    const results = await Promise.all(Array.from({ length: 8 }, () => c.code(json.challenge, "000000")));
    expect(results.filter((r) => r.json.error?.includes("Code incorrect"))).toHaveLength(CHALLENGE_MAX_TRIES - 1);
    expect(results.filter((r) => r.json.restart === true)).toHaveLength(8 - (CHALLENGE_MAX_TRIES - 1));
  });

  it("se reconnecter remplace le défi précédent", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    const first = await c.login();
    const second = await c.login();
    expect((await c.code(first.json.challenge, nextCode(secret))).json.restart).toBe(true);
    expect((await c.code(second.json.challenge, nextCode(secret))).status).toBe(200);
  });

  it("changer le mot de passe annule un défi en cours", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    const attacker = client(s, "2.2.2.2");
    const { json } = await attacker.login();
    expect((await c.req("POST", "/api/auth/password", { current: PASSWORD, next: "nouveau-mot-de-passe" })).status).toBe(200);
    const res = await attacker.code(json.challenge, nextCode(secret));
    expect(res.status).toBe(401);
    expect(res.json.restart).toBe(true);
  });

  it("le bon mot de passe ne redonne pas d'essais de code : limite par compte, sur plusieurs adresses", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const attacker = client(s, `9.0.0.${i}`);
      const { json } = await attacker.login();
      last = (await attacker.code(json.challenge, "000000")).status;
    }
    expect(last).toBe(429);
    const owner = client(s, "8.8.8.8");
    const { json } = await owner.login();
    expect((await owner.code(json.challenge, nextCode(secret))).status).toBe(429);
  });

  it("limite aussi les essais de code par adresse", async () => {
    const s = await freshServer();
    const c = client(s, "7.7.7.7");
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await c.code("au-hasard", "000000")).status;
    expect(last).toBe(429);
  });

  it("une connexion complète remet les compteurs à zéro", async () => {
    const s = await freshServer();
    const { c, secret } = await activated(s);
    await c.logout();
    for (let i = 1; i <= 8; i++) {
      const first = await c.login();
      await c.code(first.json.challenge, "000000");
      const { json } = await c.login();
      advance(30_000);
      expect((await c.code(json.challenge, nextCode(secret))).status).toBe(200);
      await c.logout();
    }
  });

  it("exige l'en-tête anti-CSRF et limite la taille sur les nouvelles routes", async () => {
    const s = await freshServer();
    const c = await signup(s);
    const paths = ["/api/auth/login/code", "/api/auth/2fa/setup", "/api/auth/2fa/confirm", "/api/auth/2fa/disable", "/api/auth/2fa/recovery-codes"];
    for (const path of paths) {
      expect((await c.req("POST", path, {}, {})).status).toBe(403);
      const big = JSON.stringify({ code: "x".repeat(20_000) });
      const res = await s.app.request(path, { method: "POST", headers: { "content-type": "application/json", "x-hamac": "1", "x-forwarded-for": "1.1.1.1", "content-length": String(big.length) }, body: big });
      expect(res.status).toBe(413);
    }
  });
});

describe("codes de secours", () => {
  it("ne sont stockés que sous forme d'empreinte", async () => {
    const s = await freshServer();
    const { recoveryCodes } = await activated(s);
    const rows = await (await db()).all<{ code_hash: string }>("SELECT code_hash FROM comptes.recovery_codes");
    expect(rows).toHaveLength(10);
    for (const code of recoveryCodes) for (const row of rows) expect(row.code_hash).not.toContain(normalizeRecoveryCode(code));
  });

  it("ouvrent une session une seule fois, quelle que soit la saisie", async () => {
    const s = await freshServer();
    const { c, recoveryCodes } = await activated(s);
    await c.logout();
    const first = await c.login();
    const res = await c.code(first.json.challenge, recoveryCodes[0]!.toLowerCase().replace("-", " "), true);
    expect(res.status).toBe(200);
    expect((await c.me()).json.twoFactor.recoveryCodesLeft).toBe(9);
    await c.logout();
    const second = await c.login();
    expect((await c.code(second.json.challenge, recoveryCodes[0]!, true)).status).toBe(401);
    expect((await c.code(second.json.challenge, recoveryCodes[1]!, true)).status).toBe(200);
  });

  it("deux envois simultanés du même code de secours : un seul passe", async () => {
    const s = await freshServer();
    const { c, recoveryCodes } = await activated(s);
    await c.logout();
    const { json } = await c.login();
    const results = await Promise.all([c.code(json.challenge, recoveryCodes[0]!, true), c.code(json.challenge, recoveryCodes[0]!, true)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("ne valent que pour leur propre compte", async () => {
    const s = await freshServer();
    const { c, recoveryCodes } = await activated(s);
    const other = client(s, "2.2.2.2");
    await other.req("POST", "/api/auth/signup", { email: "b@exemple.fr", password: PASSWORD });
    const setup = await other.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    await other.req("POST", "/api/auth/2fa/confirm", { code: totp(fromBase32(setup.json.secret), clock) });
    await other.logout();
    const { json } = await other.login("b@exemple.fr");
    expect((await other.code(json.challenge, recoveryCodes[0]!, true)).status).toBe(401);
    expect((await c.me()).json.twoFactor.recoveryCodesLeft).toBe(10);
  });

  it("se régénèrent avec mot de passe et code : les anciens ne valent plus", async () => {
    const s = await freshServer();
    const { c, secret, recoveryCodes } = await activated(s);
    expect((await c.req("POST", "/api/auth/2fa/recovery-codes", { password: "faux-mot-de-passe", code: nextCode(secret) })).status).toBe(400);
    expect((await c.req("POST", "/api/auth/2fa/recovery-codes", { password: PASSWORD, code: "000000" })).status).toBe(400);
    const res = await c.req("POST", "/api/auth/2fa/recovery-codes", { password: PASSWORD, code: nextCode(secret) });
    expect(res.status).toBe(200);
    expect(res.json.recoveryCodes).toHaveLength(10);
    await c.logout();
    const { json } = await c.login();
    expect((await c.code(json.challenge, recoveryCodes[0]!, true)).status).toBe(401);
    expect((await c.code(json.challenge, res.json.recoveryCodes[0], true)).status).toBe(200);
  });

  it("forme : XXXX-XXXX, sans caractères ambigus", () => {
    for (let i = 0; i < 200; i++) expect(newRecoveryCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/);
  });
});

describe("désactivation", () => {
  it("exige le mot de passe et un code ; un mot de passe faux ne consomme pas le code", async () => {
    const s = await freshServer();
    const { c, secret, recoveryCodes } = await activated(s);
    expect((await c.req("POST", "/api/auth/2fa/disable", { password: PASSWORD, code: "000000" })).status).toBe(400);
    const code = nextCode(secret);
    expect((await c.req("POST", "/api/auth/2fa/disable", { password: "faux-mot-de-passe", code })).json).toEqual({ error: "Mot de passe ou code incorrect." });
    expect((await c.req("POST", "/api/auth/2fa/disable", { password: "faux-mot-de-passe", code: recoveryCodes[0] })).status).toBe(400);
    expect((await c.me()).json.twoFactor).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
    expect((await c.req("POST", "/api/auth/2fa/disable", { password: PASSWORD, code })).status).toBe(200);
    expect((await c.me()).json.twoFactor).toEqual({ enabled: false, available: true, recoveryCodesLeft: 0 });
    expect(await (await db()).get("SELECT 1 AS ok FROM comptes.two_factor")).toBeUndefined();
    await c.logout();
    expect((await c.login()).json).toEqual({ email: EMAIL });
  });

  it("accepte un code de secours à la place du code de l'application", async () => {
    const s = await freshServer();
    const { c, recoveryCodes } = await activated(s);
    expect((await c.req("POST", "/api/auth/2fa/disable", { password: PASSWORD, code: recoveryCodes[3] })).status).toBe(200);
  });

  it("sans session, refusée", async () => {
    const s = await freshServer();
    await activated(s);
    expect((await client(s, "2.2.2.2").req("POST", "/api/auth/2fa/disable", { password: PASSWORD, code: "000000" })).status).toBe(401);
  });

  it("limite les essais de mot de passe et de code", async () => {
    const s = await freshServer();
    const { c } = await activated(s);
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await c.req("POST", "/api/auth/2fa/disable", { password: "faux-mot-de-passe", code: "000000" })).status;
    expect(last).toBe(429);
  });
});

describe("clé perdue ou invalide", () => {
  it("clé changée : message clair, aucune session, aucun plantage ; les comptes sans protection continuent", async () => {
    const s = await freshServer();
    const { c } = await activated(s);
    const other = client(s, "2.2.2.2");
    await other.req("POST", "/api/auth/signup", { email: "b@exemple.fr", password: PASSWORD });
    await c.logout();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restarted = await server({ twoFactorKey: Buffer.alloc(32, 9).toString("base64") });
    expect(log.mock.calls.flat().join(" ")).toMatch(/1 compte\(s\).*2fa-reset/);
    const again = client(restarted, "3.3.3.3");
    const res = await again.login();
    expect(res.status).toBe(503);
    expect(res.json.error).toMatch(/clé de sécurité/);
    expect(res.cookieSet).toBe(false);
    expect((await client(restarted, "4.4.4.4").login("b@exemple.fr")).json).toEqual({ email: "b@exemple.fr" });
  });

  it("clé invalide : l'activation est refusée proprement, la connexion sans protection marche, et l'interface est prévenue", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = await freshServer({ twoFactorKey: "pas-une-cle" });
    expect(log.mock.calls.flat().join(" ")).not.toContain("pas-une-cle");
    const c = await signup(s);
    expect((await c.me()).json.twoFactor).toEqual({ enabled: false, available: false, recoveryCodesLeft: 0 });
    const res = await c.req("POST", "/api/auth/2fa/setup", { password: PASSWORD });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.json)).not.toMatch(/\/data|2fa\.key/);
  });

  it("clé illisible avec un compte protégé : la vérification refuse, le code n'est pas accepté", async () => {
    const s = await freshServer();
    const { c } = await activated(s);
    await c.logout();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restarted = await server({ twoFactorKey: "pas-une-cle" });
    expect((await client(restarted, "3.3.3.3").login()).status).toBe(503);
  });

  it("génère et réutilise le fichier de clé : la protection survit à un redémarrage", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dataDir = mkdtempSync(join(tmpdir(), "hamac-2fa-"));
    try {
      const s = await freshServer({ twoFactorKey: undefined, dataDir });
      const { c, secret } = await activated(s);
      await c.logout();
      const restarted = await server({ twoFactorKey: undefined, dataDir });
      const again = client(restarted, "3.3.3.3");
      const { json } = await again.login();
      expect((await again.code(json.challenge, nextCode(secret))).status).toBe(200);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("mémoire des défis", () => {
  it("reste bornée, en retirant d'abord les expirés puis les plus anciens", () => {
    let t = 0;
    const store = new ChallengeStore(() => t, 3);
    const a = store.create("a", "h");
    store.create("b", "h");
    t = 6 * 60_000;
    store.create("c", "h");
    store.create("d", "h");
    expect(store.size).toBe(2);
    expect(store.attempt(a)).toBeNull();
    store.create("e", "h");
    const f = store.create("f", "h");
    expect(store.size).toBe(3);
    expect(store.attempt(f)).not.toBeNull();
  });
});

describe("commande 2fa-reset", () => {
  const io = () => {
    const lines: string[] = [];
    return { lines, io: { log: (l: string) => void lines.push(l), ask: async () => "" } };
  };

  it("désactive la protection et ferme les sessions", async () => {
    const s = await freshServer();
    const { c, recoveryCodes } = await activated(s);
    const { lines, io: out } = io();
    await runCommand(s.users, ["2fa-reset", "A@Exemple.fr"], out);
    expect(lines[0]).toMatch(/désactivée pour a@exemple.fr/);
    expect(lines.join()).not.toContain(recoveryCodes[0]);
    expect((await c.me()).status).toBe(401);
    expect(await (await db()).get("SELECT 1 AS ok FROM comptes.recovery_codes")).toBeUndefined();
    const res = await c.login();
    expect(res.json).toEqual({ email: EMAIL });
  });

  it("le dit si la protection n'était pas active, et refuse un compte inconnu", async () => {
    const s = await freshServer();
    await signup(s);
    const { lines, io: out } = io();
    await runCommand(s.users, ["2fa-reset", EMAIL], out);
    expect(lines[0]).toMatch(/n'était pas active/);
    await expect(runCommand(s.users, ["2fa-reset", "x@exemple.fr"], out)).rejects.toThrow("Compte introuvable.");
    await expect(runCommand(s.users, ["2fa-reset"], out)).rejects.toThrow("Compte introuvable.");
  });
});
