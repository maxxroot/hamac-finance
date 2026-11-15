import { describe, expect, it } from "vitest";
import { computeAlerts } from "../alerts";
import { defaultParams, type Account, type Statement, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "./engine";
import { reconcile } from "./reconciliation";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "" });
const releve = (accountId: string, date: string, value: number): Statement => ({ id: `r${n++}`, accountId, date, value, comment: "" });

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2025-01";
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}

describe("contrôle avec le relevé", () => {
  it("compare au calcul à la date du relevé, pas à aujourd'hui", () => {
    // Un versement après le relevé ne crée pas d'écart.
    const d = data({
      accounts: [acc("av", "assurance_vie", { beneficiaryClause: true })],
      transactions: [tx("2025-01-10", "apport_initial", "av", 5_000), tx("2025-09-01", "versement", "av", 1_000)],
      statements: [releve("av", "2025-06-30", 5_000)],
    });
    const [row] = reconcile(d, "2026-01-15");
    expect(row).toMatchObject({ status: "concorde", computedValue: 5_000, valueGap: 0 });
    expect(computeAlerts(d, computePortfolio(d, "2026-01-15")).some((a) => a.id === "releve-av")).toBe(false);
  });

  it("signale un écart à la date du relevé", () => {
    const d = data({ accounts: [acc("av", "assurance_vie", { beneficiaryClause: true })], transactions: [tx("2025-01-10", "apport_initial", "av", 5_000)], statements: [releve("av", "2025-12-31", 5_042.5)] });
    const [row] = reconcile(d, "2026-01-15");
    expect(row).toMatchObject({ status: "ecart", valueGap: 42.5 });
    expect(computeAlerts(d, computePortfolio(d, "2026-01-15")).find((a) => a.id === "releve-av")?.link).toBe("/comptes/av");
  });
});
