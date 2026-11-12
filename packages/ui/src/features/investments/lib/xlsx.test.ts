import { describe, expect, it } from "vitest";
import { readXlsx } from "./xlsx";
import { makeXlsx } from "./xlsx.fixture";

describe("lecture d'un classeur xlsx", () => {
  it("lit les onglets, le texte, les entités, les nombres et les cellules vides", async () => {
    const sheets = await readXlsx(await makeXlsx([["id", "montant"], ["a & b", -12.5], ["c", null, 3]], "feuille"));
    expect(sheets).toEqual([{ name: "feuille", rows: [["id", "montant"], ["a & b", -12.5], ["c", null, 3]] }].map((s) => ({ ...s, rows: [s.rows[0], s.rows[1], s.rows[2]] })));
  });

  it("refuse un fichier qui n'est pas un classeur", async () => {
    await expect(readXlsx(new Uint8Array([1, 2, 3]))).rejects.toThrow(/xlsx/);
    await expect(readXlsx(new Uint8Array(40))).rejects.toThrow(/xlsx/);
  });
});
