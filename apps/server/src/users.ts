import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

/**
 * Comptes, sessions et invitations (base « serveur », distincte des bases personnelles).
 * Mots de passe : scrypt (intégré à Node), sel aléatoire, comparaison à temps constant.
 * Jetons de session : seule leur empreinte SHA-256 est stockée.
 */
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

function sha(s: string): string {
  return createHash("sha256").update(s).digest("base64url");
}

export class UserStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL,
        used_by TEXT REFERENCES users(id) ON DELETE SET NULL
      );
    `);
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

  createUser(email: string, password: string): User {
    const user: User = { id: crypto.randomUUID(), email: email.trim().toLowerCase(), createdAt: new Date().toISOString() };
    this.db
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(user.id, user.email, UserStore.hashPassword(password), user.createdAt);
    return user;
  }

  findByEmail(email: string): (User & { passwordHash: string }) | null {
    const r = this.db.prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?").get(email.trim().toLowerCase()) as
      | { id: string; email: string; password_hash: string; created_at: string }
      | undefined;
    return r ? { id: r.id, email: r.email, createdAt: r.created_at, passwordHash: r.password_hash } : null;
  }

  setPassword(userId: string, password: string) {
    this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(UserStore.hashPassword(password), userId);
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  }

  list(): User[] {
    return (this.db.prepare("SELECT id, email, created_at FROM users ORDER BY created_at").all() as Array<{ id: string; email: string; created_at: string }>).map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: r.created_at,
    }));
  }

  /** Crée une session ; renvoie le jeton en clair (à poser dans le cookie). */
  createSession(userId: string): { token: string; expiresAt: Date } {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    this.db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha(token), userId, expiresAt.toISOString());
    return { token, expiresAt };
  }

  userForSession(token: string): User | null {
    const r = this.db
      .prepare("SELECT u.id, u.email, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
      .get(sha(token), new Date().toISOString()) as { id: string; email: string; created_at: string } | undefined;
    return r ? { id: r.id, email: r.email, createdAt: r.created_at } : null;
  }

  deleteSession(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
  }

  purgeExpired() {
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  }

  createInvite(days = 7): string {
    const code = randomBytes(9).toString("base64url");
    this.db.prepare("INSERT INTO invites (code, expires_at) VALUES (?, ?)").run(code, new Date(Date.now() + days * 86_400_000).toISOString());
    return code;
  }

  /** Consomme une invitation valide ; false si inconnue, expirée ou déjà utilisée. */
  useInvite(code: string, userId: string): boolean {
    const res = this.db.prepare("UPDATE invites SET used_by = ? WHERE code = ? AND used_by IS NULL AND expires_at > ?").run(userId, code, new Date().toISOString());
    return Number(res.changes) === 1;
  }

  inviteIsValid(code: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM invites WHERE code = ? AND used_by IS NULL AND expires_at > ?").get(code, new Date().toISOString());
  }

  close() {
    this.db.close();
  }
}
