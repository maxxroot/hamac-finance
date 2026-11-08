import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./migrate";
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
});
