import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackend, type Backend } from "./index";

let backend: Backend | null = null;
afterEach(() => backend?.close());

function memory() {
  backend = createBackend({ databasePath: ":memory:", mode: "desktop", appVersion: "test", backupsDir: null });
  return backend;
}

describe("backend", () => {
  it("applique les migrations et renvoie les infos système", async () => {
    const res = await memory().dispatch("system.info", undefined);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ mode: "desktop", appVersion: "test" });
  });

  it("renvoie null pour un réglage jamais enregistré", async () => {
    expect(await memory().dispatch("settings.get", { key: "ui.lastRoute" })).toEqual({ ok: true, data: null });
  });

  it("enregistre et relit un réglage", async () => {
    const b = memory();
    expect(await b.dispatch("settings.set", { key: "ui.privacyMode", value: true })).toEqual({ ok: true });
    expect(await b.dispatch("settings.get", { key: "ui.privacyMode" })).toEqual({ ok: true, data: true });
  });

  it("refuse une entrée invalide et une procédure inconnue", async () => {
    const b = memory();
    const bad = await b.dispatch("settings.set", { key: "nimporte.quoi", value: 1 });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
    const unknown = await b.dispatch("rien.du.tout", {});
    expect(unknown.ok === false && unknown.error.code).toBe("NOT_FOUND");
  });

  it("crée une sauvegarde quotidienne sur disque", () => {
    const dir = mkdtempSync(join(tmpdir(), "hamac-"));
    backend = createBackend({
      databasePath: join(dir, "hamac.sqlite"),
      mode: "desktop",
      appVersion: "test",
      backupsDir: join(dir, "sauvegardes"),
    });
    expect(readdirSync(join(dir, "sauvegardes"))).toHaveLength(1);
  });
});
