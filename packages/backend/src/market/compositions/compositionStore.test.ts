import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../../index";
import { rawFor } from "../../db/postgres";
import { amundiFake, testBackend, testMarket, testProvider } from "../../testkit";
import { CompositionStore } from "./compositionStore";
import type { Fetcher } from "../http";

const DAY = 86_400_000;

async function store(fetcher: Fetcher, clock: { t: number }) {
  await testMarket();
  return new CompositionStore(rawFor(await testProvider().session()), fetcher, { spacingMs: 0, now: () => clock.t });
}

describe("compositions partagées par l'instance", () => {
  it("téléchargée une fois, puis gardée jusqu'au trimestre suivant", async () => {
    const clock = { t: Date.parse("2026-11-12T10:00:00Z") };
    const f = amundiFake({ IE000BI8OT95: "Direct(Physical)" });
    const s = await store(f, clock);
    expect((await s.info(["IE000BI8OT95"])).get("IE000BI8OT95")!.state).toBe("pending");
    await s.request(["IE000BI8OT95", "IE000BI8OT95"]);
    await s.idle();
    const info = (await s.info(["IE000BI8OT95"])).get("IE000BI8OT95")!;
    expect(info).toMatchObject({ state: "ok", issuer: "amundi", replication: "physique", asOf: "2026-11-09", lineCount: 2, message: null });
    expect((await s.lines(["IE000BI8OT95"])).get("IE000BI8OT95")![1]).toMatchObject({ name: "TOTALENERGIES SE", country: "FR", sector: "energie" });
    expect(f.calls).toHaveLength(1);

    clock.t += 91 * DAY;
    expect(await s.dueIsins(["IE000BI8OT95"])).toEqual([]);
    clock.t += 2 * DAY;
    expect(await s.dueIsins(["IE000BI8OT95"])).toEqual(["IE000BI8OT95"]);
    expect(await s.refresh(["IE000BI8OT95"])).toBe(1);
    expect(f.calls).toHaveLength(2);
  });

  it("un échec garde la dernière composition, la signale et n'est réessayé qu'après quelques heures", async () => {
    const clock = { t: Date.parse("2026-11-12T10:00:00Z") };
    let down = false;
    const f = amundiFake({ LU1681043599: "Indirect(Swap Based)" }, { down: () => down });
    const s = await store(f, clock);
    await s.ensure("LU1681043599");
    clock.t += 93 * DAY;
    down = true;
    const after = await s.ensure("LU1681043599");
    expect(after).toMatchObject({ state: "ok", replication: "synthetique", lineCount: 2 });
    expect(after.message).toMatch(/Réponse 500/);
    expect((await s.failures()).map((x) => x.isin)).toEqual(["LU1681043599"]);
    expect((await s.lines(["LU1681043599"])).get("LU1681043599")).toHaveLength(2);
    expect(await s.dueIsins(["LU1681043599"])).toEqual([]);
    clock.t += 7 * 3_600_000;
    down = false;
    await s.ensure("LU1681043599");
    expect(await s.failures()).toEqual([]);
  });

  it("ETF inconnu des émetteurs : noté comme tel, recherché de nouveau au bout d'un mois", async () => {
    const clock = { t: Date.parse("2026-11-12T10:00:00Z") };
    const s = await store(amundiFake({}), clock);
    expect(await s.ensure("DE0002635307")).toMatchObject({ state: "unknown", message: expect.stringMatching(/Ni Amundi ni iShares/) });
    clock.t += 29 * DAY;
    expect(await s.dueIsins(["DE0002635307"])).toEqual([]);
    clock.t += 2 * DAY;
    expect(await s.dueIsins(["DE0002635307"])).toEqual(["DE0002635307"]);
  });

  it("panne sans composition connue : échec, sans conclure que l'ETF est inconnu", async () => {
    const s = await store(amundiFake({}, { down: () => true }), { t: Date.now() });
    expect((await s.ensure("IE00B4L5Y983")).state).toBe("failed");
  });

  it("fichier déposé : sert comme une composition téléchargée, jusqu'à la mise à jour suivante qui le remplace", async () => {
    const clock = { t: Date.parse("2026-11-12T10:00:00Z") };
    let down = true;
    const s = await store(amundiFake({ IE000BI8OT95: "Direct(Physical)" }, { down: () => down }), clock);
    expect((await s.ensure("IE000BI8OT95")).state).toBe("failed");
    const lines = [{ name: "APPLE", isin: null, ticker: "AAPL", weight: 1, kind: "action" as const, sector: null, country: "US", currency: "USD" }];
    const info = await s.importFile("IE000BI8OT95", { issuer: "ishares", fundName: null, asOf: "2026-11-10", lines }, "Mon ETF");
    expect(info).toMatchObject({ state: "ok", manual: true, fundName: "Mon ETF", lineCount: 1, asOf: "2026-11-10", message: null });
    expect(await s.failures()).toEqual([]);
    expect(await s.dueIsins(["IE000BI8OT95"])).toEqual([]);

    // Un trimestre plus tard, l'émetteur ne répond toujours pas : le fichier reste, l'échec est signalé.
    clock.t += 93 * DAY;
    expect(await s.ensure("IE000BI8OT95")).toMatchObject({ state: "ok", manual: true, lineCount: 1, message: expect.stringMatching(/Réponse 500/) });
    // Il répond de nouveau : la composition téléchargée remplace le fichier.
    clock.t += 7 * 3_600_000;
    down = false;
    expect(await s.ensure("IE000BI8OT95")).toMatchObject({ state: "ok", manual: false, issuer: "amundi", lineCount: 2, message: null });
  });

  it("lien commun : le premier gardé, remplaçable par l'administrateur, et protégé du ménage", async () => {
    const clock = { t: Date.parse("2026-11-12T10:00:00Z") };
    const s = await store(amundiFake({ IE000BI8OT95: "Direct(Physical)", FR0000000001: "Direct(Physical)" }), clock);
    expect(await s.setLink("LU1681043599", "IE000BI8OT95")).toBe(true);
    expect(await s.setLink("LU1681043599", "IE00B4L5Y983")).toBe(false);
    expect((await s.links(["LU1681043599"])).get("LU1681043599")!.proxyIsin).toBe("IE000BI8OT95");
    expect(await s.setLink("LU1681043599", "IE00B4L5Y983", true)).toBe(true);
    expect((await s.allLinks()).map((l) => l.proxyIsin)).toEqual(["IE00B4L5Y983"]);

    await s.ensure("IE00B4L5Y983");
    await s.ensure("FR0000000001");
    clock.t += 100 * DAY;
    await s.prune(new Set());
    expect([...(await s.info(["IE00B4L5Y983", "FR0000000001"])).values()].map((i) => i.state)).toEqual(["unknown", "pending"]);
    await s.deleteLink("LU1681043599");
    expect(await s.allLinks()).toEqual([]);
  });
});

