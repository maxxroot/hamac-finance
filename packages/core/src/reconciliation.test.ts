import { describe, expect, it } from "vitest";
import { computeAlerts } from "./alerts";
import type { Account, Asset, Statement, Transaction } from "./domain";
import { computePortfolio, type EngineData } from "./engine";
import { defaultParams } from "./params";
import { reconcile, staleAccounts } from "./reconciliation";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "AUTRE" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const etf: Asset = {
  id: "etf", kind: "etf", name: "ETF Monde", isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: 100, manualPriceDate: "2025-01-01",
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false,
};
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });
const releve = (accountId: string, date: string, value: number, extra: Partial<Statement> = {}): Statement => ({ id: `r${n++}`, accountId, date, value, cash: null, positions: [], comment: "", ...extra });

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2025-01";
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}

describe("rapprochement avec les relevés", () => {
  it("compare au calcul à la date du relevé, pas à aujourd'hui", () => {
    const d = data({
      accounts: [acc("livret", "livret")],
      transactions: [tx("2025-01-10", "apport_initial", "livret", 5_000), tx("2025-09-01", "versement", "livret", 1_000)],
      statements: [releve("livret", "2025-06-30", 5_000)],
    });
    const [row] = reconcile(d, "2026-01-15");
    expect(row).toMatchObject({ status: "concorde", computedValue: 5_000, valueGap: 0, monthsSince: 6, correction: null });
  });

  it("propose une correction quand l'argent d'un compte sans titres diffère", () => {
    const d = data({ accounts: [acc("livret", "livret")], transactions: [tx("2025-01-10", "apport_initial", "livret", 5_000)], statements: [releve("livret", "2025-12-31", 5_042.5)] });
    const [row] = reconcile(d, "2026-01-15");
    expect(row.status).toBe("ecart");
    expect(row.correction).toEqual({ date: "2025-12-31", amount: 42.5, reason: "Écart avec la valeur relevée" });
  });

  it("sur un compte de titres, compare les espèces et les quantités", () => {
    const d = data({
      accounts: [acc("pea", "pea")],
      assets: [etf],
      transactions: [tx("2025-01-10", "apport_initial", "pea", 2_000), tx("2025-01-15", "achat", "pea", 1_000, { assetId: "etf", quantity: 10 })],
      statements: [releve("pea", "2025-12-31", 2_550, { cash: 950, positions: [{ assetId: "etf", quantity: 16 }] })],
    });
    const [row] = reconcile(d, "2026-01-15");
    expect(row.cashGap).toBe(-50);
    expect(row.quantityGaps).toEqual([{ assetId: "etf", name: "ETF Monde", statement: 16, computed: 10, gap: 6 }]);
    expect(row.correction).toMatchObject({ amount: -50, reason: "Écart sur les espèces relevées" });
  });

  it("ne propose pas de correction sur la seule valeur d'un compte de titres", () => {
    const d = data({
      accounts: [acc("pea", "pea")],
      assets: [etf],
      transactions: [tx("2025-01-10", "apport_initial", "pea", 2_000), tx("2025-01-15", "achat", "pea", 1_000, { assetId: "etf", quantity: 10 })],
      statements: [releve("pea", "2025-12-31", 2_100)],
    });
    const [row] = reconcile(d, "2026-01-15");
    expect(row).toMatchObject({ status: "ecart", valueGap: 100, correction: null, hasPositions: true });
  });

  it("rappelle les comptes sans relevé depuis le délai réglé, à compter de leur ouverture", () => {
    const d = data({
      accounts: [acc("ancien", "livret"), acc("recent", "livret"), acc("rapproche", "livret")],
      transactions: [tx("2024-06-01", "apport_initial", "ancien", 100), tx("2025-11-01", "apport_initial", "recent", 100), tx("2024-06-01", "apport_initial", "rapproche", 100)],
      statements: [releve("rapproche", "2025-10-01", 100)],
    });
    const state = computePortfolio(d, "2026-01-15");
    const rows = reconcile(d, "2026-01-15");
    expect(staleAccounts(rows, d, state, 12).map((r) => r.account.id)).toEqual(["ancien"]);
    expect(staleAccounts(rows, d, state, 0)).toEqual([]);
    const alerts = computeAlerts(d, state);
    expect(alerts.find((a) => a.id === "rapprochement")?.title).toBe("ancien : pas de relevé depuis plus de 12 mois");
  });
});
