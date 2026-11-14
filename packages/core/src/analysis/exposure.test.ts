import { describe, expect, it } from "vitest";
import {
  countryCode,
  currencyCode,
  EQUIVALENT_INDEXES,
  resolveComposition,
  SECTOR_LABELS,
  SECTORS,
  sectorFromLabel,
  suggestEquivalent,
  summarizeComposition,
  type CompositionInfo,
  type EtfHolding,
} from "./exposure";

describe("exposition : harmonisation des libellés d'émetteurs", () => {
  it("ramène les noms de pays d'Amundi et d'iShares au même code ISO", () => {
    expect(countryCode("United States")).toBe("US");
    expect(countryCode(" united kingdom ")).toBe("GB");
    // Amundi écrit « UAE », iShares « United Arab Emirates ».
    expect(countryCode("UAE")).toBe("AE");
    expect(countryCode("United Arab Emirates")).toBe("AE");
    expect(countryCode("Korea (South)")).toBe("KR");
    expect(countryCode("Croatia (Hrvatska)")).toBe("HR");
    expect(countryCode("Russian Federation")).toBe("RU");
  });

  it("une zone ou un tiret ne sont pas des pays", () => {
    expect(countryCode("European Union")).toBeNull();
    expect(countryCode("-")).toBeNull();
    expect(countryCode(null)).toBeNull();
    expect(countryCode("Atlantide")).toBeNull();
  });

  it("secteurs des actions et secteurs des obligations iShares vont dans la même liste", () => {
    expect(sectorFromLabel("Information Technology")).toBe("technologie");
    expect(sectorFromLabel("Communication")).toBe("communication");
    expect(sectorFromLabel("Communication Services")).toBe("communication");
    expect(sectorFromLabel("Banking")).toBe("finance");
    expect(sectorFromLabel("Insurance")).toBe("finance");
    expect(sectorFromLabel("Electric")).toBe("services_publics");
    expect(sectorFromLabel("Consumer Non-Cyclical")).toBe("consommation_courante");
    expect(sectorFromLabel("Consumer Cyclical")).toBe("consommation_non_essentielle");
    expect(sectorFromLabel("Basic Industry")).toBe("materiaux");
    expect(sectorFromLabel("Reits")).toBe("immobilier");
    expect(sectorFromLabel("Treasuries")).toBe("etats");
  });

  it("un secteur inconnu ou vide devient « autre », et chaque secteur a un libellé", () => {
    expect(sectorFromLabel("Other")).toBe("autre");
    expect(sectorFromLabel("")).toBe("autre");
    expect(sectorFromLabel(undefined)).toBe("autre");
    for (const s of SECTORS) expect(SECTOR_LABELS[s]).toBeTruthy();
  });

  it("devise : un code à trois lettres, sinon rien", () => {
    expect(currencyCode("usd")).toBe("USD");
    expect(currencyCode("-")).toBeNull();
    expect(currencyCode("")).toBeNull();
  });
});

const line = (over: Partial<EtfHolding>): EtfHolding => ({ name: "X", isin: null, ticker: null, weight: 0, kind: "action", sector: "technologie", country: "US", currency: "USD", ...over });

describe("exposition : résumé d'une composition", () => {
  it("répartitions ramenées au total publié, liquidités sans pays ni secteur, plus grosses lignes d'abord", () => {
    const s = summarizeComposition([
      line({ name: "B", weight: 0.3, country: "FR", sector: "energie", currency: "EUR" }),
      line({ name: "A", weight: 0.5 }),
      line({ name: "EUR CASH", weight: 0.2, kind: "liquidites", sector: null, country: null, currency: "EUR" }),
      // Liquidités négatives en attente de règlement : total publié 0,98.
      line({ name: "USD CASH", weight: -0.02, kind: "liquidites", sector: null, country: null, currency: "USD" }),
    ]);
    expect(s.lineCount).toBe(4);
    expect(s.countries.US).toBeCloseTo(0.5 / 0.98);
    expect(s.countries[""]).toBeCloseTo(0.18 / 0.98);
    expect(Object.values(s.countries).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s.sectors.energie).toBeCloseTo(0.3 / 0.98);
    expect(s.currencies.EUR).toBeCloseTo(0.5 / 0.98);
    expect(s.kinds.liquidites).toBeCloseTo(0.18 / 0.98);
    expect(s.top.map((t) => t.name)).toEqual(["A", "B"]);
  });

  it("composition vide : rien à répartir", () => {
    expect(summarizeComposition([])).toMatchObject({ lineCount: 0, countries: {}, top: [] });
  });
});

