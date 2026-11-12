import { describe, expect, it } from "vitest";
import type { CompositionLookup, EtfExposure } from "@hamac/api";
import type { CompositionInfo } from "@hamac/core";
import { compositionStatus, countryLabel, currencyLabel, lookupMessage, lookupPending, sectorLabel, withOthers } from "./exposure";

const info = (over: Partial<CompositionInfo> = {}): CompositionInfo => ({ isin: "IE00B4L5Y983", state: "ok", issuer: "ishares", fundName: "iShares Core MSCI World UCITS ETF", replication: "physique", asOf: "2026-11-10", lineCount: 1285, checkedAt: null, fetchedAt: null, message: null, ...over });
const etf = (over: Partial<EtfExposure>): EtfExposure => ({ assetId: "a", isin: "LU1681043599", name: "CW8", own: info({ isin: "LU1681043599", issuer: "amundi", replication: "synthetique" }), choice: null, link: null, used: null, gap: null, suggestion: null, ...over });

describe("exposition : libellés", () => {
  it("pays en français, zone vide expliquée", () => {
    expect(countryLabel("US")).toBe("États-Unis");
    expect(countryLabel("")).toMatch(/liquidités/);
    expect(sectorLabel("energie")).toBe("Énergie");
    expect(sectorLabel("")).toMatch(/en direct/);
    expect(currencyLabel("USD")).toMatch(/^USD · dollar/);
  });

  it("au-delà des premiers, le reste est regroupé", () => {
    const items = [0.5, 0.2, 0.1, 0.1, 0.1].map((share, i) => ({ key: `k${i}`, value: share * 100, share }));
    const out = withOthers(items, 2);
    expect(out.map((i) => i.key)).toEqual(["k0", "k1", "__autres"]);
    expect(out[2]!.share).toBeCloseTo(0.3);
    // Un seul de plus : inutile de regrouper.
    expect(withOthers(items.slice(0, 3), 2)).toHaveLength(3);
  });
});

describe("exposition : état de chaque ETF", () => {
  it("composition propre, reprise d'un équivalent, mise à jour échouée", () => {
    expect(compositionStatus(etf({ used: { origin: "own", info: info() } }))).toMatchObject({ text: expect.stringMatching(/^iShares · physique · 1\s285 lignes · au 10\/11\/2026$/), tone: "ok", canChoose: false });
    expect(compositionStatus(etf({ used: { origin: "link", info: info() } })).text).toMatch(/reprise de l'ETF iShares Core MSCI World UCITS ETF \(physique, même indice\)/);
    expect(compositionStatus(etf({ used: { origin: "choice", info: info() } })).text).toMatch(/votre choix/);
    expect(compositionStatus(etf({ used: { origin: "own", info: info({ message: "Réponse 500" }) } })).text).toMatch(/précédente gardée/);
  });

  it("raisons, avec le bouton de choix quand il sert", () => {
    expect(compositionStatus(etf({ gap: "synthetic" }))).toMatchObject({ tone: "warning", canChoose: true, text: expect.stringMatching(/synthétique/) });
    expect(compositionStatus(etf({ gap: "unknown" })).text).toMatch(/Amundi et d'iShares/);
    expect(compositionStatus(etf({ gap: "failed", own: info({ state: "failed", message: "Réponse 503" }) })).text).toMatch(/Réponse 503/);
    expect(compositionStatus(etf({ gap: "equivalent-pending", choice: "IE00B4L5Y983" })).text).toMatch(/IE00B4L5Y983/);
    expect(compositionStatus(etf({ gap: "pending" }))).toMatchObject({ tone: "muted", canChoose: false });
  });
});

describe("exposition : annonce au choix d'un ETF", () => {
  const lookup = (over: Partial<CompositionLookup>): CompositionLookup => ({ own: info(), link: null, suggestion: null, ...over });

  it("composition déjà connue, ou reprise du lien commun sans dire qui l'a choisi", () => {
    expect(lookupMessage(lookup({}))).toMatchObject({ tone: "ok", text: expect.stringMatching(/Composition connue : 1\s285 lignes/) });
    const viaLink = lookupMessage(lookup({ own: info({ replication: "synthetique" }), link: { proxyIsin: "IE00B4L5Y983", info: info() } }));
    expect(viaLink.text).toMatch(/^ETF synthétique : sa composition sera reprise de l'ETF iShares Core MSCI World/);
    expect(viaLink.text).not.toMatch(/utilisateur/);
  });

  it("synthétique sans lien : l'équivalent proposé est annoncé", () => {
    const m = lookupMessage(lookup({ own: info({ replication: "synthetique" }), suggestion: { isin: "IE00B4L5Y983", name: "iShares Core MSCI World UCITS ETF", index: "MSCI World" } }));
    expect(m).toMatchObject({ tone: "warning", text: expect.stringMatching(/proposera iShares Core MSCI World UCITS ETF \(MSCI World\)/) });
  });

  it("on relit tant que la composition ou celle de l'équivalent commun est attendue", () => {
    expect(lookupPending(lookup({ own: info({ state: "pending" }) }))).toBe(true);
    expect(lookupPending(lookup({ own: info({ replication: "synthetique" }), link: { proxyIsin: "IE00B4L5Y983", info: info({ state: "pending" }) } }))).toBe(true);
    expect(lookupPending(lookup({}))).toBe(false);
  });

  it("en attente, émetteur non géré", () => {
    expect(lookupMessage(lookup({ own: info({ state: "pending" }) })).tone).toBe("muted");
    expect(lookupMessage(lookup({ own: info({ state: "unknown" }) })).text).toMatch(/Amundi et d'iShares/);
  });
});
