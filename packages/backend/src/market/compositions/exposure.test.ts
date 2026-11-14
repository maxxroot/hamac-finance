import { afterEach, describe, expect, it } from "vitest";
import type { ExposureData } from "@hamac/api";
import type { Backend } from "../../index";
import type { SharedMarket } from "../shared";
import { amundiFake, testBackend, testMarket } from "../../testkit";
import type { Fetcher } from "../http";

/** Deux utilisateurs d'une même instance, sur un faux site Amundi. */
const FUNDS = {
  LU1681043599: { replication: "Indirect(Swap Based)", name: "Amundi MSCI World Swap UCITS ETF EUR Acc" },
  IE000BI8OT95: { replication: "Direct(Physical)", name: "Amundi Core MSCI World UCITS ETF Acc" },
  IE00B4L5Y983: { replication: "Direct(Physical)", name: "iShares Core MSCI World UCITS ETF" },
  IE00BMTX1Y45: { replication: "Indirect(Swap Based)", name: "iShares S&P 500 Swap UCITS ETF" },
};

const open: Backend[] = [];
afterEach(() => {
  for (const b of open.splice(0)) b.close();
});

async function setup(funds: Parameters<typeof amundiFake>[0] = FUNDS) {
  const market = await testMarket(amundiFake(funds));
  const user = async (isAdmin = false) => {
    const b = await testBackend({ market, isAdmin });
    open.push(b);
    return b;
  };
  return { market, user };
}

async function call<T>(b: Backend, name: Parameters<Backend["dispatch"]>[0], input?: unknown): Promise<T> {
  const r = await b.dispatch(name, input as never);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}

async function addEtf(b: Backend, isin: string, name = isin) {
  return call<{ id: string }>(b, "assets.upsert", { kind: "etf", name, isin, priceSource: "manuel" });
}

const load = async (b: Backend, market: SharedMarket) => {
  await market.compositions.idle();
  return call<ExposureData>(b, "exposure.load");
};

