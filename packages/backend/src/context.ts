import type { RawDb } from "./db/driver";
import type { Db } from "./db/postgres";
import type { Fetcher } from "./market";
import type { SharedMarket } from "./market/shared";

export interface BackendContext {
  db: Db;
  raw: RawDb;
  appVersion: string;
  schemaVersion: string;
  backupsDir: string | null;
  fetcher: Fetcher;
  market: SharedMarket;
  /** Administrateur de l'instance : seul à régler les sources de cours. */
  isAdmin: boolean;
  displayPath: string;
}
