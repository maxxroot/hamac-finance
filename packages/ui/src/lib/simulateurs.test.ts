import { describe, expect, it } from "vitest";
import { defaultParams } from "@hamac/core";
import { decodeState, defaultState, encodeState, linesByYear, newSim, runSim, SIM_KINDS, taxContext, type SimConfig } from "./simulateurs";

const TODAY = "2026-11-11";
const params = defaultParams(new Date(2026, 10, 11));

describe("simulateurs : état dans l'adresse", () => {
  it("aller-retour sans perte, accents compris", () => {
    const state = defaultState(TODAY);
    const pea = { ...newSim("actions", TODAY, state.sims), name: "PEA à 7 % — éssai" };
    const next = { ...state, amount: 25_000, horizon: 8, reinvestPct: 2.5, regime: "bareme" as const, tmi: 0.3 as const, sims: [...state.sims, pea], selected: pea.id };
    expect(decodeState(encodeState(next), TODAY)).toEqual(next);
  });

  it("toutes les simulations supprimées : la liste reste vide", () => {
    const empty = { ...defaultState(TODAY), sims: [], selected: "" };
    expect(decodeState(encodeState(empty), TODAY).sims).toEqual([]);
  });

  it("une adresse abîmée ou trafiquée retombe sur des valeurs sûres", () => {
    expect(decodeState("pas du base64 !", TODAY).sims).toHaveLength(1);
    const forged = btoa(JSON.stringify({ amount: -5, regime: "x", tmi: 0.99, sims: [{ kind: "obligation", input: { pricePct: "90", couponPct: 4, inconnu: 1 } }, { kind: "inconnu" }] }));
    const s = decodeState(forged, TODAY);
    expect(s.amount).toBe(10_000);
    expect(s.regime).toBe("auto");
    expect(s.tmi).toBeNull();
    expect(s.sims).toHaveLength(1);
    const input = s.sims[0]!.input as unknown as Record<string, unknown>;
    expect(input.couponPct).toBe(4);
    // Un nombre envoyé en texte n'est pas repris ; un champ inconnu non plus.
    expect(input.pricePct).toBe(90);
    expect(input.inconnu).toBeUndefined();
  });
});

describe("simulateurs : calcul", () => {
  const sim = newSim("obligation", TODAY, []) as Extract<SimConfig, { kind: "obligation" }>;
  const tax = taxContext({ tmi: null, couple: null }, params);

  it("le plus avantageux : barème à 11 %, prélèvement forfaitaire à 30 %", () => {
    expect(runSim(sim, 9_000, "auto", tax)!.shownRegime).toBe("bareme");
    expect(runSim(sim, 9_000, "auto", { ...tax, tmi: 0.3 })!.shownRegime).toBe("pfu");
    expect(runSim(sim, 9_000, "pfu", tax)!.shownRegime).toBe("pfu");
  });

  it("une échéance déjà passée ne donne pas de résultat", () => {
    const past: SimConfig = { ...sim, input: { ...sim.input, maturityDate: "2020-01-01" } };
    expect(runSim(past, 9_000, "auto", tax)).toBeNull();
  });

  it("année par année : les intérêts qui restent placés comptent pour l'impôt, pas dans l'argent reçu", () => {
    const fe = newSim("fondsEuros", TODAY, []);
    const r = runSim(fe, 10_000, "pfu", tax)!.shown;
    const years = linesByYear(r.lines);
    const first = years.find((y) => y.year === "2027")!;
    expect(first.gross).toBe(0);
    expect(first.social).toBeGreaterThan(0);
  });
});

describe("simulateurs : même durée pour toutes", () => {
  const tax = taxContext({ tmi: null, couple: null }, params);

  it("chaque placement s'arrête au même jour, quelle que soit sa durée propre", () => {
    const horizon = { years: 7, reinvestPct: 1.7 };
    for (const kind of SIM_KINDS) {
      const o = runSim(newSim(kind, TODAY, []), 10_000, "auto", tax, horizon)!;
      expect(o, kind).not.toBeNull();
      expect(o.shown.endDate, kind).toBe("2033-11-11");
    }
  });

  it("l'obligation à 5 ans sur 7 ans : remboursée, puis l'argent replacé deux ans", () => {
    const bond = newSim("obligation", TODAY, []);
    const alone = runSim(bond, 9_000, "pfu", tax)!.shown;
    const longer = runSim(bond, 9_000, "pfu", tax, { years: 7, reinvestPct: 1.7 })!.shown;
    expect(longer.netGain).toBeGreaterThan(alone.netGain);
    expect(longer.netRate!).toBeLessThan(alone.netRate!);
  });

  it("l'obligation sur 3 ans : revendue avant l'échéance", () => {
    const o = runSim(newSim("obligation", TODAY, []), 9_000, "pfu", tax, { years: 3, reinvestPct: 0 })!.shown;
    expect(o.lines.some((l) => l.label.startsWith("Revente"))).toBe(true);
  });
});
