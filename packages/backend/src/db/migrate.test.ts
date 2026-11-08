import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { backupBeforeMigration, dailyBackup } from "../backup";
import { MARKET_SECRETS_KEY } from "../market/config";
import { migrate, pendingMigrations } from "./migrate";
import { migrations } from "./migrations.generated";

function upTo(tag: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of migrations) {
    if (m.tag === tag) break;
    for (const st of m.sql.split("--> statement-breakpoint")) if (st.trim()) db.exec(st);
    db.prepare("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)").run(m.tag, "x");
  }
  return db;
}

describe("migrations", () => {
  it("arrête les versements des comptes déjà archivés, et d'eux seuls", () => {
    const db = upTo("0013_arret_versements_archives");
    db.exec("INSERT INTO accounts (id, kind, name, archived) VALUES ('arch', 'pea', 'A', 1), ('actif', 'cto', 'B', 0)");
    db.exec("INSERT INTO contribution_plans (id, account_id, from_month, amount_cents) VALUES ('1', 'arch', '2020-01', 20000), ('2', 'arch', '2099-01', 50000), ('3', 'actif', '2020-01', 10000)");
    migrate(db);
    const plans = (id: string) => db.prepare("SELECT from_month AS m, amount_cents AS c FROM contribution_plans WHERE account_id = ? ORDER BY from_month").all(id) as Array<{ m: string; c: number }>;
    expect(plans("arch").map((p) => p.c)).toEqual([20000, 0]);
    expect(plans("actif").map((p) => p.c)).toEqual([10000]);
  });

  it("base neuve : rien à sauvegarder ; base existante : les migrations manquantes sont listées", () => {
    expect(pendingMigrations(new DatabaseSync(":memory:"))).toEqual([]);
    const last = migrations.at(-1)!.tag;
    expect(pendingMigrations(upTo(last))).toEqual([last]);
  });

  it("copie avant migration et sauvegarde quotidienne : sans la clé d'API, une seule fois", () => {
    const dir = mkdtempSync(join(tmpdir(), "hamac-mig-"));
    const db = upTo(migrations.at(-1)!.tag);
    db.exec(`INSERT INTO settings (key, value, updated_at) VALUES ('${MARKET_SECRETS_KEY}', '{"twelveDataKey":"cle-tres-secrete"}', 'x'), ('autre', '1', 'x')`);
    const target = backupBeforeMigration(db, dir, "0099_test")!;
    expect(backupBeforeMigration(db, dir, "0099_test")).toBeNull();
    const daily = dailyBackup(db, dir, new Date("2026-11-08T12:00:00Z"))!;
    for (const file of [target, daily]) {
      expect(readFileSync(file).includes("cle-tres-secrete")).toBe(false);
      const copy = new DatabaseSync(file);
      expect(copy.prepare("SELECT count(*) AS n FROM settings").get()).toEqual({ n: 1 });
      copy.close();
    }
    expect(db.prepare("SELECT count(*) AS n FROM settings").get()).toEqual({ n: 2 });
  });
});
