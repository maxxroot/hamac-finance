import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "./domain";
import { computeAlerts } from "./alerts";
import { computePortfolio, type EngineData } from "./engine";
import { defaultParams } from "./params";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number): Transaction => ({ id: `${date}${type}${accountId}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "" });

function run(accounts: Account[], transactions: Transaction[], asOf: string) {
  const params = defaultParams(new Date(2026, 0, 15));
  params.profile.startMonth = "2025-01";
  const data: EngineData = { params, accounts, assets: [], transactions, plans: [], skips: [], prices: [] };
  return computeAlerts(data, computePortfolio(data, asOf));
}

describe("alertes", () => {
  it("livrets sous le plancher, clause bénéficiaire, intérêts de janvier", () => {
    const alerts = run(
      [acc("lep", "livret"), acc("av", "assurance_vie", { openedOn: "2020-01-01" })],
      [tx("2025-01-02", "apport_initial", "lep", 3000), tx("2025-01-02", "apport_initial", "av", 2000)],
      "2026-01-20",
    );
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("livrets");
    expect(alerts.find((a) => a.id === "livrets")!.level).toBe("attention");
    expect(ids).toContain("clause-av");
    expect(ids).toContain("interets-lep");
    expect(ids).toContain("interets-av");
  });

  it("les alertes critiques passent en premier", () => {
    const alerts = run([acc("lep", "livret")], [tx("2025-01-02", "retrait", "lep", 100)], "2025-06-01");
    expect(alerts[0].level).toBe("critique");
  });

  it("anniversaire fiscal proche", () => {
    const alerts = run([acc("pea", "pea", { openedOn: "2021-04-01" })], [tx("2021-04-01", "apport_initial", "pea", 1000)], "2026-01-20");
    expect(alerts.some((a) => a.id === "anniv-pea")).toBe(true);
  });
});
