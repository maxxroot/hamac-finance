import { describe, expect, it } from "vitest";
import type { Account } from "./domain";
import type { Institution } from "./institutions";
import { protectionOf, type ProtectionAccountInput } from "./protection";

const inst = (id: string, name: string, extra: Partial<Institution> = {}): Institution => ({
  id,
  name,
  kind: "banque",
  website: "",
  score: null,
  comment: "",
  offers: {},
  tax: { report: false, withholds: null, withheldIncomeTax: null, withheldSocial: null },
  protection: { guarantor: "", country: "france" },
  ...extra,
});

const acc = (id: string, kind: Account["kind"], institutionId: string | null, value: number, cash = value, extra: Partial<ProtectionAccountInput["account"]> = {}): ProtectionAccountInput => ({
  account: { id, name: id, kind, livretType: kind === "livret" ? "AUTRE" : null, institutionId, archived: false, ...extra },
  value,
  cash,
});

const FGAP = 70_000;

describe("protection en cas de faillite", () => {
  it("plafonne les dépôts à 100 000 € par établissement, livrets réglementés à part", () => {
    const s = protectionOf(
      [acc("Livret bancaire", "livret", "b", 90_000), acc("Livret A", "livret", "b", 22_950, 22_950, { livretType: "LIVRET_A" }), acc("Espèces CTO", "cto", "b", 30_000, 30_000)],
      [inst("b", "Banque Fictive")],
      FGAP,
    );
    const depots = s.lines.find((l) => l.guarantee === "depots")!;
    expect(depots.amount).toBe(120_000);
    expect(depots.covered).toBe(100_000);
    expect(depots.uncovered).toBe(20_000);
    expect(s.lines.find((l) => l.guarantee === "livrets")?.uncovered).toBe(0);
    expect(s.overCeiling).toBe(20_000);
  });

  it("sépare espèces et titres d'un PEA", () => {
    const s = protectionOf([acc("PEA", "pea", "c", 100_000, 4_000)], [inst("c", "Courtier", { kind: "courtier" })], FGAP);
    expect(s.lines.map((l) => [l.guarantee, l.amount, l.uncovered])).toEqual([
      ["depots", 4_000, 0],
      ["titres", 96_000, 26_000],
    ]);
  });

  it("regroupe deux marques sous le même établissement garant", () => {
    const s = protectionOf(
      [acc("Compte A", "livret", "a", 60_000), acc("Compte B", "livret", "b", 60_000)],
      [inst("a", "Marque A", { protection: { guarantor: "Groupe Fictif", country: "france" } }), inst("b", "Marque B", { protection: { guarantor: " groupe  fictif ", country: "france" } })],
      FGAP,
    );
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].institutions).toEqual(["Marque A", "Marque B"]);
    expect(s.lines[0].uncovered).toBe(20_000);
  });

  it("compte l'assurance-vie par assureur, tous contrats confondus", () => {
    const courtier1 = inst("x", "Courtier en ligne 1", { kind: "assureur", offers: { assurance_vie: { entryFee: 0, euroFee: 0, ucFee: 0, arbitrageFee: 0, euroRateLast: null, euroRate5y: null, full100Euro: null, bonusConditioned: null, etfWorld: null, datedFunds: null, programmedFrom: null, insurer: "Assureur Fictif" } } });
    const courtier2 = inst("y", "Courtier en ligne 2", { kind: "assureur", offers: { assurance_vie: { ...courtier1.offers.assurance_vie!, insurer: "Assureur Fictif" } } });
    const s = protectionOf([acc("AV 1", "assurance_vie", "x", 50_000), acc("AV 2", "assurance_vie", "y", 40_000), acc("PER", "per", "x", 10_000)], [courtier1, courtier2], FGAP);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ guarantee: "assurance", guarantor: "Assureur Fictif", amount: 100_000, covered: 70_000, uncovered: 30_000 });
  });

  it("applique les règles d'un autre pays de l'Union européenne", () => {
    const s = protectionOf([acc("Compte", "cto", "e", 130_000, 110_000)], [inst("e", "Courtier européen", { protection: { guarantor: "", country: "ue" } })], FGAP);
    expect(s.lines.find((l) => l.guarantee === "depots")?.uncovered).toBe(10_000);
    expect(s.lines.find((l) => l.guarantee === "titres")).toMatchObject({ ceiling: 20_000, uncovered: 0 });
  });

  it("classe à part le crowdlending, la crypto et les comptes sans établissement", () => {
    const s = protectionOf([acc("Prêts", "crowdlending", "p", 8_000), acc("Crypto", "crypto", "p", 2_000), acc("Livret orphelin", "livret", null, 5_000)], [inst("p", "Plateforme")], FGAP);
    expect(s.unprotected).toBe(10_000);
    expect(s.toCheck).toBe(5_000);
    expect(s.overCeiling).toBe(0);
  });

  it("ne compte que la part détenue d'un compte joint", () => {
    const s = protectionOf([acc("Joint", "livret", "b", 160_000, 160_000, { share: 0.5 })], [inst("b", "Banque")], FGAP);
    expect(s.lines[0]).toMatchObject({ amount: 80_000, uncovered: 0 });
  });
});
