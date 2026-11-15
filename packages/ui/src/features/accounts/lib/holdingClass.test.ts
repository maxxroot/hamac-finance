import { describe, expect, it } from "vitest";
import type { AccountState } from "@hamac/core";
import { accountClasses, holdingClassOf } from "./holdingClass";

const pos = (kind: string, bucket: string, value: number) => ({ asset: { kind }, bucket, value }) as unknown as AccountState["positions"][number];
const account = (kind: string, positions: AccountState["positions"], cash = 0) => ({ account: { kind }, positions, crowdProjects: [], cash }) as unknown as AccountState;

describe("classes d'une ligne dans un compte", () => {
  it("un ETF est un ETF, une action une action, un fonds un fonds ; les autres gardent leur classe", () => {
    expect(holdingClassOf("croissance", "etf").label).toBe("ETF");
    expect(holdingClassOf("croissance", "action").label).toBe("Actions");
    expect(holdingClassOf("croissance", "fonds").label).toBe("Fonds");
    expect(holdingClassOf("garanti", "fonds_euros")).toMatchObject({ label: "Fonds euros", page: "/fonds-euros" });
    expect(holdingClassOf("matieres_premieres", "etc").label).toBe("Matières premières");
  });

  it("répartition d'un compte : ETF et actions séparés, espèces dans la classe du compte, dans l'ordre des classes", () => {
    const pea = account("pea", [pos("action", "croissance", 200), pos("etf", "croissance", 500), pos("etf", "croissance", 300)], 50);
    expect(accountClasses(pea).map((r) => [r.label, r.value])).toEqual([
      ["Liquidités", 50],
      ["ETF", 800],
      ["Actions", 200],
    ]);
    const av = account("assurance_vie", [pos("fonds_euros", "garanti", 600), pos("etf", "croissance", 400)], 0);
    expect(accountClasses(av).map((r) => r.label)).toEqual(["Fonds euros", "ETF"]);
  });
});
