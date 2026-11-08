import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { rawFor, type PgProvider, type PgSession } from "@hamac/backend";

/**
 * Comptes, sessions et invitations de l'instance (schéma « comptes », inaccessible aux tenants).
 * Mots de passe : scrypt (intégré à Node), sel aléatoire, comparaison à temps constant.
 * Jetons de session : seule leur empreinte SHA-256 est stockée.
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

const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

function sha(s: string): string {
  return createHash("sha256").update(s).digest("base64url");
}

type Row = { id: string; tenant_id: string; email: string; is_admin: boolean; created_at: string };
const toUser = (r: Row): User => ({ id: r.id, tenantId: r.tenant_id, email: r.email, isAdmin: r.is_admin, createdAt: r.created_at });

export class UserStore {
  private constructor(
    private session: PgSession,
    private db: ReturnType<typeof rawFor>,
  ) {}

  /** Ouvre la connexion d'administration et crée les tables manquantes. `onLost` signale sa perte. */
  static async open(provider: PgProvider, onLost?: () => void): Promise<UserStore> {
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
    ])
      await db.exec(statement);
    return new UserStore(session, db);
  }

  static hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64, SCRYPT);
    return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
  }

  static verifyPassword(password: string, stored: string): boolean {
    const [algo, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
    return timingSafeEqual(actual, expected);
  }

  /** Crée le compte et son tenant. Le premier compte de l'instance en est l'administrateur. */
  async createUser(email: string, password: string): Promise<User> {
    const isAdmin = (await this.count()) === 0;
    const user: User = { id: crypto.randomUUID(), tenantId: crypto.randomUUID(), email: email.trim().toLowerCase(), isAdmin, createdAt: new Date().toISOString() };
    await this.db.run("INSERT INTO comptes.tenants (id, created_at) VALUES (?, ?)", [user.tenantId, user.createdAt]);
    await this.db.run("INSERT INTO comptes.users (id, tenant_id, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)", [user.id, user.tenantId, user.email, UserStore.hashPassword(password), isAdmin, user.createdAt]);
    return user;
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const r = await this.db.get<Row & { password_hash: string }>("SELECT id, tenant_id, email, is_admin, password_hash, created_at FROM comptes.users WHERE email = ?", [email.trim().toLowerCase()]);
    return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
  }

  async setPassword(userId: string, password: string): Promise<void> {
    await this.db.run("UPDATE comptes.users SET password_hash = ? WHERE id = ?", [UserStore.hashPassword(password), userId]);
    await this.db.run("DELETE FROM comptes.sessions WHERE user_id = ?", [userId]);
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
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
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

  async purgeExpired(): Promise<void> {
    await this.db.run("DELETE FROM comptes.sessions WHERE expires_at <= ?", [new Date().toISOString()]);
  }

  async tenantIds(): Promise<string[]> {
    return (await this.db.all<{ id: string }>("SELECT id FROM comptes.tenants")).map((r) => r.id);
  }

  async createInvite(days = 7): Promise<string> {
    const code = randomBytes(9).toString("base64url");
    await this.db.run("INSERT INTO comptes.invites (code, expires_at) VALUES (?, ?)", [code, new Date(Date.now() + days * 86_400_000).toISOString()]);
    return code;
  }

  /** Consomme une invitation valide ; false si inconnue, expirée ou déjà utilisée. */
  async useInvite(code: string, userId: string): Promise<boolean> {
    const used = await this.db.get("UPDATE comptes.invites SET used_by = ? WHERE code = ? AND used_by IS NULL AND expires_at > ? RETURNING code", [userId, code, new Date().toISOString()]);
    return !!used;
  }

  async inviteIsValid(code: string): Promise<boolean> {
    return !!(await this.db.get("SELECT 1 AS ok FROM comptes.invites WHERE code = ? AND used_by IS NULL AND expires_at > ?", [code, new Date().toISOString()]));
  }

  async close(): Promise<void> {
    await this.session.end();
  }
}
