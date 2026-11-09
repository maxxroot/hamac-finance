import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY_FILE, loadTwoFactorKey, parseKey, SecretBox } from "./twoFactorKey";

const KEY_A = Buffer.alloc(32, 1);
const KEY_B = Buffer.alloc(32, 2);
const SECRET = Buffer.from("12345678901234567890");
const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "hamac-2fa-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("chiffrement du secret", () => {
  it("rend le secret à la même clé et au même compte", () => {
    const box = new SecretBox(KEY_A);
    expect(box.open("compte-1", box.seal("compte-1", SECRET))?.equals(SECRET)).toBe(true);
  });

  it("ne laisse rien lire en clair et chiffre différemment à chaque fois", () => {
    const box = new SecretBox(KEY_A);
    const sealed = box.seal("compte-1", SECRET);
    expect(sealed).not.toContain(SECRET.toString("base64url"));
    expect(sealed).not.toBe(box.seal("compte-1", SECRET));
  });

  it("refuse une mauvaise clé, un autre compte, une valeur modifiée ou mal formée", () => {
    const box = new SecretBox(KEY_A);
    const sealed = box.seal("compte-1", SECRET);
    expect(new SecretBox(KEY_B).open("compte-1", sealed)).toBeNull();
    expect(box.open("compte-2", sealed)).toBeNull();
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[2]!, "base64url");
    flipped[0]! ^= 1;
    expect(box.open("compte-1", [parts[0], parts[1], flipped.toString("base64url"), parts[3]].join("."))).toBeNull();
    for (const bad of ["", "v1", "v2.a.b.c", "v1.a.b.c"]) expect(box.open("compte-1", bad)).toBeNull();
  });

  it("calcule une empreinte de code de secours propre à la clé et au compte", () => {
    const box = new SecretBox(KEY_A);
    expect(box.recoveryHash("compte-1", "ABCD2345")).toBe(box.recoveryHash("compte-1", "ABCD2345"));
    expect(box.recoveryHash("compte-1", "ABCD2345")).not.toBe(box.recoveryHash("compte-2", "ABCD2345"));
    expect(box.recoveryHash("compte-1", "ABCD2345")).not.toBe(new SecretBox(KEY_B).recoveryHash("compte-1", "ABCD2345"));
  });
});

describe("clé de l'instance", () => {
  it("lit 32 octets en base64 ou en hexadécimal, rien d'autre", () => {
    expect(parseKey(KEY_A.toString("base64"))?.equals(KEY_A)).toBe(true);
    expect(parseKey(KEY_A.toString("hex"))?.equals(KEY_A)).toBe(true);
    expect(parseKey(` ${KEY_A.toString("base64")}\n`)?.equals(KEY_A)).toBe(true);
    for (const bad of ["", "trop-courte", Buffer.alloc(16).toString("base64"), "z".repeat(64)]) expect(parseKey(bad)).toBeNull();
  });

  it("utilise HAMAC_2FA_KEY et ne crée alors aucun fichier", () => {
    const dir = tempDir();
    expect(loadTwoFactorKey(KEY_A.toString("base64"), dir).ok).toBe(true);
    expect(existsSync(join(dir, KEY_FILE))).toBe(false);
  });

  it("une variable invalide ne se rabat pas sur le fichier, ne plante pas et ne recopie pas la valeur", () => {
    const dir = tempDir();
    const key = loadTwoFactorKey("valeur-secrete-invalide", dir);
    expect(key.ok).toBe(false);
    expect(!key.ok && key.reason).toMatch(/HAMAC_2FA_KEY/);
    expect(!key.ok && key.reason).not.toMatch(/valeur-secrete/);
    expect(existsSync(join(dir, KEY_FILE))).toBe(false);
  });

  it("génère le fichier en mode 600 au premier lancement, puis garde la même clé", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dir = tempDir();
    const first = loadTwoFactorKey(undefined, dir);
    const path = join(dir, KEY_FILE);
    expect(first.ok).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(parseKey(readFileSync(path, "utf8"))).not.toBeNull();
    const second = loadTwoFactorKey("", dir);
    if (!first.ok || !second.ok) throw new Error("clé attendue");
    expect(second.box.open("c", first.box.seal("c", SECRET))?.equals(SECRET)).toBe(true);
  });

  it("resserre les droits d'un fichier trop ouvert", () => {
    const dir = tempDir();
    const path = join(dir, KEY_FILE);
    writeFileSync(path, KEY_A.toString("base64"));
    chmodSync(path, 0o644);
    expect(loadTwoFactorKey(undefined, dir).ok).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("un fichier corrompu ou un dossier impossible à écrire donnent une erreur claire, sans exception", () => {
    const dir = tempDir();
    writeFileSync(join(dir, KEY_FILE), "abimee");
    const corrupted = loadTwoFactorKey(undefined, dir);
    expect(!corrupted.ok && corrupted.reason).toMatch(/clé valide/);
    const file = join(dir, "pas-un-dossier");
    writeFileSync(file, "");
    const unwritable = loadTwoFactorKey(undefined, file);
    expect(!unwritable.ok && unwritable.reason).toMatch(/impossible/);
  });
});
