export type SqlValue = null | number | bigint | string | boolean | Uint8Array;

export const one = <T>(rows: T[]): T | undefined => rows[0];

/** Une connexion PostgreSQL dédiée : son rôle et son schéma courants lui restent propres. */
export interface PgSession {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[], arrays?: boolean): Promise<T[]>;
  end(): Promise<void>;
}

export interface PgProvider {
  /** Ouvre une connexion ; `onLost` signale sa perte (redémarrage de PostgreSQL, réseau). */
  session(onLost?: () => void): Promise<PgSession>;
  close(): Promise<void>;
}

/** SQL écrit à la main, paramètres « ? ». Pas de transactions imbriquées. */
export interface RawDb {
  all<T = Record<string, unknown>>(query: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T = Record<string, unknown>>(query: string, params?: readonly SqlValue[]): Promise<T | undefined>;
  run(query: string, params?: readonly SqlValue[]): Promise<void>;
  exec(query: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  columns(table: string): Promise<Array<{ name: string; type: string }>>;
  version(): Promise<string>;
  close(): Promise<void>;
}
