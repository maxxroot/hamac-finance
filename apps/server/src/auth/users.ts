import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { rawFor, type PgProvider, type PgSession } from "@hamac/backend";
import { API_TOKENS_TABLE, ApiTokenStore } from "./apiTokens";
import { PasswordHasher } from "./password";

/**
 * Comptes, sessions et invitations de l'instance (schéma « comptes », inaccessible aux tenants).
 * Mots de passe : Argon2id (voir password.ts).
 * Jetons de session et jetons d'accès (apiTokens.ts) : seule leur empreinte SHA-256 est stockée.
 */
export interface User {
  id: string;
  /** Espace de données isolé (schéma et rôle PostgreSQL). */
  tenantId: string;
  email: string;
  /** Premier compte de l'instance : règle les sources de cours. */
  isAdmin: boolean;
  createdAt: string;
}


function sha(s: string): string {
  return createHash("sha256").update(s).digest("base64url");
}

/** Comparaison à temps constant de deux secrets, quelles que soient leurs longueurs. */
export function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** Une activation non confirmée dans ce délai doit être recommencée. */
export const TWO_FACTOR_SETUP_MS = 30 * 60_000;

export interface TwoFactorRow {
  /** Chiffré : voir twoFactorKey.ts. */
  secret: string;
  confirmed: boolean;
  lastStep: number;
  createdAt: string;
}

type Row = { id: string; tenant_id: string; email: string; is_admin: boolean; created_at: string };
const toUser = (r: Row): User => ({ id: r.id, tenantId: r.tenant_id, email: r.email, isAdmin: r.is_admin, createdAt: r.created_at });

export class UserStore {
  private constructor(
    private session: PgSession,
    private db: ReturnType<typeof rawFor>,
    private sessionDays: number,
  ) {
    this.tokens = new ApiTokenStore(db);
  }

  /** Jetons d'accès des assistants (MCP), révoqués avec les sessions. */
  readonly tokens: ApiTokenStore;
  private hasher = new PasswordHasher();
  private decoy: Promise<string> | null = null;

  /** Ouvre la connexion d'administration et crée les tables manquantes. `onLost` signale sa perte. */
  static async open(provider: PgProvider, onLost?: () => void, sessionDays = 30): Promise<UserStore> {
    const session = await provider.session(onLost);
    const db = rawFor(session);
    for (const statement of [
      "CREATE SCHEMA IF NOT EXISTS comptes",
      // Un tenant ne doit disposer d'aucun objet partagé.
      "REVOKE ALL ON SCHEMA public FROM PUBLIC",
      "CREATE TABLE IF NOT EXISTS comptes.tenants (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)",
      `CREATE TABLE IF NOT EXISTS comptes.users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL UNIQUE REFERENCES comptes.tenants(id),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS comptes.sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES comptes.users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS comptes.invites (
        code TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL,
        used_by TEXT REFERENCES comptes.users(id) ON DELETE SET NULL
      )`,
      // Une ligne sans confirmed_at est une activation en cours : elle ne protège encore rien.
      `CREATE TABLE IF NOT EXISTS comptes.two_factor (
        user_id TEXT PRIMARY KEY REFERENCES comptes.users(id) ON DELETE CASCADE,
        secret TEXT NOT NULL,
        confirmed_at TEXT,
        last_step BIGINT NOT NULL DEFAULT -1,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS comptes.recovery_codes (
        user_id TEXT NOT NULL REFERENCES comptes.two_factor(user_id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        PRIMARY KEY (user_id, code_hash)
      )`,
      API_TOKENS_TABLE,
    ])
      await db.exec(statement);
    return new UserStore(session, db, sessionDays);
  }

  /** Même coût que le compte existe ou non ; convertit au passage une empreinte aux anciens paramètres. */
  async checkPassword(user: { id: string; passwordHash: string } | null, password: string): Promise<boolean> {
    const { ok, outdated } = await this.hasher.verify(password, user?.passwordHash ?? (await (this.decoy ??= this.hasher.hash("leurre"))));
    if (!user || !ok) return false;
    if (outdated) await this.db.run("UPDATE comptes.users SET password_hash = ? WHERE id = ?", [await this.hasher.hash(password), user.id]);
    return true;
  }

  /** Crée le compte et son tenant. Le premier compte de l'instance en est l'administrateur. */
  async createUser(email: string, password: string): Promise<User> {
    const isAdmin = (await this.count()) === 0;
    const user: User = { id: crypto.randomUUID(), tenantId: crypto.randomUUID(), email: email.trim().toLowerCase(), isAdmin, createdAt: new Date().toISOString() };
    const hash = await this.hasher.hash(password);
    await this.db.run("INSERT INTO comptes.tenants (id, created_at) VALUES (?, ?)", [user.tenantId, user.createdAt]);
    await this.db.run("INSERT INTO comptes.users (id, tenant_id, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)", [user.id, user.tenantId, user.email, hash, isAdmin, user.createdAt]);
    return user;
  }