describe("compositions : boucle de l'instance", () => {
  let backend: Backend | null = null;
  afterEach(() => backend?.close());

  it("relève les ETF de chaque tenant et les équivalents des liens communs", async () => {
    const f = amundiFake({ LU1681043599: "Indirect(Swap Based)", IE000BI8OT95: "Direct(Physical)" });
    const market = await testMarket(f);
    const tenantId = crypto.randomUUID();
    backend = await testBackend({ market, tenantId });
    const add = (name: string, kind: "etf" | "action", isin: string) => backend!.dispatch("assets.upsert", { name, kind, isin, priceSource: "manuel" });
    await add("Amundi MSCI World Swap", "etf", "LU1681043599");
    await add("TotalEnergies", "action", "FR0000120271");
    await market.compositions.setLink("LU1681043599", "IE000BI8OT95");
    await market.compositions.idle();
    expect((await market.collectCompositionIsins([tenantId])).sort()).toEqual(["IE000BI8OT95", "LU1681043599"]);
    await market.refreshCompositions([tenantId]);
    const info = await market.compositions.info(["LU1681043599", "IE000BI8OT95"]);
    expect([...info.values()].map((i) => [i.state, i.replication])).toEqual([
      ["ok", "synthetique"],
      ["ok", "physique"],
    ]);
  });
});
