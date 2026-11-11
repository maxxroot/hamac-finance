import { describe, expect, it } from "vitest";
import type { PeriodChange } from "@hamac/core";
import { activeShortcut, barSpan, byYear, defaultRange, inRange, parseRange, pointLabel, rangeFromMilestone, shortcutRange, waterfall } from "./historique";

const months = Array.from({ length: 23 }, (_, i) => `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`); // 2025-01 → 2026-11

const change = (over: Partial<PeriodChange["flows"]> = {}, sources: Partial<PeriodChange["sources"]> = {}, startValue = 10_000): PeriodChange => {
  const flows = { deposits: 0, withdrawals: 0, transfersIn: 0, transfersOut: 0, ...over };
  const s = { unrealized: 0, realized: 0, dividends: 0, interests: 0, billedFees: 0, taxes: 0, other: 0, total: 0, allFees: 0, embeddedFees: 0, ...sources };
  s.total = s.unrealized + s.realized + s.dividends + s.interests - s.billedFees - s.taxes + s.other;
  const endValue = startValue + flows.deposits - flows.withdrawals + flows.transfersIn - flows.transfersOut + s.total;
  return { startValue, endValue, flows, sources: s };
};

describe("période de la page Historique", () => {
  it("par défaut la dernière année, tout l'historique s'il est plus court", () => {
    expect(defaultRange(months)).toEqual({ from: "2025-11", to: "2026-11" });
    expect(defaultRange(months.slice(0, 5))).toEqual({ from: null, to: "2025-05" });
  });

  it("raccourcis comptés depuis le point d'arrivée", () => {
    expect(shortcutRange("1m", "2026-11", months).from).toBe("2026-10");
    expect(shortcutRange("janvier", "2026-11", months).from).toBe("2025-12");
    expect(shortcutRange("janvier", "2025-06", months).from).toBeNull();
    expect(activeShortcut({ from: "2025-11", to: "2026-11" }, months)).toBe("1a");
    expect(activeShortcut({ from: "2025-03", to: "2026-11" }, months)).toBeNull();
  });

  it("lit l'adresse et ignore ce qui n'existe pas", () => {
    expect(parseRange("2025-03", "2026-02", months)).toEqual({ from: "2025-03", to: "2026-02" });
    expect(parseRange("debut", null, months)).toEqual({ from: null, to: "2026-11" });
    expect(parseRange("2026-05", "2026-02", months)).toEqual({ from: "2025-02", to: "2026-02" });
    expect(parseRange("n'importe quoi", "1999-01", months)).toEqual(defaultRange(months));
  });

  it("libellés des points", () => {
    expect(pointLabel("2026-11", "2026-11")).toBe("Aujourd'hui");
    expect(pointLabel("2025-03", "2026-11")).toBe("Fin mars 2025");
    expect(pointLabel(null, "2026-11")).toBe("Au départ");
  });

  it("une étape ouvre la période à la fin du mois précédent, pour l'inclure", () => {
    expect(rangeFromMilestone({ month: "2025-06" }, { from: "2026-01", to: "2026-11" }, months)).toEqual({ from: "2025-05", to: "2026-11" });
    // Étape après le point d'arrivée : on va jusqu'à aujourd'hui.
    expect(rangeFromMilestone({ month: "2026-08" }, { from: "2025-01", to: "2026-03" }, months)).toEqual({ from: "2026-07", to: "2026-11" });
    // Étape du premier mois, ou d'avant le suivi : depuis le début.
    expect(rangeFromMilestone({ month: "2025-01" }, { from: "2025-06", to: "2026-11" }, months).from).toBeNull();
    expect(inRange({ date: "2025-03-31" }, "2025-03-31", "2026-11-11")).toBe(false);
    expect(inRange({ date: "2025-04-01" }, "2025-03-31", "2026-11-11")).toBe(true);
    expect(inRange({ date: "2020-01-01" }, null, "2026-11-11")).toBe(true);
  });

  it("regroupe par année, la plus récente d'abord", () => {
    const groups = byYear([{ date: "2025-02-01" }, { date: "2026-03-01" }, { date: "2025-09-01" }]);
    expect(groups.map((g) => g.year)).toEqual(["2026", "2025"]);
    expect(groups[1]!.items.map((m) => m.date)).toEqual(["2025-09-01", "2025-02-01"]);
  });
});

describe("cascade", () => {
  it("enchaîne départ, argent apporté, gains, arrivée, sans les lignes nulles", () => {
    const w = waterfall(change({ deposits: 2_000, withdrawals: 500 }, { unrealized: 800, dividends: 100, billedFees: 20 }), "Fin mars 2025", "Aujourd'hui");
    expect(w.rows.map((r) => r.key)).toEqual(["depart", "versements", "retraits", "latentes", "dividendes", "frais", "arrivee"]);
    expect(w.money).toBe(1_500);
    expect(w.gain).toBe(880);
    const last = w.rows.at(-2)!;
    expect(last.to).toBe(w.rows.at(-1)!.to);
    expect(w.rows.at(-1)!.to).toBe(12_380);
  });

  it("resserre l'échelle quand les variations sont faibles devant le total", () => {
    const small = waterfall(change({ deposits: 200 }, { unrealized: -100 }, 100_000), "Fin mars 2025", "Aujourd'hui");
    expect(small.zoomed).toBe(true);
    expect(small.lo).toBeGreaterThan(0);
    const span = barSpan(small.rows[1]!, small);
    expect(span.width).toBeGreaterThan(10);
    const big = waterfall(change({ deposits: 20_000 }, {}, 0), null, "Aujourd'hui");
    expect(big.zoomed).toBe(false);
    expect(big.lo).toBe(0);
    expect(big.rows[0]!.key).toBe("versements");
  });
});
