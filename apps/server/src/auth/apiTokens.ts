import { createHash, randomBytes } from "node:crypto";
import type { rawFor } from "@hamac/backend";
import type { User } from "./users";

/**
 * Jetons d'accès personnels, pour les assistants branchés en MCP (voir docs/assistants-mcp/technique.md).
 * Comme pour les sessions, seule l'empreinte SHA-256 est stockée : le jeton a 256 bits d'aléa.
 * Table `comptes.api_tokens`, créée par `UserStore.open`.
 */

export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];
/** Durées proposées, en jours. */
export const TOKEN_DAYS = [30, 90, 365] as const;
export const MAX_TOKENS_PER_USER = 10;
/** Préfixe reconnaissable par les détecteurs de secrets, et par une personne qui en trouve un. */
const PREFIX = "hamac_";

export const API_TOKENS_TABLE = `CREATE TABLE IF NOT EXISTS comptes.api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES comptes.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT
)`;

export interface ApiToken {
  id: string;
  name: string;
  scope: TokenScope;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

type Row = { id: string; name: string; scope: string; created_at: string; expires_at: string; last_used_at: string | null };
const toToken = (r: Row): ApiToken => ({ id: r.id, name: r.name, scope: r.scope === "write" ? "write" : "read", createdAt: r.created_at, expiresAt: r.expires_at, lastUsedAt: r.last_used_at });
const sha = (s: string) => createHash("sha256").update(s).digest("base64url");
/** Pas plus d'une écriture par minute pour la date de dernière utilisation. */
const TOUCH_MS = 60_000;

export class ApiTokenStore {
  constructor(private db: ReturnType<typeof rawFor>) {}

  /** Renvoie le jeton en clair, à montrer une seule fois ; null si le compte en a déjà le maximum. */
  async create(userId: string, name: string, scope: TokenScope, days: number): Promise<{ token: string; info: ApiToken } | null> {
    const now = new Date();
    const info: ApiToken = { id: crypto.randomUUID(), name: name.trim().slice(0, 60), scope, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(), lastUsedAt: null };
    const token = PREFIX + randomBytes(32).toString("base64url");
    // Le plafond est vérifié dans la même requête que l'insertion : deux créations simultanées ne le dépassent pas.
    const created = await this.db.get(
      `INSERT INTO comptes.api_tokens (id, user_id, name, token_hash, scope, created_at, expires_at)
       SELECT ?::text, ?::text, ?::text, ?::text, ?::text, ?::text, ?::text
       WHERE (SELECT COUNT(*) FROM comptes.api_tokens WHERE user_id = ? AND expires_at > ?) < ?
       RETURNING id`,
      [info.id, userId, info.name, sha(token), scope, info.createdAt, info.expiresAt, userId, info.createdAt, MAX_TOKENS_PER_USER],
    );
    return created ? { token, info } : null;
  }

  /** Jetons encore valables du compte, les plus récents d'abord. */
  async list(userId: string): Promise<ApiToken[]> {
    return (await this.db.all<Row>("SELECT id, name, scope, created_at, expires_at, last_used_at FROM comptes.api_tokens WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC", [userId, new Date().toISOString()])).map(toToken);
  }

  /** Renvoie false si le jeton n'existe pas ou n'appartient pas à ce compte. */
  async revoke(userId: string, id: string): Promise<boolean> {
    return !!(await this.db.get("DELETE FROM comptes.api_tokens WHERE id = ? AND user_id = ? RETURNING id", [id, userId]));
  }

  async revokeAll(userId: string): Promise<void> {
    await this.db.run("DELETE FROM comptes.api_tokens WHERE user_id = ?", [userId]);
  }

  /** Compte et portée d'un jeton valable ; note sa dernière utilisation. */
  async resolve(token: string): Promise<{ user: User; tokenId: string; scope: TokenScope } | null> {
    if (!token.startsWith(PREFIX)) return null;
    const now = new Date();
    const r = await this.db.get<{ token_id: string; scope: string; last_used_at: string | null; id: string; tenant_id: string; email: string; is_admin: boolean; created_at: string }>(
      `SELECT t.id AS token_id, t.scope, t.last_used_at, u.id, u.tenant_id, u.email, u.is_admin, u.created_at
       FROM comptes.api_tokens t JOIN comptes.users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.expires_at > ?`,
      [sha(token), now.toISOString()],
    );
    if (!r) return null;
    if (!r.last_used_at || now.getTime() - Date.parse(r.last_used_at) > TOUCH_MS) await this.db.run("UPDATE comptes.api_tokens SET last_used_at = ? WHERE id = ?", [now.toISOString(), r.token_id]);
    return { user: { id: r.id, tenantId: r.tenant_id, email: r.email, isAdmin: r.is_admin, createdAt: r.created_at }, tokenId: r.token_id, scope: r.scope === "write" ? "write" : "read" };
  }

  async purgeExpired(): Promise<void> {
    await this.db.run("DELETE FROM comptes.api_tokens WHERE expires_at <= ?", [new Date().toISOString()]);
  }
}
