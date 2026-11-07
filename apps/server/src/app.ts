import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createBackend, type Backend } from "@hamac/backend";
import { UserStore, type User } from "./users";

export type SignupMode = "invite" | "open" | "closed";

export interface ServerConfig {
  /** Dossier des données : base des comptes + un sous-dossier par utilisateur. */
  dataDir: string;
  signup: SignupMode;
  /** Cookie « Secure » : à activer derrière HTTPS (recommandé en production). */
  secureCookies: boolean;
  /** Interface construite (packages/ui/dist) ; absente en test. */
  staticDir: string | null;
  appVersion: string;
  autoRefreshPrices: boolean;
}

const COOKIE = "hamac_session";
const IDLE_MS = 15 * 60_000;
const MIN_PASSWORD = 10;

/** Un backend (base SQLite) par utilisateur, ouvert à la demande et refermé après inactivité. */
class BackendPool {
  private pool = new Map<string, { backend: Backend; lastUsed: number }>();
  private timer = setInterval(() => this.closeIdle(), 60_000);

  constructor(private cfg: ServerConfig) {
    this.timer.unref?.();
  }

  get(user: User): Backend {
    let entry = this.pool.get(user.id);
    if (!entry) {
      const dir = join(this.cfg.dataDir, "users", user.id);
      mkdirSync(dir, { recursive: true });
      const backend = createBackend({
        databasePath: join(dir, "hamac.sqlite"),
        backupsDir: join(dir, "sauvegardes"),
        mode: "web",
        appVersion: this.cfg.appVersion,
        autoRefreshPrices: this.cfg.autoRefreshPrices,
        displayPath: "Base personnelle sur le serveur",
      });
      entry = { backend, lastUsed: Date.now() };
      this.pool.set(user.id, entry);
    }
    entry.lastUsed = Date.now();
    return entry.backend;
  }

  private closeIdle() {
    const now = Date.now();
    for (const [id, e] of this.pool) {
      if (now - e.lastUsed > IDLE_MS) {
        e.backend.close();
        this.pool.delete(id);
      }
    }
  }

  close() {
    clearInterval(this.timer);
    for (const e of this.pool.values()) e.backend.close();
    this.pool.clear();
  }
}

/** Limite les tentatives de connexion / inscription par adresse IP. */
class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  allow(key: string): boolean {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.reset < now) {
      this.hits.set(key, { n: 1, reset: now + this.windowMs });
      return true;
    }
    h.n++;
    return h.n <= this.max;
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

export function createApp(cfg: ServerConfig) {
  mkdirSync(cfg.dataDir, { recursive: true });
  const users = new UserStore(join(cfg.dataDir, "comptes.sqlite"));
  const pool = new BackendPool(cfg);
  const limiter = new RateLimiter(10, 15 * 60_000);
  const app = new Hono();

  // En-têtes de sécurité.
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "same-origin");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    );
  });

  const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "local";
  const currentUser = (c: Context): User | null => {
    const token = getCookie(c, COOKIE);
    return token ? users.userForSession(token) : null;
  };
  const startSession = (c: Context, user: User) => {
    const { token, expiresAt } = users.createSession(user.id);
    setCookie(c, COOKIE, token, { httpOnly: true, sameSite: "Strict", secure: cfg.secureCookies, path: "/", expires: expiresAt });
  };
  const unauthorized = (c: Context) => c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Session expirée : reconnectez-vous." } }, 401);
  // Protection CSRF : en plus du cookie SameSite=Strict, toute écriture exige un en-tête qu'un formulaire tiers ne peut pas envoyer.
  const csrfOk = (c: Context) => c.req.header("x-hamac") === "1";

  app.get("/api/auth/config", (c) => c.json({ signup: cfg.signup, firstUser: users.count() === 0 }));

  app.get("/api/auth/me", (c) => {
    const user = currentUser(c);
    return user ? c.json({ email: user.email }) : unauthorized(c);
  });

  app.post("/api/auth/login", async (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    if (!limiter.allow(`login:${ip(c)}`)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
    const found = body.email ? users.findByEmail(body.email) : null;
    // Même réponse et même coût que l'e-mail existe ou non.
    const ok = found ? UserStore.verifyPassword(body.password ?? "", found.passwordHash) : (UserStore.verifyPassword(body.password ?? "", UserStore.hashPassword("leurre")), false);
    if (!found || !ok) return c.json({ error: "E-mail ou mot de passe incorrect." }, 401);
    startSession(c, found);
    return c.json({ email: found.email });
  });

  app.post("/api/auth/signup", async (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    if (!limiter.allow(`signup:${ip(c)}`)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string; invite?: string };
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";
    // Le tout premier compte (l'administrateur de l'instance) n'a pas besoin d'invitation.
    const first = users.count() === 0;
    if (!first && cfg.signup === "closed") return c.json({ error: "Les inscriptions sont fermées sur cette instance." }, 403);
    if (!first && cfg.signup === "invite" && !(body.invite && users.inviteIsValid(body.invite))) return c.json({ error: "Code d'invitation invalide ou expiré." }, 403);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "Adresse e-mail invalide." }, 400);
    if (password.length < MIN_PASSWORD) return c.json({ error: `Mot de passe trop court (${MIN_PASSWORD} caractères minimum).` }, 400);
    if (users.findByEmail(email)) return c.json({ error: "Un compte existe déjà avec cette adresse." }, 409);
    const user = users.createUser(email, password);
    if (!first && cfg.signup === "invite") users.useInvite(body.invite!, user.id);
    startSession(c, user);
    return c.json({ email: user.email });
  });

  app.post("/api/auth/logout", (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    const token = getCookie(c, COOKIE);
    if (token) users.deleteSession(token);
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.post("/api/rpc/:name", async (c) => {
    if (!csrfOk(c)) return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Requête refusée." } }, 403);
    const user = currentUser(c);
    if (!user) return unauthorized(c);
    const input = await c.req.json().catch(() => null);
    const result = await pool.get(user).dispatch(c.req.param("name"), input ?? undefined);
    return c.json(result);
  });

  app.all("/api/*", (c) => c.json({ error: "Introuvable" }, 404));

  // Interface : fichiers statiques, et index.html pour le reste (routeur par hash).
  if (cfg.staticDir) {
    const root = resolve(cfg.staticDir);
    app.get("*", (c) => {
      const rel = normalize(decodeURIComponent(new URL(c.req.url).pathname)).replace(/^([/\\])+/, "");
      let file = resolve(root, rel);
      if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
      const body = readFileSync(file);
      const ext = extname(file);
      c.header("Content-Type", MIME[ext] ?? "application/octet-stream");
      c.header("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable");
      return c.body(body);
    });
  }

  const purge = setInterval(() => users.purgeExpired(), 3600_000);
  purge.unref?.();

  return {
    app,
    users,
    close() {
      clearInterval(purge);
      pool.close();
      users.close();
    },
  };
}
