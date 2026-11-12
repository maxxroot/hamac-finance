import { describe, expect, it } from "vitest";
import type { AccountState, Alert, AllocationRow, HistoryPoint } from "@hamac/core";
import { accountHistory, assetLines, accountLines, positionHistory, allocationBars, alertsToReview, accountRows, gainBand, gainSinceLastMonth, historyForPeriod } from "./dashboard";

const point = (i: number, value = 100, netContrib = 80): HistoryPoint => ({ date: `m${i}`, month: `2026-${String(i).padStart(2, "0")}`, value, netContrib, gain: value - netContrib, realEstate: 0, otherAssets: 0, debts: 0, netWorth: value, buckets: {} as HistoryPoint["buckets"], byAccount: {}, contribByAccount: {}, byPosition: {}, detailByAccount: {}, positionResults: {} });
const history = Array.from({ length: 20 }, (_, i) => point(i + 1));
const account = (id: string, value: number, netContrib = value, gain = 0) => ({ account: { id, name: id }, value, netContrib, gain }) as unknown as AccountState;
const allocation = (key: string, share: number, target: number) => ({ key, share, target }) as AllocationRow;

describe("tableau de bord", () => {
  it("garde le point de départ de la période, et tout l'historique s'il est plus court", () => {
    expect(historyForPeriod(history, "3M")).toHaveLength(4);
    expect(historyForPeriod(history, "1A")).toHaveLength(13);
    expect(historyForPeriod(history, "3A")).toHaveLength(20);
    expect(historyForPeriod(history, "Tout")).toHaveLength(20);
  });

  it("historique d'un compte : additionne, calcule le gain, ignore les mois d'avant son ouverture", () => {
    const at = (i: number, a: number, c: number) => ({ ...point(i), byAccount: { lep: a, autre: 999 }, contribByAccount: { lep: c, autre: 1 } });
    expect(accountHistory([at(1, 0, 0), at(2, 100, 100), at(3, 112, 100)], ["lep"])).toEqual([
      { month: "2026-02", value: 100, netContrib: 100, gain: 0 },
      { month: "2026-03", value: 112, netContrib: 100, gain: 12 },
    ]);
    expect(accountHistory([at(1, 10, 8)], ["lep", "autre"])[0]).toMatchObject({ value: 1009, netContrib: 9, gain: 1000 });
    expect(accountHistory([at(1, 10, 8)], ["inconnu"])).toEqual([]);
  });

  it("une courbe par enveloppe : la plus grosse d'abord, sans compte toujours vide, noms en double numérotés", () => {
    const at = (i: number, byAccount: Record<string, number>) => ({ ...point(i), byAccount });
    const h = [at(1, { pea: 100, av: 0, vide: 0 }), at(2, { pea: 120, av: 300, vide: 0 })];
    const accounts = [
      { id: "pea", name: "Épargne" },
      { id: "av", name: "Épargne" },
      { id: "vide", name: "Vide" },
    ];
    expect(accountLines(h, accountHistory(h, ["pea", "av", "vide"]), accounts).map((l) => [l.key, l.name, l.values])).toEqual([
      ["av", "Épargne", [0, 300]],
      ["pea", "Épargne (2)", [100, 120]],
    ]);
  });

  describe("titre par titre", () => {
    const at = (i: number, total: number, positions: Record<string, { value: number; cost: number }>) => ({ ...point(i), byAccount: { pea: total }, contribByAccount: { pea: total }, byPosition: positions });
    const name = (id: string) => id.toUpperCase();

    it("historique d'un titre : prix de revient comme montant investi, à partir de son achat", () => {
      const h = [at(1, 100, {}), at(2, 100, { "pea:a": { value: 60, cost: 50 } }), at(3, 100, { "pea:a": { value: 70, cost: 50 } })];
      expect(positionHistory(h, "pea", "a")).toEqual([
        { month: "2026-02", value: 60, netContrib: 50, gain: 10 },
        { month: "2026-03", value: 70, netContrib: 50, gain: 20 },
      ]);
      expect(positionHistory(h, "autre", "a")).toEqual([]);
    });

    it("une courbe par titre, plus les espèces : leur somme redonne le total", () => {
      const h = [at(1, 100, { "pea:a": { value: 60, cost: 50 } }), at(2, 130, { "pea:a": { value: 70, cost: 50 }, "pea:b": { value: 40, cost: 40 } })];
      const lines = assetLines(h, accountHistory(h, ["pea"]), ["pea"], name);
      expect(lines.map((l) => [l.key, l.name, l.values])).toEqual([
        ["a", "A", [60, 70]],
        ["b", "B", [0, 40]],
        ["especes", "Espèces", [40, 20]],
      ]);
    });

    it("sans titre, pas de courbe (un livret) ; sans espèces, pas de ligne vide", () => {
      const vide = [at(1, 100, {}), at(2, 110, {})];
      expect(assetLines(vide, accountHistory(vide, ["pea"]), ["pea"], name)).toEqual([]);
      const h = [at(1, 60, { "pea:a": { value: 60, cost: 50 } })];
      expect(assetLines(h, accountHistory(h, ["pea"]), ["pea"], name).map((l) => l.key)).toEqual(["a"]);
    });

    it("un même titre sur deux comptes additionnés ne fait qu'une courbe", () => {
      const h = [{ ...point(1), byAccount: { x: 30, y: 20 }, contribByAccount: { x: 30, y: 20 }, byPosition: { "x:btc": { value: 30, cost: 30 }, "y:btc": { value: 20, cost: 20 } } }];
      expect(assetLines(h, accountHistory(h, ["x", "y"]), ["x", "y"], name)).toEqual([{ key: "btc", name: "BTC", values: [50] }]);
    });

    it("au-delà de cinq titres, les plus petits sont regroupés sans perdre de valeur", () => {
      const positions = Object.fromEntries([50, 40, 30, 20, 10, 5].map((v, i) => [`pea:t${i}`, { value: v, cost: v }]));
      const h = [at(1, 155, positions)];
      const lines = assetLines(h, accountHistory(h, ["pea"]), ["pea"], name);
      expect(lines.map((l) => l.key)).toEqual(["t0", "t1", "t2", "t3", "autres"]);
      expect(lines.at(-1)).toMatchObject({ name: "2 autres titres", values: [15] });
    });
  });

  it("le gain du mois ignore les versements", () => {
    const h = [point(1, 1000, 900), point(2, 1600, 1450)];
    expect(gainSinceLastMonth(h)).toEqual({ gain: 50, since: "2026-01" });
    expect(gainSinceLastMonth([point(1)])).toBeNull();
    expect(gainSinceLastMonth([])).toBeNull();
  });

  it("la bande de gain reste positive, y compris en perte", () => {
    expect(gainBand([point(1, 120, 100), point(2, 90, 100)])).toEqual({ base: [100, 90], band: [20, 10] });
  });

  it("ne garde que les alertes qui demandent une action", () => {
    const alerts = [{ id: "a", level: "critique" }, { id: "b", level: "ok" }, { id: "c", level: "info" }] as Alert[];
    expect(alertsToReview(alerts).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("classe les comptes, ignore les comptes vides et calcule le gain", () => {
    const rows = accountRows([account("petit", 100, 80, 20), account("vide", 0), account("grand", 400, 500, -100), account("rien-verse", 50, 0, 50)]);
    expect(rows.map((r) => r.key)).toEqual(["grand", "petit", "rien-verse"]);
    expect(rows.map((r) => r.width)).toEqual([100, 25, 12.5]);
    expect(rows.map((r) => r.gainPct)).toEqual([-0.2, 0.25, null]);
  });

  it("regroupe les plus petits comptes sans perdre de valeur", () => {
    const rows = accountRows([500, 400, 300, 200, 100, 50, 25].map((v) => account(`c${v}`, v)), 6);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toMatchObject({ key: "autres", name: "2 autres comptes", value: 75, gainPct: null });
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(1575);
    expect(accountRows([1, 2, 3, 4, 5, 6].map((v) => account(`c${v}`, v)), 6).some((r) => r.key === "autres")).toBe(false);
  });

  it("place barres et repères sur une même échelle", () => {
    expect(allocationBars([allocation("a", 0.5, 0.25), allocation("b", 0.1, 0.4)]).map((b) => [b.width, b.targetAt])).toEqual([
      [100, 50],
      [20, 80],
    ]);
    expect(allocationBars([allocation("a", 0, 0)])[0]).toMatchObject({ width: 0, targetAt: 0 });
  });
});
