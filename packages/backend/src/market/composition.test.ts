import { describe, expect, it } from "vitest";
import type { Fetcher } from "./http";
import {
  amundiReplication,
  fetchComposition,
  findComposition,
  isharesHoldingsUrl,
  looksSynthetic,
  parseAmundiProduct,
  parseIsharesHoldings,
  parseIsharesPage,
  splitCsvLine,
} from "./composition";

/** Exemples au format réel des émetteurs (relevé le 11 novembre 2026), montants fictifs. */
const ISHARES_EQUITY_CSV = [
  'Fund Holdings as of,"10/Nov/2026"',
  "",
  "Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Shares,Price,Location,Exchange,Market Currency",
  '"AAPL","APPLE","Information Technology","Equity","1,200,000.00","60.00","1,200,000.00","3,000.00","400.00","United States","NASDAQ","USD"',
  '"ASML","ASML HOLDING NV","Information Technology","Equity","500,000.00","25.00","500,000.00","700.00","714.29","Netherlands","Euronext Amsterdam","EUR"',
  '"NESN","NESTLE SA","Consumer Staples","Equity","290,000.00","14.50","290,000.00","3,000.00","96.67","Switzerland","SIX Swiss Exchange","CHF"',
  '"ESZ6","S&P500 EMINI DEC 26","Cash and/or Derivatives","Futures","0.00","0.00","80,000.00","1.00","7,000.00","-","Index And Options Market","USD"',
  '"USD","USD CASH","Cash and/or Derivatives","Cash","10,000.00","0.50","10,000.00","10,000.00","100.00","United States","-","USD"',
  "",
].join("\n");

const ISHARES_BOND_CSV = [
  'Fund Holdings as of,"07/Nov/2026"',
  "",
  "Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Shares,Par Value,Price,Location,Exchange,Duration,Maturity,Coupon (%),Market Currency,Effective Date",
  '"BNP","BNP PARIBAS SA MTN RegS","Banking","Fixed Income","40,000.00","40.00","40,000.00","42,000.00","42,000.00","95.24","France","-","2.10","23/Mar/2030","1.50","EUR","23/Mar/2022"',
  '"EDF","ELECTRICITE DE FRANCE SA, ""EDF"" MTN","Electric","Fixed Income","60,000.00","60.00","60,000.00","61,000.00","61,000.00","98.36","France","-","4.80","01/Jun/2033","3.25","EUR","01/Jun/2023"',
].join("\n");

const ISHARES_SWAP_CSV = [
  'Fund Holdings as of,"10/Nov/2026"',
  "",
  "Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Shares,Price,Location,Exchange,Market Currency",
  '"GDDUWI","MSCI WORLD GROSS TR INDEX","Other","Equity","1,000,000.00","99.90","1,000,000.00","40.00","25,000.00","United States","-","USD"',
  '"AMZN","AMAZON.COM INC","Consumer Discretionary","Equity","600,000.00","60.00","600,000.00","2,000.00","300.00","United States","NASDAQ","USD"',
  '"TSLA","TESLA INC","Consumer Discretionary","Equity","400,000.00","40.00","400,000.00","1,000.00","400.00","United States","NASDAQ","USD"',
].join("\n");

const ISHARES_PAGE = (structure: string) =>
  `<html><head><title>iShares Core MSCI World UCITS ETF | SWDA | iShares</title></head><body><div data-props="{&quot;productStructure&quot;:{&quot;name&quot;:&quot;productStructure&quot;,&quot;visible&quot;:true,&quot;formattedValue&quot;:&quot;${structure}&quot;,&quot;label&quot;:&quot;Product Structure&quot;}}"></div></body></html>`;

