import type { Db, RawDb } from "./db/sqlite";

export interface BackendContext {
  db: Db;
  raw: RawDb;
  mode: "desktop" | "web";
  appVersion: string;
  databasePath: string;
  schemaVersion: string;
  backupsDir: string | null;
}