describe("exposition : équivalent proposé", () => {
  it("trouve l'indice dans le nom, le plus précis d'abord", () => {
    expect(suggestEquivalent(["Amundi MSCI World Swap UCITS ETF EUR Acc"])?.isin).toBe("IE000BI8OT95");
    expect(suggestEquivalent(["Amundi PEA Monde (MSCI World)"])?.index).toBe("MSCI World");
    expect(suggestEquivalent(["iShares MSCI World Small Cap"])?.index).toBe("MSCI World Small Cap");
    expect(suggestEquivalent(["Vanguard FTSE All-World"])?.index).toBe("MSCI ACWI");
    expect(suggestEquivalent(["Amundi PEA S&P 500 UCITS ETF Acc"])?.isin).toBe("IE000UBAW7M3");
    expect(suggestEquivalent(["Amundi PEA Emergent (MSCI Emerging) ESG Transition"])?.index).toBe("MSCI Emerging Markets");
    expect(suggestEquivalent(["Xtrackers MSCI Emerging Markets IMI"])?.index).toBe("MSCI Emerging Markets IMI");
    expect(suggestEquivalent(["Amundi MSCI Pacific ex Japan"])?.index).toBe("MSCI Pacific ex Japan");
    expect(suggestEquivalent(["Lyxor Core Stoxx Europe 600"])?.index).toBe("Stoxx Europe 600");
    expect(suggestEquivalent(["Amundi PEA Europe"])?.index).toBe("MSCI Europe");
  });

  it("essaie chaque nom connu, jamais l'ETF lui-même, rien si l'indice est inconnu", () => {
    expect(suggestEquivalent([null, "Amundi PEA Nasdaq-100"])?.index).toBe("Nasdaq-100");
    expect(suggestEquivalent(["iShares Core MSCI World"], "IE00B4L5Y983")?.isin).toBe("IE000BI8OT95");
    expect(suggestEquivalent(["Amundi Core MSCI World"], "IE000BI8OT95")?.isin).toBe("IE00B4L5Y983");
    expect(suggestEquivalent(["iShares MSCI China"], "IE00BJ5JPG56")).toBeNull();
    expect(suggestEquivalent(["Fonds thématique robotique"])).toBeNull();
  });

  it("Amundi d'abord quand il réplique l'indice : iShares refuse souvent les serveurs hébergés", () => {
    for (const r of EQUIVALENT_INDEXES) if (r.funds.some((f) => f.name.startsWith("Amundi"))) expect(r.funds[0]!.name, r.index).toMatch(/^Amundi/);
    expect(suggestEquivalent(["iShares Core S&P 500 UCITS ETF USD (Acc)"], "IE00B5BMR087")).toMatchObject({ isin: "IE000UBAW7M3", index: "S&P 500" });
  });

  it("chaque référence a un ISIN valide, une seule fois", () => {
    const isins = EQUIVALENT_INDEXES.flatMap((r) => r.funds.map((f) => f.isin));
    expect(new Set(isins).size).toBe(isins.length);
    for (const i of isins) expect(i).toMatch(/^[A-Z]{2}[A-Z0-9]{9}\d$/);
  });
});

describe("exposition : composition utilisée", () => {
  const info = (over: Partial<CompositionInfo>): CompositionInfo => ({ isin: "IE0000000001", state: "ok", issuer: "amundi", fundName: null, replication: "physique", asOf: "2026-11-09", lineCount: 10, checkedAt: null, fetchedAt: null, message: null, manual: false, ...over });
  const synthetic = info({ replication: "synthetique" });
  const proxy = info({ isin: "IE0000000002" });

  it("ETF physique : sa composition", () => {
    expect(resolveComposition(info({}), null, null)).toMatchObject({ used: { origin: "own" }, gap: null });
  });

  it("ETF synthétique : jamais par lui-même ; le lien commun, puis le choix de l'utilisateur", () => {
    expect(resolveComposition(synthetic, null, null)).toEqual({ used: null, gap: "synthetic" });
    expect(resolveComposition(synthetic, null, proxy)).toMatchObject({ used: { origin: "link", info: { isin: "IE0000000002" } } });
    expect(resolveComposition(synthetic, info({ isin: "IE0000000003" }), proxy)).toMatchObject({ used: { origin: "choice", info: { isin: "IE0000000003" } } });
  });

  it("le choix de l'utilisateur l'emporte même sur un ETF physique", () => {
    expect(resolveComposition(info({}), proxy, null)).toMatchObject({ used: { origin: "choice" } });
  });

  it("raisons : pas encore là, inconnu, échec, équivalent en attente ou en échec", () => {
    expect(resolveComposition(info({ state: "pending" }), null, null).gap).toBe("pending");
    expect(resolveComposition(info({ state: "unknown" }), null, null).gap).toBe("unknown");
    expect(resolveComposition(info({ state: "failed" }), null, null).gap).toBe("failed");
    expect(resolveComposition(synthetic, null, info({ state: "pending" })).gap).toBe("equivalent-pending");
    expect(resolveComposition(synthetic, info({ state: "failed" }), null).gap).toBe("equivalent-failed");
  });
});