describe("exposition réelle des ETF", () => {
  it("enregistrer un ETF lance le téléchargement de sa composition ; un ETF physique sert tel quel", async () => {
    const { market, user } = await setup();
    const a = await user();
    await addEtf(a, "IE000BI8OT95", "Amundi Core MSCI World");
    const data = await load(a, market);
    expect(data.etfs).toHaveLength(1);
    expect(data.etfs[0]).toMatchObject({ isin: "IE000BI8OT95", gap: null, used: { origin: "own", info: { replication: "physique", lineCount: 2 } }, suggestion: null });
    expect(data.summaries.IE000BI8OT95!.countries).toEqual({ US: 0.6, FR: 0.4 });
  });

  it("ETF synthétique : rien ne sert tant qu'aucun équivalent n'est choisi, et un ETF physique du même indice est proposé", async () => {
    const { market, user } = await setup();
    const a = await user();
    await addEtf(a, "LU1681043599", "Amundi MSCI World Swap");
    const [etf] = (await load(a, market)).etfs;
    expect(etf).toMatchObject({ used: null, gap: "synthetic", suggestion: { isin: "IE000BI8OT95", index: "MSCI World" } });
  });

  it("l'équivalent est vérifié : pas lui-même, pas synthétique, composition récupérable", async () => {
    const { market, user } = await setup();
    const a = await user();
    const { id } = await addEtf(a, "LU1681043599", "Amundi MSCI World Swap");
    await market.compositions.idle();
    const choose = (proxyIsin: string | null) => a.dispatch("exposure.choose", { assetId: id, proxyIsin });
    expect(await choose("LU1681043599")).toMatchObject({ ok: false, error: { message: expect.stringMatching(/un autre ETF/) } });
    expect(await choose("IE00BMTX1Y45")).toMatchObject({ ok: false, error: { message: expect.stringMatching(/lui aussi synthétique/) } });
    expect(await choose("DE0002635307")).toMatchObject({ ok: false, error: { message: expect.stringMatching(/Ni Amundi ni iShares/) } });
    expect(await choose("IE000BI8OT95")).toMatchObject({ ok: true });
    const [etf] = (await load(a, market)).etfs;
    expect(etf).toMatchObject({ choice: "IE000BI8OT95", link: "IE000BI8OT95", used: { origin: "choice", info: { isin: "IE000BI8OT95" } } });
  });

  it("le premier équivalent vérifié sert aux autres utilisateurs, qui peuvent en choisir un autre pour eux seuls", async () => {
    const { market, user } = await setup();
    const a = await user();
    const b = await user();
    const { id: idA } = await addEtf(a, "LU1681043599", "Amundi MSCI World Swap");
    await market.compositions.idle();
    await call(a, "exposure.choose", { assetId: idA, proxyIsin: "IE000BI8OT95" });

    // B découvre l'ETF : la composition reprise est annoncée avant même l'enregistrement.
    const lookup = await call<{ link: { proxyIsin: string; info: { replication: string } } | null }>(b, "exposure.lookup", { isin: "LU1681043599" });
    expect(lookup.link).toMatchObject({ proxyIsin: "IE000BI8OT95", info: { replication: "physique" } });
    const { id: idB } = await addEtf(b, "LU1681043599");
    expect((await load(b, market)).etfs[0]).toMatchObject({ choice: null, used: { origin: "link", info: { isin: "IE000BI8OT95" } } });

    // B préfère un autre équivalent : le lien commun ne change pas.
    await call(b, "exposure.choose", { assetId: idB, proxyIsin: "IE00B4L5Y983" });
    expect((await load(b, market)).etfs[0]).toMatchObject({ used: { origin: "choice", info: { isin: "IE00B4L5Y983" } } });
    expect((await load(a, market)).etfs[0]!.link).toBe("IE000BI8OT95");

    // Retour au lien commun.
    await call(b, "exposure.choose", { assetId: idB, proxyIsin: null });
    expect((await load(b, market)).etfs[0]).toMatchObject({ choice: null, used: { origin: "link" } });
  });

  it("un ETF physique n'ouvre pas de lien commun, même si son détenteur choisit un équivalent", async () => {
    const { market, user } = await setup();
    const a = await user();
    const { id } = await addEtf(a, "IE00B4L5Y983");
    await market.compositions.idle();
    await call(a, "exposure.choose", { assetId: id, proxyIsin: "IE000BI8OT95" });
    expect(await market.compositions.allLinks()).toEqual([]);
  });

  it("liens et échecs réservés à l'administrateur, qui peut corriger ou supprimer un lien", async () => {
    const { market, user } = await setup();
    const admin = await user(true);
    const other = await user(false);
    const { id } = await addEtf(other, "LU1681043599");
    await market.compositions.idle();
    await call(other, "exposure.choose", { assetId: id, proxyIsin: "IE000BI8OT95" });

    expect(await call(other, "exposure.admin")).toEqual({ canEdit: false, links: [], failures: [] });
    expect(await other.dispatch("exposure.adminLink", { isin: "LU1681043599", proxyIsin: null })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });

    const seen = await call<{ links: Array<{ isin: string; proxyIsin: string; name: string | null; proxyName: string | null }> }>(admin, "exposure.admin");
    expect(seen.links).toEqual([expect.objectContaining({ isin: "LU1681043599", proxyIsin: "IE000BI8OT95", name: "Amundi MSCI World Swap UCITS ETF EUR Acc", proxyName: "Amundi Core MSCI World UCITS ETF Acc" })]);
    expect(await admin.dispatch("exposure.adminLink", { isin: "LU1681043599", proxyIsin: "IE00BMTX1Y45" })).toMatchObject({ ok: false, error: { message: expect.stringMatching(/synthétique/) } });
    const fixed = await call<{ links: Array<{ proxyIsin: string }> }>(admin, "exposure.adminLink", { isin: "LU1681043599", proxyIsin: "IE00B4L5Y983" });
    expect(fixed.links.map((l) => l.proxyIsin)).toEqual(["IE00B4L5Y983"]);
    // L'utilisateur garde son propre choix.
    expect((await load(other, market)).etfs[0]).toMatchObject({ choice: "IE000BI8OT95", link: "IE00B4L5Y983" });
    await call(admin, "exposure.adminLink", { isin: "LU1681043599", proxyIsin: null });
    expect(await market.compositions.allLinks()).toEqual([]);
  });

  it("le choix d'un équivalent est dans la sauvegarde", async () => {
    const { market, user } = await setup();
    const a = await user();
    const { id } = await addEtf(a, "LU1681043599");
    await market.compositions.idle();
    await call(a, "exposure.choose", { assetId: id, proxyIsin: "IE000BI8OT95" });
    const dump = await call<{ tables: Record<string, Array<Record<string, unknown>>> }>(a, "data.export");
    expect(dump.tables.assets![0]).toMatchObject({ composition_isin: "IE000BI8OT95" });
  });

  it("seul un ETF avec un ISIN a une composition", async () => {
    const { user } = await setup();
    const a = await user();
    const { id } = await call<{ id: string }>(a, "assets.upsert", { kind: "action", name: "TotalEnergies", isin: "FR0000120271", priceSource: "manuel" });
    expect(await a.dispatch("exposure.choose", { assetId: id, proxyIsin: "IE000BI8OT95" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });
});

describe("exposition réelle : iShares refuse le serveur", () => {
  /** Amundi répond, iShares renvoie 403 comme aux serveurs hébergés. */
  async function blockedSetup() {
    const amundi = amundiFake({ IE000UBAW7M3: { replication: "Direct(Physical)", name: "Amundi Core S&P 500 UCITS ETF Acc" } });
    const fetcher: Fetcher = (url, init) => (url.includes("ishares.com") ? Promise.resolve(new Response("Access Denied", { status: 403 })) : amundi(url, init));
    const market = await testMarket(fetcher);
    const user = async (isAdmin = false) => {
      const b = await testBackend({ market, isAdmin });
      open.push(b);
      return b;
    };
    return { market, user };
  }

  const CSV = [
    "iShares Core S&P 500 UCITS ETF",
    'Fund Holdings as of,"13/Nov/2026"',
    "",
    "Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Shares,Price,Location,Exchange,Market Currency",
    '"AAPL","APPLE INC","Information Technology","Equity","700.00","70.00","700.00","1.00","700.00","United States","NASDAQ","USD"',
    '"MSFT","MICROSOFT CORP","Information Technology","Equity","300.00","30.00","300.00","1.00","300.00","United States","NASDAQ","USD"',
  ].join("\n");

  it("échec expliqué, équivalent Amundi proposé et partagé ; un équivalent iShares est refusé avec la conduite à tenir", async () => {
    const { market, user } = await blockedSetup();
    const a = await user();
    const b = await user();
    const { id } = await addEtf(a, "IE00B5BMR087", "iShares Core S&P 500");
    const [etf] = (await load(a, market)).etfs;
    expect(etf).toMatchObject({ gap: "failed", own: { state: "failed", message: expect.stringMatching(/^iShares refuse les requêtes venant de ce serveur/) }, suggestion: { isin: "IE000UBAW7M3", index: "S&P 500" } });

    expect(await a.dispatch("exposure.choose", { assetId: id, proxyIsin: "IE00B52SFT06" })).toMatchObject({ ok: false, error: { message: expect.stringMatching(/Choisissez un ETF d'Amundi/) } });
    await call(a, "exposure.choose", { assetId: id, proxyIsin: "IE000UBAW7M3" });
    expect((await load(a, market)).etfs[0]).toMatchObject({ used: { origin: "choice", info: { isin: "IE000UBAW7M3" } } });
    // L'échec ouvre le lien commun : un autre utilisateur du même ETF en profite.
    await addEtf(b, "IE00B5BMR087");
    expect((await load(b, market)).etfs[0]).toMatchObject({ used: { origin: "link", info: { isin: "IE000UBAW7M3" } } });
  });

  it("l'administrateur dépose le fichier d'iShares : la composition sert à tous ; personne d'autre ne le peut", async () => {
    const { market, user } = await blockedSetup();
    const admin = await user(true);
    const other = await user();
    await addEtf(other, "IE00B5BMR087", "CSPX");
    await load(other, market);

    expect(await other.dispatch("exposure.importFile", { isin: "IE00B5BMR087", csv: CSV, name: "CSPX" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await admin.dispatch("exposure.importFile", { isin: "IE00B5BMR087", csv: "<html>Access Denied</html>", name: null })).toMatchObject({ ok: false, error: { code: "VALIDATION", message: expect.stringMatching(/format inattendu/) } });

    const info = await call(admin, "exposure.importFile", { isin: "IE00B5BMR087", csv: CSV, name: "CSPX" });
    expect(info).toMatchObject({ state: "ok", manual: true, issuer: "ishares", fundName: "iShares Core S&P 500 UCITS ETF", asOf: "2026-11-13", lineCount: 2 });
    const data = await load(other, market);
    expect(data.etfs[0]).toMatchObject({ gap: null, used: { origin: "own", info: { manual: true } } });
    expect(data.summaries.IE00B5BMR087!.countries).toEqual({ US: 1 });
    expect((await call<{ failures: unknown[] }>(admin, "exposure.admin")).failures).toEqual([]);
  });
});
