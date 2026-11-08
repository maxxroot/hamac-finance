export type SqlValue = null | number | bigint | string | Uint8Array;

/**
 * Accès SQL commun à SQLite (desktop) et PostgreSQL (serveur). Écrire les requêtes dans la syntaxe
 * partagée par les deux : paramètres « ? », « ON CONFLICT DO NOTHING », alias entre guillemets.
 */
export interface RawDb {
  readonly dialect: "sqlite" | "postgres";
  all<T = Record<string, unknown>>(query: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T = Record<string, unknown>>(query: string, params?: readonly SqlValue[]): Promise<T | undefined>;
  run(query: string, params?: readonly SqlValue[]): Promise<void>;
  exec(query: string): Promise<void>;
  /** Tout ou rien. Les appels passent déjà un par un : pas de transactions imbriquées. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /** Transaction qui remplace toutes les tables : les références ne sont contrôlées qu'à la fin. */
  replaceAll<T>(fn: () => Promise<T>): Promise<T>;
  /** Références cassées, à consulter à la fin de replaceAll. */
  brokenReferences(): Promise<number>;
  columns(table: string): Promise<string[]>;
  version(): Promise<string>;
  close(): Promise<void>;
}
