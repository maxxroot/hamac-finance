import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PasswordHasher } from "./password";

const light = { memorySize: 64, iterations: 1, parallelism: 1 };

describe("mots de passe", () => {
  it("Argon2id : format PHC, paramètres OWASP par défaut, sel différent à chaque fois", async () => {
    const hasher = new PasswordHasher();
    const stored = await hasher.hash("correct horse");
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=47104,t=1,p=1\$[^$]+\$[^$]+$/);
    expect(await hasher.hash("correct horse")).not.toBe(stored);
    expect(await hasher.verify("correct horse", stored)).toEqual({ ok: true, outdated: false });
    expect(await hasher.verify("mauvais", stored)).toEqual({ ok: false, outdated: false });
  });

  it("vecteur de référence : même résultat qu'une autre implémentation d'Argon2id", async () => {
    // Calculé avec argon2-cffi 25.1 (bibliothèque de référence en C) : hash_secret(b"password", b"somesalt", t=1, m=64, p=1, len=32, Type.ID).
    const stored = "$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHQ$cpx6VEQbwTVZvcpxNIxOVUWZ5xnAipUmAe1cg2GMG70";
    expect(await new PasswordHasher(light).verify("password", stored)).toEqual({ ok: true, outdated: false });
    expect((await new PasswordHasher(light).verify("Password", stored)).ok).toBe(false);
  });

  it("signale une empreinte dont les paramètres ont changé", async () => {
    const stored = await new PasswordHasher(light).hash("secret");
    expect(await new PasswordHasher().verify("secret", stored)).toEqual({ ok: true, outdated: true });
  });

  it("vérifie les anciennes empreintes scrypt et demande leur conversion", async () => {
    const salt = randomBytes(16);
    const legacy = `scrypt$${salt.toString("base64")}$${scryptSync("ancien", salt, 64, { N: 16384, r: 8, p: 1 }).toString("base64")}`;
    const hasher = new PasswordHasher(light);
    expect(await hasher.verify("ancien", legacy)).toEqual({ ok: true, outdated: true });
    expect((await hasher.verify("mauvais", legacy)).ok).toBe(false);
  });

  it("refuse une empreinte illisible", async () => {
    expect((await new PasswordHasher(light).verify("x", "n'importe quoi")).ok).toBe(false);
  });
});
