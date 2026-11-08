import { describe, expect, it } from "vitest";
import { defaultParams } from "@hamac/core";
import { issueTabs, rebaseDraft } from "./planDraft";

describe("brouillon des paramètres", () => {
  it("garde les sections modifiées et reprend les autres", () => {
    const base = defaultParams();
    const draft = { ...base, livrets: { ...base.livrets, floor: 1234 } };
    const server = { ...base, livrets: { ...base.livrets, floor: 9 }, profile: { ...base.profile, birthYear: 1970 } };
    const out = rebaseDraft(draft, base, server);
    expect(out.livrets.floor).toBe(1234);
    expect(out.profile.birthYear).toBe(1970);
  });

  it("nomme l'onglet de chaque point à corriger", () => {
    expect(issueTabs(["targets.total"])).toEqual(["Répartition"]);
    expect(issueTabs(["livrets.driftAlert", "customClasses.0.label"])).toEqual(["Répartition"]);
    expect(issueTabs(["livrets.floor"])).toEqual(["Plan"]);
    expect(issueTabs(["profile.birthYear", "targets.total"])).toEqual(["Plan", "Répartition"]);
  });
});
