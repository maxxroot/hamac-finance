import { describe, expect, it } from "vitest";
import { energyAlerts } from "../alerts";
import { dpeExpiry, dpeRentalBan } from "./energy";
import { NO_PROPERTY_DETAILS, type Property } from "./realestate";

describe("validité d'un DPE (décret n° 2020-1610)", () => {
  it("10 ans depuis le 1er juillet 2021", () => {
    expect(dpeExpiry("2021-07-01")).toBe("2031-07-01");
    expect(dpeExpiry("2024-03-15")).toBe("2034-03-15");
  });
  it("anciens DPE : dates butoirs", () => {
    expect(dpeExpiry("2021-06-30")).toBe("2024-12-31");
    expect(dpeExpiry("2018-01-01")).toBe("2024-12-31");
    expect(dpeExpiry("2017-12-31")).toBe("2022-12-31");
    expect(dpeExpiry("2013-05-10")).toBe("2022-12-31");
    expect(dpeExpiry("2010-05-10")).toBe("2020-05-10");
  });
});

describe("interdiction de louer", () => {
  it("métropole : G 2025, F 2028, E 2034, rien au-dessus", () => {
    expect(dpeRentalBan("G", "69001")).toBe("2025-01-01");
    expect(dpeRentalBan("F", "69001")).toBe("2028-01-01");
    expect(dpeRentalBan("E", "")).toBe("2034-01-01");
    expect(dpeRentalBan("D", "69001")).toBeNull();
  });
  it("outre-mer : G 2028, F 2031, pas d'échéance pour E", () => {
    expect(dpeRentalBan("G", "97400")).toBe("2028-01-01");
    expect(dpeRentalBan("F", "97200")).toBe("2031-01-01");
    expect(dpeRentalBan("E", "97600")).toBeNull();
  });
});

describe("alertes DPE", () => {
  const bien: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Studio", value: 100_000, valueDate: null, purchasePrice: null, purchaseDate: null, newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
  const run = (p: Partial<Property>, today: string) => energyAlerts({ properties: [{ ...bien, ...p }] }, today);

  it("rappel 90 jours avant l'expiration, pas avant", () => {
    expect(run({ dpeDate: "2022-06-30" }, "2032-03-31")).toHaveLength(0);
    expect(run({ dpeDate: "2022-06-30" }, "2032-04-01")[0]).toMatchObject({ id: "dpe-expire-b", level: "info" });
  });
  it("DPE expiré : attention si loué, simple information sinon", () => {
    expect(run({ dpeDate: "2019-06-30" }, "2026-01-01")[0]).toMatchObject({ level: "attention" });
    expect(run({ dpeDate: "2019-06-30", kind: "residence_principale" }, "2026-01-01")[0]).toMatchObject({ level: "info" });
  });
  it("note interdite : attention une fois la date passée, information dans les deux ans, rien au-delà", () => {
    expect(run({ dpe: "G" }, "2026-01-01")[0]).toMatchObject({ id: "dpe-interdit-b", level: "attention" });
    expect(run({ dpe: "F" }, "2026-06-01")[0]).toMatchObject({ level: "info" });
    expect(run({ dpe: "F" }, "2025-12-01")).toHaveLength(0);
    expect(run({ dpe: "E" }, "2026-06-01")).toHaveLength(0);
  });
  it("seulement pour un bien loué, non archivé, et si la case est cochée", () => {
    expect(run({ dpe: "G", kind: "residence_principale" }, "2026-01-01")).toHaveLength(0);
    expect(run({ dpe: "G", archived: true }, "2026-01-01")).toHaveLength(0);
    expect(run({ dpe: "G", dpeDate: "2019-06-30", dpeReminders: false }, "2026-01-01")).toHaveLength(0);
  });
});
