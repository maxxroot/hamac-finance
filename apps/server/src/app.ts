import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo } from "@hono/node-server/conninfo";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createBackend, SharedMarket, type Backend, type MarketConfig, type PgProvider } from "@hamac/backend";
import { sameSecret, UserStore, type User } from "./users";

export type SignupMode = "invite" | "open" | "closed";

export interface ServerConfig {
  provider: PgProvider;
  /** Dossier des copies faites avant une migration, un sous-dossier par tenant ; null pour les désactiver. */
  dataDir: string | null;
  signup: SignupMode;
  /** Considère toute requête comme HTTPS, quel que soit ce qu'annonce le proxy. */
  secureCookies: boolean;
  /** Autorise les connexions en HTTP simple hors de cette machine : mots de passe et sessions circulent alors en clair. */
  allowHttp?: boolean;
  /** Derrière un reverse proxy de confiance : l'adresse du client se lit dans X-Forwarded-For. */
  trustProxy: boolean;
  /** Interface construite (packages/ui/dist) ; absente en test. */
  staticDir: string | null;
  appVersion: string;
  autoRefreshPrices: boolean;
  /** Clé Twelve Data, quota et rythme des cours. */
  market?: Partial<MarketConfig>;
  /** Durée d'une session avant de devoir se reconnecter. */
  sessionDays?: number;
  /** Code du premier compte ; aléatoire et écrit dans les journaux si absent. */
  setupCode?: string;
  /** Perte de la connexion d'administration : sans elle, plus de comptes ni de sessions. */
  onAdminLost?: () => void;
}

const COOKIE = "hamac_session";
/** En HTTPS : le préfixe impose Secure, Path=/ et aucun domaine, donc aucun sous-domaine ne peut le remplacer. */
const SECURE_COOKIE = "__Host-hamac_session";
const HTTPS_ONLY = "Connexion refusée : ouvrez Hamac en HTTPS.";
const IDLE_MS = 15 * 60_000;
const MIN_PASSWORD = 10;
/** Sans session, rien ne justifie un corps volumineux. */
const MAX_AUTH_BODY = 16 * 1024;
/** Assez pour restaurer une sauvegarde complète. */
const MAX_RPC_BODY = 32 * 1024 * 1024;

/** Un backend par tenant, avec sa propre connexion, ouvert à la demande et refermé après inactivité. */
class BackendPool {
  private pool = new Map<string, { backend: Promise<Backend>; lastUsed: number }>();
  private timer = setInterval(() => this.closeIdle(), 60_000);

  constructor(
    private cfg: ServerConfig,
    private market: SharedMarket,
  ) {
    this.timer.unref?.();
  }

  get(user: User): Promise<Backend> {
    const id = user.tenantId;
    let entry = this.pool.get(id);
    if (!entry) {
      const created: { backend: Promise<Backend>; lastUsed: number } = {
        lastUsed: Date.now(),
        backend: createBackend({
          provider: this.cfg.provider,
          market: this.market,
          isAdmin: user.isAdmin,
          tenantId: id,
          backupsDir: this.cfg.dataDir ? join(this.cfg.dataDir, "tenants", id, "sauvegardes") : null,
          appVersion: this.cfg.appVersion,
          autoRefreshPrices: this.cfg.autoRefreshPrices,
          displayPath: "Base PostgreSQL de l'instance",
          onLost: () => this.drop(id, created),
        }),
      };
      created.backend.catch(() => this.drop(id, created));
      this.pool.set(id, created);
      entry = created;
    }
    entry.lastUsed = Date.now();
    return entry.backend;
  }

  /** Oublie un backend dont la connexion est perdue : le prochain appel le rouvre. */
  private drop(id: string, entry: { backend: Promise<Backend> }) {
    if (this.pool.get(id) !== entry) return;
    this.pool.delete(id);
    void entry.backend.then((b) => b.close()).catch(() => undefined);
  }

  private closeIdle() {
    const now = Date.now();
    for (const [id, e] of this.pool) if (now - e.lastUsed > IDLE_MS) this.drop(id, e);
  }

  close() {
    clearInterval(this.timer);
    for (const [id, e] of this.pool) this.drop(id, e);
  }
}

