import { describe, expect, it } from "vitest";
import type { AccountState, Alert, AllocationRow, HistoryPoint } from "@hamac/core";
import { accountHistory, allocationBars, alertsToReview, axisFloor, envelopeRows, gainBand, gainSinceLastMonth, historyForPeriod } from "./dashboard";

const point = (i: number, value = 100, netContrib = 80): HistoryPoint => ({ date: `m${i}`, month: `2026-${String(i).padStart(2, "0")}`, value, netContrib, gain: value - netContrib, buckets: {} as HistoryPoint["buckets"], byAccount: {}, contribByAccount: {} });
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

  it("le gain du mois ignore les versements", () => {
    const h = [point(1, 1000, 900), point(2, 1600, 1450)];
    expect(gainSinceLastMonth(h)).toEqual({ gain: 50, since: "2026-01" });
    expect(gainSinceLastMonth([point(1)])).toBeNull();
    expect(gainSinceLastMonth([])).toBeNull();
  });

  it("la bande de gain reste positive, y compris en perte", () => {
    expect(gainBand([point(1, 120, 100), point(2, 90, 100)])).toEqual({ base: [100, 90], band: [20, 10] });
  });

  it("le bas de l'axe laisse une marge et s'arrondit", () => {
    expect(axisFloor([point(1, 33_000, 27_000)])).toBe(20_000);
    expect(axisFloor([point(1, 950, 1200)])).toBe(800);
    expect(axisFloor([point(1, 500, 0)])).toBe(0);
    expect(axisFloor([])).toBe(0);
  });

  it("ne garde que les alertes qui demandent une action", () => {
    const alerts = [{ id: "a", level: "critique" }, { id: "b", level: "ok" }, { id: "c", level: "info" }] as Alert[];
    expect(alertsToReview(alerts).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("classe les comptes, ignore les comptes vides et calcule le gain", () => {
    const rows = envelopeRows([account("petit", 100, 80, 20), account("vide", 0), account("grand", 400, 500, -100), account("rien-verse", 50, 0, 50)]);
    expect(rows.map((r) => r.key)).toEqual(["grand", "petit", "rien-verse"]);
    expect(rows.map((r) => r.width)).toEqual([100, 25, 12.5]);
    expect(rows.map((r) => r.gainPct)).toEqual([-0.2, 0.25, null]);
  });

  it("regroupe les plus petits comptes sans perdre de valeur", () => {
    const rows = envelopeRows([500, 400, 300, 200, 100, 50, 25].map((v) => account(`c${v}`, v)), 6);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toMatchObject({ key: "autres", name: "2 autres comptes", value: 75, gainPct: null });
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(1575);
    expect(envelopeRows([1, 2, 3, 4, 5, 6].map((v) => account(`c${v}`, v)), 6).some((r) => r.key === "autres")).toBe(false);
  });

  it("place barres et repères sur une même échelle", () => {
    expect(allocationBars([allocation("a", 0.5, 0.25), allocation("b", 0.1, 0.4)]).map((b) => [b.width, b.targetAt])).toEqual([
      [100, 50],
      [20, 80],
    ]);
    expect(allocationBars([allocation("a", 0, 0)])[0]).toMatchObject({ width: 0, targetAt: 0 });
  });
});