const amundiProduct = (isin: string, replication: string) => ({
  productId: isin,
  characteristics: { FUND_REPLICATION_METHODOLOGY: replication, SHARE_MARKETING_NAME: "Amundi Exemple Monde UCITS ETF Acc" },
  composition: {
    compositionData: [
      { compositionCharacteristics: { date: "2026-11-09", type: "EQUITY_ORDINARY", isin: "US0378331005", name: "APPLE INC", weight: 0.7, currency: "USD", sector: "Information Technology", countryOfRisk: "United States", bbg: "AAPL UW" }, weight: 0.7 },
      { compositionCharacteristics: { date: "2026-11-09", type: "EQUITY_ORDINARY", isin: "AEA000201011", name: "EMAAR PROPERTIES", weight: 0.2, currency: "AED", sector: "Real Estate", countryOfRisk: "UAE", bbg: "EMAAR UH" }, weight: 0.2 },
      { compositionCharacteristics: { date: "2026-11-08", type: "CASH", name: "EUR CASH", weight: 0.1, currency: "EUR", sector: "", countryOfRisk: "France" }, weight: 0.1 },
    ],
  },
});

function fakeFetcher(handler: (url: string, init?: RequestInit) => Response | undefined): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    return handler(url, init) ?? new Response("introuvable", { status: 404 });
  }) as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { "Content-Type": "application/json" } });

describe("composition des ETF : lecture", () => {
  it("découpe une ligne CSV avec des virgules et des guillemets dans les champs", () => {
    expect(splitCsvLine('"A","1,234.56","dit ""B""",,x')).toEqual(["A", "1,234.56", 'dit "B"', "", "x"]);
  });

  it("iShares, actions : date, poids en fraction, pays et secteur harmonisés, liquidités et contrats à terme à part", () => {
    const { asOf, lines } = parseIsharesHoldings(ISHARES_EQUITY_CSV);
    expect(asOf).toBe("2026-11-10");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toEqual({ name: "APPLE", isin: null, ticker: "AAPL", weight: 0.6, kind: "action", sector: "technologie", country: "US", currency: "USD" });
    expect(lines[2]).toMatchObject({ country: "CH", sector: "consommation_courante", currency: "CHF" });
    expect(lines[3]).toMatchObject({ kind: "derive", weight: 0, sector: null, country: null });
    expect(lines[4]).toMatchObject({ kind: "liquidites", sector: null, country: null, currency: "USD" });
  });

  it("iShares, obligations : colonnes en plus lues par leur nom, secteurs d'émetteurs ramenés à la liste commune", () => {
    const { asOf, lines } = parseIsharesHoldings(ISHARES_BOND_CSV);
    expect(asOf).toBe("2026-11-07");
    expect(lines.map((l) => [l.kind, l.sector, l.country, l.weight])).toEqual([
      ["obligation", "finance", "FR", 0.4],
      ["obligation", "services_publics", "FR", 0.6],
    ]);
    expect(lines[1]!.name).toBe('ELECTRICITE DE FRANCE SA, "EDF" MTN');
  });

  it("iShares : une page HTML à la place du CSV est refusée", () => {
    expect(() => parseIsharesHoldings("<!doctype html><html>…</html>")).toThrow(/format inattendu/);
  });

  it("iShares : structure et nom du fonds lus sur la page produit", () => {
    expect(parseIsharesPage(ISHARES_PAGE("Physical"))).toEqual({ fundName: "iShares Core MSCI World UCITS ETF", replication: "physique" });
    expect(parseIsharesPage(ISHARES_PAGE("Synthetic")).replication).toBe("synthetique");
    expect(parseIsharesPage("<title>Home</title>")).toEqual({ fundName: null, replication: null });
  });

  it("iShares : un fonds à swap se reconnaît à sa ligne d'indice et à ses 200 %", () => {
    expect(looksSynthetic(parseIsharesHoldings(ISHARES_SWAP_CSV).lines)).toBe(true);
    expect(looksSynthetic(parseIsharesHoldings(ISHARES_EQUITY_CSV).lines)).toBe(false);
  });

  it("Amundi : lignes avec ISIN, « UAE » reconnu, date la plus récente, réplication", () => {
    const c = parseAmundiProduct("IE0000000001", amundiProduct("IE0000000001", "Direct(Physical)"))!;
    expect(c).toMatchObject({ issuer: "amundi", issuerId: "IE0000000001", fundName: "Amundi Exemple Monde UCITS ETF Acc", replication: "physique", asOf: "2026-11-09" });
    expect(c.lines[0]).toEqual({ name: "APPLE INC", isin: "US0378331005", ticker: "AAPL UW", weight: 0.7, kind: "action", sector: "technologie", country: "US", currency: "USD" });
    expect(c.lines[1]).toMatchObject({ country: "AE", sector: "immobilier" });
    expect(c.lines[2]).toMatchObject({ kind: "liquidites", sector: null, country: null, isin: null });
  });

  it("Amundi : méthode de réplication", () => {
    expect(amundiReplication("Indirect(Swap Based)")).toBe("synthetique");
    expect(amundiReplication("Direct(Physical)")).toBe("physique");
    expect(amundiReplication(undefined)).toBeNull();
  });

  it("Amundi : ISIN inconnu → null ; produit connu sans composition → erreur", () => {
    expect(parseAmundiProduct("IE0000000001", undefined)).toBeNull();
    expect(() => parseAmundiProduct("IE0000000001", { productId: "IE0000000001", composition: null })).toThrow(/ne publie pas/);
  });
});