/** Limite les tentatives de connexion / inscription par adresse IP. */
class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  /** Une connexion réussie remet le compteur à zéro. */
  reset(key: string): void {
    this.hits.delete(key);
  }
  allow(key: string): boolean {
    const now = Date.now();
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
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

export async function createApp(cfg: ServerConfig) {
  if (cfg.dataDir) mkdirSync(cfg.dataDir, { recursive: true });
  const users = await UserStore.open(cfg.provider, cfg.onAdminLost, cfg.sessionDays);
  const market = await SharedMarket.open(cfg.provider, undefined, cfg.onAdminLost, cfg.market);
  if (cfg.autoRefreshPrices) market.start(() => users.tenantIds());
  const pool = new BackendPool(cfg, market);
  // Instance neuve : sans ce code, la première personne à atteindre le serveur en deviendrait l'administrateur.
  const setupCode = cfg.setupCode ?? randomBytes(12).toString("base64url");
  if (!cfg.setupCode && (await users.count()) === 0) console.log(`[hamac] Instance neuve. Code d'installation du compte administrateur : ${setupCode}`);
  let installing = false;
  const limiter = new RateLimiter(10, 15 * 60_000);
  // Par compte visé : freine une attaque répartie sur plusieurs adresses.
  const accountLimiter = new RateLimiter(20, 15 * 60_000);
  const app = new Hono();

  /** HTTPS annoncé par le proxy de confiance (dernière entrée, celle qu'il a ajoutée), sinon protocole de la requête. */
  const isHttps = (c: Context): boolean => {
    if (cfg.secureCookies) return true;
    const proto = cfg.trustProxy ? c.req.header("x-forwarded-proto")?.split(",").at(-1)?.trim() : undefined;
    return proto ? proto === "https" : new URL(c.req.url).protocol === "https:";
  };
  const isLocal = (c: Context): boolean => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname);
  const cookieName = (c: Context): string => (isHttps(c) ? SECURE_COOKIE : COOKIE);

  // En-têtes de sécurité.
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "same-origin");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    // Pas de sous-domaines : ils peuvent héberger autre chose que Hamac, sans HTTPS.
    if (isHttps(c)) c.header("Strict-Transport-Security", "max-age=31536000");
    if (c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-store");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",
    );
  });

  /** Adresse du client : l'en-tête n'est cru que derrière un proxy de confiance, dont on lit l'entrée ajoutée en dernier. */
  const ip = (c: Context): string => {
    if (cfg.trustProxy) {
      const forwarded = c.req.header("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean).at(-1) ?? c.req.header("x-real-ip");
      if (forwarded) return forwarded;
    }
    try {
      return getConnInfo(c).remote.address ?? "local";
    } catch {
      return "local";
    }
  };
  const currentUser = async (c: Context): Promise<User | null> => {
    const token = getCookie(c, cookieName(c));
    return token ? users.userForSession(token) : null;
  };
  const startSession = async (c: Context, user: User) => {
    const { token, expiresAt } = await users.createSession(user.id);
    setCookie(c, cookieName(c), token, { httpOnly: true, sameSite: "Strict", secure: isHttps(c), path: "/", expires: expiresAt });
  };
  const unauthorized = (c: Context) => c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Session expirée : reconnectez-vous." } }, 401);
  // Protection CSRF : en plus du cookie SameSite=Strict, toute écriture exige un en-tête qu'un formulaire tiers ne peut pas envoyer.
  const csrfOk = (c: Context) => c.req.header("x-hamac") === "1";

  // Hors de cette machine, jamais de mot de passe ni de session sur une connexion en clair.
  app.use("/api/*", async (c, next) => {
    if (c.req.path !== "/api/auth/config" && !cfg.allowHttp && !isHttps(c) && !isLocal(c)) return c.json({ error: HTTPS_ONLY }, 403);
    await next();
  });

  const TOO_LARGE = "Requête trop volumineuse.";
  app.use("/api/auth/*", bodyLimit({ maxSize: MAX_AUTH_BODY, onError: (c) => c.json({ error: TOO_LARGE }, 413) }));
  app.use("/api/rpc/*", bodyLimit({ maxSize: MAX_RPC_BODY, onError: (c) => c.json({ ok: false, error: { code: "VALIDATION", message: TOO_LARGE } }, 413) }));

  app.get("/api/auth/config", async (c) => c.json({ signup: cfg.signup, firstUser: (await users.count()) === 0 }));

  app.get("/api/auth/me", async (c) => {
    const user = await currentUser(c);
    return user ? c.json({ email: user.email }) : unauthorized(c);
  });

  app.post("/api/auth/login", async (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    if (!limiter.allow(`login:${ip(c)}`)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
    const found = body.email ? await users.findByEmail(body.email) : null;
    const accountKey = `login:${(body.email ?? "").trim().toLowerCase()}`;
    if (!accountLimiter.allow(accountKey)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    // Même réponse et même coût que l'e-mail existe ou non.
    const ok = await users.checkPassword(found, body.password ?? "");
    if (!found || !ok) return c.json({ error: "E-mail ou mot de passe incorrect." }, 401);
    limiter.reset(`login:${ip(c)}`);
    accountLimiter.reset(accountKey);
    await startSession(c, found);
    return c.json({ email: found.email });
  });

  app.post("/api/auth/signup", async (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    if (!limiter.allow(`signup:${ip(c)}`)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string; invite?: string };
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";
    const first = (await users.count()) === 0;
    if (first && !sameSecret(body.invite ?? "", setupCode)) return c.json({ error: "Code d'installation invalide : il est affiché dans les journaux du serveur." }, 403);
    if (!first && cfg.signup === "closed") return c.json({ error: "Les inscriptions sont fermées sur cette instance." }, 403);
    if (!first && cfg.signup === "invite" && !(body.invite && (await users.inviteIsValid(body.invite)))) return c.json({ error: "Code d'invitation invalide ou expiré." }, 403);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "Adresse e-mail invalide." }, 400);
    if (password.length < MIN_PASSWORD) return c.json({ error: `Mot de passe trop court (${MIN_PASSWORD} caractères minimum).` }, 400);
    if (await users.findByEmail(email)) return c.json({ error: "Un compte existe déjà avec cette adresse." }, 409);
    if (first && installing) return c.json({ error: "Installation déjà en cours." }, 409);
    installing = first;
    let user: User | null;
    try {
      user = !first && cfg.signup === "invite" ? await users.createInvitedUser(email, password, body.invite!) : await users.createUser(email, password);
    } finally {
      if (first) installing = false;
    }
    if (!user) return c.json({ error: "Code d'invitation invalide ou expiré." }, 403);
    await startSession(c, user);
    return c.json({ email: user.email });
  });

  app.post("/api/auth/logout", async (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    const name = cookieName(c);
    const token = getCookie(c, name);
    if (token) await users.deleteSession(token);
    deleteCookie(c, name, { path: "/", secure: isHttps(c) });
    return c.json({ ok: true });
  });

  // Ferme toutes les sessions du compte, puis en rouvre une pour cet appareil.
  app.post("/api/auth/password", async (c) => {
    if (!csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    const user = await currentUser(c);
    if (!user) return unauthorized(c);
    if (!limiter.allow(`password:${user.id}`)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { current?: string; next?: string };
    const next = body.next ?? "";
    if (next.length < MIN_PASSWORD) return c.json({ error: `Mot de passe trop court (${MIN_PASSWORD} caractères minimum).` }, 400);
    const found = await users.findByEmail(user.email);
    if (!found || !(await users.checkPassword(found, body.current ?? ""))) return c.json({ error: "Mot de passe actuel incorrect." }, 400);
    await users.setPassword(user.id, next);
    limiter.reset(`password:${user.id}`);
    await startSession(c, user);
    return c.json({ email: user.email });
  });

  app.post("/api/rpc/:name", async (c) => {
    if (!csrfOk(c)) return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Requête refusée." } }, 403);
    const user = await currentUser(c);
    if (!user) return unauthorized(c);
    const input = await c.req.json().catch(() => null);
    const result = await (await pool.get(user)).dispatch(c.req.param("name"), input ?? undefined);
    return c.json(result);
  });

  app.all("/api/*", (c) => c.json({ error: "Introuvable" }, 404));

  // Interface : fichiers statiques, et index.html pour le reste (routeur par hash).
  if (cfg.staticDir) {
    const root = resolve(cfg.staticDir);
    app.get("*", (c) => {
      let rel = "index.html";
      try {
        rel = normalize(decodeURIComponent(new URL(c.req.url).pathname)).replace(/^([/\\])+/, "");
      } catch {
        // Adresse mal encodée : on sert l'interface.
      }
      let file = resolve(root, rel);
      if (!(file === root || file.startsWith(root + sep)) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
      const body = readFileSync(file);
      const ext = extname(file);
      c.header("Content-Type", MIME[ext] ?? "application/octet-stream");
      c.header("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable");
      return c.body(body);
    });
  }

  const purge = setInterval(() => void users.purgeExpired().catch(() => undefined), 3600_000);
  purge.unref?.();

  return {
    app,
    users,
    async close() {
      clearInterval(purge);
      pool.close();
      await market.close();
      await users.close();
    },
  };
}
