import { describe, expect, it } from "vitest";
import { MarketError, type Fetcher } from "../http";
import { fetchIrl, parseIrlSeries } from "./irl";

const xml = (value: string) => `<x><Series IDBANK="1"><Obs TIME_PERIOD="2026-Q3" OBS_VALUE="${value}" OBS_STATUS="A" DATE_JO="2026-10-16"/><Obs TIME_PERIOD="2026-Q2" OBS_VALUE="148.37" DATE_JO="2026-07-12"/></Series></x>`;

describe("indice des loyers de l'INSEE", () => {
  it("lit trimestre, valeur et date de publication", () => {
    expect(parseIrlSeries(xml("148.06"))).toEqual([{ quarter: "2026-Q3", value: 148.06, published: "2026-10-16" }, { quarter: "2026-Q2", value: 148.37, published: "2026-07-12" }]);
  });

  it("ignore une observation invalide", () => {
    expect(parseIrlSeries('<Obs TIME_PERIOD="2026-03" OBS_VALUE="1"/><Obs TIME_PERIOD="2026-Q1" OBS_VALUE="abc"/><Obs TIME_PERIOD="2026-Q1"/>')).toEqual([]);
  });

  it("une zone en échec garde ses valeurs, toutes en échec : erreur", async () => {
    const urls: string[] = [];
    const partial: Fetcher = async (url) => {
      urls.push(url);
      return url.endsWith("010760507") ? new Response("", { status: 503 }) : new Response(xml("148.06"));
    };
    const corse = [{ quarter: "2025-Q1", value: 1, published: null }];
    const data = await fetchIrl(partial, { series: { metropole: [], corse, outremer: [] }, checkedAt: null }, "2026-11-09T00:00:00Z");
    expect(urls).toHaveLength(3);
    expect(data.series.corse).toEqual(corse);
    expect(data.series.metropole).toHaveLength(2);
    expect(data.checkedAt).toBe("2026-11-09T00:00:00Z");
    await expect(fetchIrl(async () => new Response("", { status: 500 }), null, "x")).rejects.toThrow(MarketError);
  });
});
