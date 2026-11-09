import { describe, expect, it } from "vitest";
import { qrDrawing } from "./qr";

const URI = "otpauth://totp/Hamac:a%40exemple.fr?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Hamac&algorithm=SHA1&digits=6&period=30";

describe("QR code", () => {
  it("a la taille d'un QR valide, marge blanche comprise", () => {
    const { size } = qrDrawing(URI);
    expect((size - 8 - 21) % 4).toBe(0);
    expect(size).toBeGreaterThan(29);
  });

  it("dessine le repère du coin supérieur gauche après la marge", () => {
    const { path } = qrDrawing(URI);
    expect(path.startsWith("M4 4h7v1h-7z")).toBe(true);
    expect(path).toMatch(/M4 10h7v1h-7z/);
  });

  it("donne toujours le même dessin pour le même texte, et un autre pour un autre texte", () => {
    expect(qrDrawing(URI)).toEqual(qrDrawing(URI));
    expect(qrDrawing(URI).path).not.toBe(qrDrawing(`${URI}&x=1`).path);
  });
});