  /**
   * Crée un compte avec une invitation, en une seule requête : le code n'est consommé que si le compte
   * est créé, et deux inscriptions simultanées ne peuvent pas se partager le même code.
   * Renvoie null si le code n'est plus valable.
   */
  async createInvitedUser(email: string, password: string, code: string): Promise<User | null> {
    const user: User = { id: crypto.randomUUID(), tenantId: crypto.randomUUID(), email: email.trim().toLowerCase(), isAdmin: false, createdAt: new Date().toISOString() };
    const hash = await this.hasher.hash(password);
    const created = await this.db.get(
      `WITH claimed AS (
         UPDATE comptes.invites SET used_by = ?::text WHERE code = ? AND used_by IS NULL AND expires_at > ? RETURNING code
       ), tenant AS (
         INSERT INTO comptes.tenants (id, created_at) SELECT ?::text, ?::text FROM claimed RETURNING id
       )
       INSERT INTO comptes.users (id, tenant_id, email, password_hash, is_admin, created_at)
       SELECT ?::text, tenant.id, ?::text, ?::text, FALSE, ?::text FROM tenant RETURNING id`,
      [user.id, code, user.createdAt, user.tenantId, user.createdAt, user.id, user.email, hash, user.createdAt],
    );
    return created ? user : null;
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const r = await this.db.get<Row & { password_hash: string }>("SELECT id, tenant_id, email, is_admin, password_hash, created_at FROM comptes.users WHERE email = ?", [email.trim().toLowerCase()]);
    return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
  }

  async findById(id: string): Promise<(User & { passwordHash: string }) | null> {
    const r = await this.db.get<Row & { password_hash: string }>("SELECT id, tenant_id, email, is_admin, password_hash, created_at FROM comptes.users WHERE id = ?", [id]);
    return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
  }

  async setPassword(userId: string, password: string): Promise<void> {
    await this.db.run("UPDATE comptes.users SET password_hash = ? WHERE id = ?", [await this.hasher.hash(password), userId]);
    await this.closeSessions(userId);
  }

