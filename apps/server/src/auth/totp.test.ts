import { describe, expect, it } from "vitest";
import { base32, hotp, matchTotp, newTotpSecret, otpauthUri, totp, totpStep } from "./totp";

const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");

describe("TOTP", () => {
  it("donne les valeurs officielles de la RFC 6238 (annexe B, SHA-1, 8 chiffres)", () => {
    expect(totp(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totp(RFC_SECRET, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totp(RFC_SECRET, 1_234_567_890_000, 8)).toBe("89005924");
    expect(totp(RFC_SECRET, 2_000_000_000_000, 8)).toBe("69279037");
    expect(totp(RFC_SECRET, 20_000_000_000_000, 8)).toBe("65353130");
  });

  it("donne les valeurs officielles de la RFC 4226 (annexe D, 6 chiffres)", () => {
    expect([0, 1, 2, 9].map((c) => hotp(RFC_SECRET, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });

  it("accepte un pas d'écart de chaque côté, pas davantage", () => {
    const now = 1_700_000_010_000;
    const at = (delta: number) => totp(RFC_SECRET, now + delta * 30_000);
    expect(matchTotp(RFC_SECRET, at(0), now, -1)).toBe(totpStep(now));
    expect(matchTotp(RFC_SECRET, at(-1), now, -1)).toBe(totpStep(now) - 1);
    expect(matchTotp(RFC_SECRET, at(1), now, -1)).toBe(totpStep(now) + 1);
    expect(matchTotp(RFC_SECRET, at(-2), now, -1)).toBeNull();
    expect(matchTotp(RFC_SECRET, at(2), now, -1)).toBeNull();
  });

  it("refuse un code déjà accepté, et un code plus ancien que le dernier accepté", () => {
    const now = 1_700_000_010_000;
    const code = totp(RFC_SECRET, now);
    const step = matchTotp(RFC_SECRET, code, now, -1)!;
    expect(matchTotp(RFC_SECRET, code, now, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, now - 30_000), now, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, now + 30_000), now, step)).toBe(step + 1);
  });

  it("refuse ce qui n'est pas exactement six chiffres", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 456", "١٢٣٤٥٦"]) expect(matchTotp(RFC_SECRET, bad, 59_000, -1)).toBeNull();
  });

  it("encode en base32 selon la RFC 4648", () => {
    const cases: Array<[string, string]> = [["", ""], ["f", "MY"], ["fo", "MZXQ"], ["foo", "MZXW6"], ["foob", "MZXW6YQ"], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI"]];
    for (const [plain, encoded] of cases) expect(base32(Buffer.from(plain))).toBe(encoded);
  });

  it("tire un secret de 160 bits, différent à chaque fois", () => {
    expect(newTotpSecret()).toHaveLength(20);
    expect(newTotpSecret().equals(newTotpSecret())).toBe(false);
  });

  it("construit l'adresse lue par les applications, compte encodé", () => {
    expect(otpauthUri(RFC_SECRET, "a+b@exemple.fr", "Hamac")).toBe("otpauth://totp/Hamac:a%2Bb%40exemple.fr?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Hamac&algorithm=SHA1&digits=6&period=30");
  });
});
