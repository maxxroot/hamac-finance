import { describe, expect, it } from "vitest";
import { mergePrices, type PriceRow } from "./merge";

const row = (date: string, price: number, source: string, assetId = "a"): PriceRow => ({ assetId, date, price, source });

describe("fusion des cours", () => {
  it("manuel, puis commun, puis historique du tenant", () => {
    const out = mergePrices([row("2026-10-30", 1, "manuel"), row("2026-09-30", 2, "justetf")], [row("2026-10-30", 3, "euronext"), row("2026-09-30", 4, "euronext")], new Set());
    expect(out.find((p) => p.date === "2026-10-30")?.price).toBe(1);
    expect(out.find((p) => p.date === "2026-09-30")?.price).toBe(4);
  });

  it("l'historique restauré comble les mois absents de la base commune", () => {
    expect(mergePrices([row("2020-01-31", 7, "yahoo")], [row("2026-10-30", 3, "euronext")], new Set()).map((p) => p.price).sort()).toEqual([3, 7]);
  });

  it("dernier cours du mois, sauf titres suivis chaque jour", () => {
    const shared = [row("2026-10-10", 1, "x"), row("2026-10-30", 2, "x"), row("2026-10-10", 3, "x", "btc"), row("2026-10-30", 4, "x", "btc")];
    const out = mergePrices([], shared, new Set(["btc"]));
    expect(out.filter((p) => p.assetId === "a").map((p) => p.date)).toEqual(["2026-10-30"]);
    expect(out.filter((p) => p.assetId === "btc")).toHaveLength(2);
  });
});
