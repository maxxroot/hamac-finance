import type { RawDb } from "./db/driver";
import type { Db } from "./db/postgres";
import type { Fetcher } from "./market";

export interface BackendContext {
  db: Db;
  raw: RawDb;
  appVersion: string;
  schemaVersion: string;
  backupsDir: string | null;
  fetcher: Fetcher;
  displayPath: string;
}
