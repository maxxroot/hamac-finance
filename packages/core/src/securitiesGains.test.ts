import { describe, expect, it } from "vitest";
import type { Account } from "./domain";
import type { Disposal } from "./engine";
import { securitiesGains } from "./securitiesGains";

const accounts = [{ id: "cto", kind: "cto" }, { id: "pea", kind: "pea" }] as Account[];
let n = 0;
const sale = (date: string, gain: number, accountId = "cto"): Disposal => ({ txId: `t${n++}`, kind: "vente", date, accountId, assetId: "a", quantity: 1, proceeds: 1000 + gain, fee: 0, cost: 1000, gain, oversold: false });
const year = (rows: ReturnType<typeof securitiesGains>, y: number) => rows.find((r) => r.year === y)!;

describe("plus et moins-values de valeurs mobilières", () => {
  it("compense gains et pertes de l'année, et ignore le PEA", () => {
    const r = year(securitiesGains([sale("2025-02-01", 500), sale("2025-03-01", -200), sale("2025-04-01", 9000, "pea")], accounts, 2025), 2025);
    expect(r).toMatchObject({ gains: 500, losses: 200, net: 300, taxableGain: 300, yearLoss: 0, carryOut: [] });
  });

  it("impute les moins-values antérieures, les plus anciennes d'abord", () => {
    const rows = securitiesGains([sale("2023-01-10", -100), sale("2024-01-10", -300), sale("2025-01-10", 250)], accounts, 2025);
    expect(year(rows, 2025).usedCarry).toEqual([{ year: 2023, amount: 100 }, { year: 2024, amount: 150 }]);
    expect(year(rows, 2025).taxableGain).toBe(0);
    expect(year(rows, 2025).carryOut).toEqual([{ year: 2024, amount: 150 }]);
  });

  it("la case de moins-value de l'année ne cumule pas les moins-values antérieures", () => {
    const rows = securitiesGains([sale("2024-01-10", -300), sale("2025-01-10", -50)], accounts, 2025);
    expect(year(rows, 2025).yearLoss).toBe(50);
    expect(year(rows, 2025).carryOut).toEqual([{ year: 2024, amount: 300 }, { year: 2025, amount: 50 }]);
  });

  it("une moins-value reste imputable dix ans, pas davantage", () => {
    const dans = securitiesGains([sale("2015-01-10", -100), sale("2025-01-10", 100)], accounts, 2025);
    expect(year(dans, 2025).taxableGain).toBe(0);
    const apres = securitiesGains([sale("2014-01-10", -100), sale("2025-01-10", 100)], accounts, 2025);
    expect(year(apres, 2025).taxableGain).toBe(100);
  });

  it("une année sans cession reporte quand même les moins-values", () => {
    const rows = securitiesGains([sale("2024-01-10", -300)], accounts, 2025);
    expect(year(rows, 2025)).toMatchObject({ net: 0, taxableGain: 0, yearLoss: 0, carryOut: [{ year: 2024, amount: 300 }] });
  });
});
