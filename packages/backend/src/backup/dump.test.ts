import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import { TABLES } from "./dump";

describe("liste des tables sauvegardées", () => {
  it("contient chaque table du schéma, une seule fois : une table oubliée disparaîtrait des sauvegardes", () => {
    const tables = Object.values(schema).filter((v) => is(v, PgTable)).map((t) => getTableName(t as PgTable));
    expect([...TABLES].sort()).toEqual([...new Set(tables)].sort());
    expect(new Set(TABLES).size).toBe(TABLES.length);
  });
});