describe("composition des ETF : téléchargement", () => {
  it("Amundi ne connaît pas l'ISIN : iShares le trouve, CSV et page lus", async () => {
    const f = fakeFetcher((url) => {
      if (url.includes("amundietf")) return json({ products: [] });
      if (url.includes("core-search")) return json({ results: [{ portfolioId: "251882", fundName: "iShares Core MSCI World UCITS ETF" }] });
      if (url.endsWith("/251882/x/latest-holdings.csv")) return new Response(ISHARES_EQUITY_CSV);
      if (url.endsWith("/251882/x")) return new Response(ISHARES_PAGE("Physical"));
    });
    const c = await findComposition(f, "IE00B4L5Y983");
    expect(c).toMatchObject({ issuer: "ishares", issuerId: "251882", fundName: "iShares Core MSCI World UCITS ETF", replication: "physique", asOf: "2026-11-10" });
    expect(c!.lines).toHaveLength(5);
    expect(f.calls.find((u) => u.includes("core-search"))).toContain("query=IE00B4L5Y983");
  });

  it("Amundi répond : iShares n'est pas interrogé", async () => {
    const f = fakeFetcher((url, init) => {
      if (url.includes("amundietf")) {
        const body = JSON.parse(String(init?.body)) as { productIds: string[] };
        return json({ products: [amundiProduct(body.productIds[0]!, "Indirect(Swap Based)")] });
      }
    });
    const c = await findComposition(f, "LU1681043599");
    expect(c).toMatchObject({ issuer: "amundi", replication: "synthetique" });
    expect(f.calls).toHaveLength(1);
  });

  it("aucun émetteur ne connaît l'ISIN → null ; les deux en panne → erreur", async () => {
    const none = fakeFetcher((url) => (url.includes("amundietf") ? json({ products: [] }) : json({ results: [] })));
    expect(await findComposition(none, "DE0000000002")).toBeNull();
    const down = fakeFetcher(() => new Response("panne", { status: 500 }));
    await expect(findComposition(down, "DE0000000002")).rejects.toThrow(/Amundi.*iShares/);
  });

  it("iShares : sans page lisible, un fonds à swap est quand même reconnu", async () => {
    const f = fakeFetcher((url) => (url.endsWith("latest-holdings.csv") ? new Response(ISHARES_SWAP_CSV) : undefined));
    const c = await fetchComposition(f, { issuer: "ishares", issuerId: "335184" });
    expect(c).toMatchObject({ replication: "synthetique", fundName: "iShares 335184" });
  });

  it("iShares : CSV absent → erreur claire", async () => {
    const f = fakeFetcher(() => undefined);
    await expect(fetchComposition(f, { issuer: "ishares", issuerId: "1" })).rejects.toThrow(/réponse 404/);
  });

  it("l'identifiant gardé en base ne peut pas détourner l'adresse téléchargée", () => {
    expect(isharesHoldingsUrl("251882")).toBe("https://www.ishares.com/uk/individual/en/products/251882/x/latest-holdings.csv");
    expect(() => isharesHoldingsUrl("../../evil")).toThrow(/invalide/);
    expect(() => isharesHoldingsUrl("1?u=http://10.0.0.1")).toThrow(/invalide/);
  });
});
