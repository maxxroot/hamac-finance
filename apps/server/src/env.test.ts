import { describe, expect, it } from "vitest";
import { databaseUrl, intFromEnv } from "./env";

describe("réglages du fichier .env", () => {
  it("une valeur absente ou vide prend le défaut", () => {
    expect(intFromEnv({}, "X", 30, 10)).toBe(30);
    expect(intFromEnv({ X: "" }, "X", 30, 10)).toBe(30);
    expect(intFromEnv({ X: " 45 " }, "X", 30, 10)).toBe(45);
  });

  it("une valeur invalide est refusée au démarrage", () => {
    expect(() => intFromEnv({ X: "5" }, "X", 30, 10)).toThrow(/X doit être/);
    expect(() => intFromEnv({ X: "1,5" }, "X", 30, 1)).toThrow(/X doit être/);
    expect(() => intFromEnv({ X: "trente" }, "X", 30, 1)).toThrow(/X doit être/);
  });

  it("la base locale utilise le mot de passe du .env, sauf adresse explicite", () => {
    expect(databaseUrl({})).toBe("postgres://hamac:hamac@localhost:5432/hamac");
    expect(databaseUrl({ HAMAC_DB_PASSWORD: "a/b" })).toBe("postgres://hamac:a%2Fb@localhost:5432/hamac");
    expect(databaseUrl({ DATABASE_URL: "postgres://x", HAMAC_DB_PASSWORD: "y" })).toBe("postgres://x");
  });
});
