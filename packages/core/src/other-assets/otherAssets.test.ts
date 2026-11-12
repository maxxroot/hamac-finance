import { describe, expect, it } from "vitest";
import { computePortfolio } from "../portfolio";
import { movableGainAllowance, otherAssetHeldValueAt, otherAssetSaleTax, otherAssetValueAt, quickSaleValue, type OtherAsset } from "./otherAssets";
import { defaultParams } from "../model";

const bien = (over: Partial<OtherAsset> = {}): OtherAsset => ({
  id: "o",
  kind: "metal",
  name: "Pièces",
  value: 20_000,
  valueDate: "2026-01-01",
  purchasePrice: null,
  purchaseDate: null,
  share: 1,
  dismemberment: "pleine",
  usufructBirthDate: null,
  usufructEnd: null,
  depreciation: null,
  quickSaleDiscount: null,
  saleDelayMonths: null,
  loanPrincipal: null,
  loanRate: null,
  loanTermMonths: null,
  loanFirstPayment: null,
  classId: null,
  inAllocation: null,
  comment: "",
  archived: false,
  ...over,
});

describe("valeur des autres biens", () => {
  it("part de la dernière estimation connue à la date", () => {
    const values = [{ id: "v", assetId: "o", date: "2024-01-01", value: 15_000 }];
    expect(otherAssetValueAt(bien(), values, "2025-06-01")).toBe(15_000);
    expect(otherAssetValueAt(bien(), values, "2026-06-01")).toBe(20_000);
    expect(otherAssetValueAt(bien({ purchaseDate: "2023-01-01" }), values, "2022-12-31")).toBe(0);
  });

  it("applique la baisse annuelle d'un véhicule", () => {
    // 15 % par an : deux ans après l'estimation, 20 000 × 0,85² = 14 450 €.
    expect(otherAssetValueAt(bien({ kind: "vehicule", depreciation: 0.15 }), [], "2028-01-01")).toBe(14_450);
  });

  it("calcule la somme due d'un prêt avec échéancier", () => {
    const pret = bien({ kind: "pret", loanPrincipal: 12_000, loanRate: 0, loanTermMonths: 24, loanFirstPayment: "2026-01-15" });
    expect(otherAssetValueAt(pret, [], "2026-01-01")).toBe(12_000);
    // 6 échéances de 500 € passées au 1er juillet.
    expect(otherAssetValueAt(pret, [], "2026-07-01")).toBe(9_000);
  });

  it("compte la part détenue, le droit détenu, et rien pour un bien archivé", () => {
    expect(otherAssetHeldValueAt(bien({ share: 0.5 }), [], "2026-06-01")).toBe(10_000);
    // Usufruit de parts de société, usufruitier de 46 ans : 60 %.
    expect(otherAssetHeldValueAt(bien({ kind: "societe", dismemberment: "usufruit", usufructBirthDate: "1980-01-01" }), [], "2026-06-01")).toBe(12_000);
    // L'or se détient en pleine propriété : un démembrement saisi par erreur est ignoré.
    expect(otherAssetHeldValueAt(bien({ dismemberment: "nue_propriete", usufructBirthDate: "1980-01-01" }), [], "2026-06-01")).toBe(20_000);
    expect(otherAssetHeldValueAt(bien({ archived: true }), [], "2026-06-01")).toBe(0);
    expect(quickSaleValue(10_000, { quickSaleDiscount: 0.3 })).toBe(7_000);
  });
});

describe("impôt à la vente", () => {
  it("applique un abattement de 5 % par an au-delà de la deuxième année, exonération après 22 ans", () => {
    expect([0, 2, 3, 10, 21, 22, 30].map(movableGainAllowance)).toEqual([0, 0, 0.05, 0.4, 0.95, 1, 1]);
  });

  it("taxe l'or à 11,5 % du prix, ou au régime des plus-values si c'est moins", () => {
    const sansAchat = otherAssetSaleTax(bien(), [], "2026-06-01");
    expect(sansAchat.tax).toBe(2_300);
    // Acheté 12 000 € il y a 10 ans : plus-value 8 000 €, abattement 40 %, 4 800 € imposés à 36,2 %.
    const avecAchat = otherAssetSaleTax(bien({ purchasePrice: 12_000, purchaseDate: "2016-03-01" }), [], "2026-06-01");
    expect(avecAchat.options.map((o) => o.tax)).toEqual([2_300, 1_737.6]);
    expect(avecAchat.best?.regime).toBe("plus_value");
  });

  it("exonère les objets vendus 5 000 € ou moins, taxe les autres à 6,5 %", () => {
    expect(otherAssetSaleTax(bien({ kind: "objet", value: 5_000 }), [], "2026-06-01").exempt).toBe(true);
    expect(otherAssetSaleTax(bien({ kind: "objet", value: 8_000 }), [], "2026-06-01").tax).toBe(520);
  });

  it("exonère les voitures et n'estime pas les parts de société", () => {
    expect(otherAssetSaleTax(bien({ kind: "vehicule" }), [], "2026-06-01")).toMatchObject({ exempt: true, tax: 0 });
    expect(otherAssetSaleTax(bien({ kind: "societe" }), [], "2026-06-01").tax).toBeNull();
  });
});

describe("dans le patrimoine", () => {
  it("s'ajoute au patrimoine net, et à la répartition seulement avec une classe", () => {
    const params = defaultParams(new Date(2026, 0, 1));
    params.customClasses = [{ id: "or", label: "Or", color: "#c9a227" }];
    params.targets = [...params.targets, { key: "or", inAllocation: true, target: 0.1, expectedReturn: null }];
    const data = { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], otherAssets: [bien({ classId: "or" }), bien({ id: "voiture", kind: "vehicule", value: 10_000 })] };
    const state = computePortfolio(data, "2026-06-01");
    expect(state.netWorth.otherAssets).toBe(30_000);
    expect(state.netWorth.net).toBe(30_000);
    expect(state.allocation.invested).toBe(20_000);
  });
});
