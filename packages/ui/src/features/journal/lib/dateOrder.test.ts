import { describe, expect, it } from "vitest";
import type { TxType } from "@hamac/core";
import { sortRows } from "@/shared/lib/sortRows";
import { dateOrderKey } from "./dateOrder";

const op = (id: string, date: string, type: TxType) => ({ id, date, type });

describe("ordre du journal à date égale", () => {
  // Tel que chargé : date décroissante, puis création décroissante (le versement a été créé après le retrait).
  const saved = [op("versement", "2026-11-13", "versement"), op("retrait", "2026-11-13", "retrait"), op("ancien", "2026-10-01", "achat")];
  const programme = op("programme:x:2026-11", "2026-11-13", "versement");
  const rows = [...saved, programme];
  const key = dateOrderKey(saved);

  it("du plus récent au plus ancien : le versement au-dessus du retrait", () => {
    expect(sortRows(rows, key, "desc").map((t) => t.id)).toEqual(["versement", "retrait", "programme:x:2026-11", "ancien"]);
  });

  it("du plus ancien au plus récent : le retrait avant le versement", () => {
    expect(sortRows(rows, key, "asc").map((t) => t.id)).toEqual(["ancien", "programme:x:2026-11", "retrait", "versement"]);
  });

  it("frais et impôts après l'action du même jour, même saisis avant elle", () => {
    // Saisis dans l'ordre : frais, impôts, puis l'achat (le plus récent en tête).
    const typed = [op("achat", "2026-11-13", "achat"), op("impots", "2026-11-13", "impots"), op("frais", "2026-11-13", "frais")];
    const k = dateOrderKey(typed);
    expect(sortRows(typed, k, "asc").map((t) => t.id)).toEqual(["achat", "frais", "impots"]);
    expect(sortRows(typed, k, "desc").map((t) => t.id)).toEqual(["impots", "frais", "achat"]);
  });
});