  async count(): Promise<number> {
    return Number((await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM comptes.users"))?.n ?? 0);
  }

  async list(): Promise<User[]> {
    return (await this.db.all<Row>("SELECT id, tenant_id, email, is_admin, created_at FROM comptes.users ORDER BY created_at")).map(toUser);
  }

  /** Crée une session ; renvoie le jeton en clair (à poser dans le cookie). */
  async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.sessionDays * 86_400_000);
    await this.db.run("INSERT INTO comptes.sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [sha(token), userId, expiresAt.toISOString()]);
    return { token, expiresAt };
  }

  async userForSession(token: string): Promise<User | null> {
    const r = await this.db.get<Row>("SELECT u.id, u.tenant_id, u.email, u.is_admin, u.created_at FROM comptes.sessions s JOIN comptes.users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?", [sha(token), new Date().toISOString()]);
    return r ? toUser(r) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.run("DELETE FROM comptes.sessions WHERE token_hash = ?", [sha(token)]);
  }

  /** Ferme les sessions et révoque les jetons d'accès : un mot de passe connu d'un tiers ne doit rien laisser derrière lui. */
  async closeSessions(userId: string): Promise<void> {
    await this.db.run("DELETE FROM comptes.sessions WHERE user_id = ?", [userId]);
    await this.tokens.revokeAll(userId);
  }

  async purgeExpired(): Promise<void> {
    await this.db.run("DELETE FROM comptes.sessions WHERE expires_at <= ?", [new Date().toISOString()]);
    await this.db.run("DELETE FROM comptes.two_factor WHERE confirmed_at IS NULL AND created_at <= ?", [new Date(Date.now() - TWO_FACTOR_SETUP_MS).toISOString()]);
    await this.tokens.purgeExpired();
  }

  // ——— Double authentification. Chiffrement et vérification des codes : voir twoFactor.ts. ———

  async twoFactorRow(userId: string): Promise<TwoFactorRow | null> {
    const r = await this.db.get<{ secret: string; confirmed_at: string | null; last_step: number | string; created_at: string }>("SELECT secret, confirmed_at, last_step, created_at FROM comptes.two_factor WHERE user_id = ?", [userId]);
    return r ? { secret: r.secret, confirmed: r.confirmed_at !== null, lastStep: Number(r.last_step), createdAt: r.created_at } : null;
  }

  async recoveryCodesLeft(userId: string): Promise<number> {
    return Number((await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM comptes.recovery_codes WHERE user_id = ?", [userId]))?.n ?? 0);
  }

  /** Remplace une activation en cours ; renvoie false si la double authentification est déjà active. */
  async savePendingTwoFactor(userId: string, secret: string): Promise<boolean> {
    return !!(await this.db.get(
      `INSERT INTO comptes.two_factor (user_id, secret, created_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, created_at = EXCLUDED.created_at WHERE comptes.two_factor.confirmed_at IS NULL
       RETURNING user_id`,
      [userId, secret, new Date().toISOString()],
    ));
  }

  /**
   * Active, en une seule requête : le secret (s'il est toujours celui qui a été vérifié), les codes de secours,
   * la fermeture des sessions du compte et la révocation de ses jetons d'accès. Rien n'est appliqué si l'activation n'est plus en attente.
   */
  async confirmTwoFactor(userId: string, secret: string, step: number, recoveryHashes: string[]): Promise<boolean> {
    return !!(await this.db.get(
      `WITH activated AS (
         UPDATE comptes.two_factor SET confirmed_at = ?, last_step = ? WHERE user_id = ? AND secret = ? AND confirmed_at IS NULL RETURNING user_id
       ), codes AS (
         INSERT INTO comptes.recovery_codes (user_id, code_hash) SELECT activated.user_id, h FROM activated, json_array_elements_text(?::json) AS h
       ), closed AS (
         DELETE FROM comptes.sessions WHERE user_id IN (SELECT user_id FROM activated)
       ), revoked AS (
         DELETE FROM comptes.api_tokens WHERE user_id IN (SELECT user_id FROM activated)
       )
       SELECT user_id FROM activated`,
      [new Date().toISOString(), step, userId, secret, JSON.stringify(recoveryHashes)],
    ));
  }

  /** Mémorise le pas accepté. Atomique : de deux envois simultanés du même code, un seul passe. */
  async acceptTotpStep(userId: string, step: number): Promise<boolean> {
    return !!(await this.db.get("UPDATE comptes.two_factor SET last_step = ? WHERE user_id = ? AND confirmed_at IS NOT NULL AND last_step < ? RETURNING user_id", [step, userId, step]));
  }

  /** Atomique : de deux envois simultanés du même code de secours, un seul passe. */
  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    return !!(await this.db.get("DELETE FROM comptes.recovery_codes WHERE user_id = ? AND code_hash = ? RETURNING user_id", [userId, hash]));
  }

  async replaceRecoveryCodes(userId: string, hashes: string[]): Promise<boolean> {
    return !!(await this.db.get(
      `WITH active AS (
         SELECT user_id FROM comptes.two_factor WHERE user_id = ? AND confirmed_at IS NOT NULL
       ), removed AS (
         DELETE FROM comptes.recovery_codes WHERE user_id IN (SELECT user_id FROM active)
       ), added AS (
         INSERT INTO comptes.recovery_codes (user_id, code_hash) SELECT active.user_id, h FROM active, json_array_elements_text(?::json) AS h
       )
       SELECT user_id FROM active`,
      [userId, JSON.stringify(hashes)],
    ));
  }

  /** Les codes de secours disparaissent avec la ligne (ON DELETE CASCADE). */
  async disableTwoFactor(userId: string): Promise<void> {
    await this.db.run("DELETE FROM comptes.two_factor WHERE user_id = ?", [userId]);
  }

  /** Secours de l'administrateur de l'instance : renvoie false si le compte n'avait pas de double authentification active. */
  async resetTwoFactor(userId: string): Promise<boolean> {
    const removed = await this.db.get<{ confirmed_at: string | null }>("DELETE FROM comptes.two_factor WHERE user_id = ? RETURNING confirmed_at", [userId]);
    await this.closeSessions(userId);
    return !!removed?.confirmed_at;
  }

  async confirmedTwoFactorSecrets(): Promise<Array<{ userId: string; secret: string }>> {
    return (await this.db.all<{ user_id: string; secret: string }>("SELECT user_id, secret FROM comptes.two_factor WHERE confirmed_at IS NOT NULL")).map((r) => ({ userId: r.user_id, secret: r.secret }));
  }

  async tenantIds(): Promise<string[]> {
    return (await this.db.all<{ id: string }>("SELECT id FROM comptes.tenants")).map((r) => r.id);
  }

  async createInvite(days = 7): Promise<string> {
    const code = randomBytes(9).toString("base64url");
    await this.db.run("INSERT INTO comptes.invites (code, expires_at) VALUES (?, ?)", [code, new Date(Date.now() + days * 86_400_000).toISOString()]);
    return code;
  }

  async inviteIsValid(code: string): Promise<boolean> {
    return !!(await this.db.get("SELECT 1 AS ok FROM comptes.invites WHERE code = ? AND used_by IS NULL AND expires_at > ?", [code, new Date().toISOString()]));
  }

  async close(): Promise<void> {
    await this.session.end();
  }
}
