import type { RawDb } from "./db/driver";
import type { Db } from "./db/sqlite";
import type { Fetcher } from "./market";

export interface BackendContext {
  db: Db;
  raw: RawDb;
  mode: "desktop" | "web";
  appVersion: string;
  databasePath: string;
  schemaVersion: string;
  backupsDir: string | null;
  fetcher: Fetcher;
  displayPath?: string;
}
