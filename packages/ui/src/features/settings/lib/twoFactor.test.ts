import { describe, expect, it } from "vitest";
import { cleanAppCode, cleanRecoveryCode, groupKey, loginCodeReady, recoveryCodesFile, recoveryCodesLeftText, twoFactorNudge } from "./twoFactor";

const me = (enabled: boolean, available = true, isAdmin = false) => ({ isAdmin, twoFactor: { enabled, available, recoveryCodesLeft: 0 } });

describe("incitation à activer la double authentification", () => {
  it("fenêtre après une connexion seulement, bandeau tout le temps", () => {
    expect(twoFactorNudge(me(false), true)).toEqual({ modal: true, banner: true, admin: false });
    expect(twoFactorNudge(me(false), false)).toEqual({ modal: false, banner: true, admin: false });
  });

  it("disparaît dès l'activation", () => {
    expect(twoFactorNudge(me(true), true)).toEqual({ modal: false, banner: false, admin: false });
  });

  it("message renforcé pour le compte administrateur", () => {
    expect(twoFactorNudge(me(false, true, true), true).admin).toBe(true);
    expect(twoFactorNudge(me(true, true, true), true).admin).toBe(false);
  });

  it("n'insiste pas si le serveur ne peut pas l'activer", () => {
    expect(twoFactorNudge(me(false, false), true)).toEqual({ modal: false, banner: false, admin: false });
  });

  it("rien sans compte", () => {
    expect(twoFactorNudge(null, true)).toEqual({ modal: false, banner: false, admin: false });
  });
});

describe("saisie des codes", () => {
  it("garde les six chiffres du code de l'application", () => {
    expect(cleanAppCode("12 34-56789")).toBe("123456");
    expect(cleanAppCode("abc")).toBe("");
  });

  it("met en forme le code de secours pendant la frappe", () => {
    expect(cleanRecoveryCode("abcd")).toBe("ABCD");
    expect(cleanRecoveryCode("abcde")).toBe("ABCD-E");
    expect(cleanRecoveryCode("ab cd-23 45xx")).toBe("ABCD-2345");
  });

  it("n'autorise l'envoi que d'un code complet", () => {
    expect(loginCodeReady("12345", false)).toBe(false);
    expect(loginCodeReady("123456", false)).toBe(true);
    expect(loginCodeReady("ABCD-234", true)).toBe(false);
    expect(loginCodeReady("ABCD-2345", true)).toBe(true);
    expect(loginCodeReady("123456", true)).toBe(false);
  });
});

describe("textes", () => {
  it("regroupe la clé par quatre", () => {
    expect(groupKey("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
  });

  it("écrit le fichier de codes avec un code par ligne", () => {
    const text = recoveryCodesFile("a@exemple.fr", ["AAAA-2222", "BBBB-3333"], new Date("2026-11-09T12:00:00Z"));
    expect(text).toContain("Compte : a@exemple.fr");
    expect(text.split("\n")).toEqual(expect.arrayContaining(["AAAA-2222", "BBBB-3333"]));
  });

  it("accorde le nombre de codes restants", () => {
    expect(recoveryCodesLeftText(0)).toMatch(/aucun/);
    expect(recoveryCodesLeftText(1)).toBe("Il vous reste 1 code de secours.");
    expect(recoveryCodesLeftText(10)).toBe("Il vous reste 10 codes de secours.");
  });
});
