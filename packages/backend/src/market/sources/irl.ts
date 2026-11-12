import { NO_IRL_DATA, type IrlData, type IrlPoint, type IrlZone } from "@hamac/core";
import { MarketError, type Fetcher } from "../http";

/** Séries de l'indice de référence des loyers à la Banque de données macroéconomiques de l'INSEE (accès libre). */
const SERIES: Record<IrlZone, string> = { metropole: "001515333", corse: "010760507", outremer: "010760509" };

const attribute = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/** Lit la réponse SDMX de l'INSEE : les observations invalides sont ignorées. */
export function parseIrlSeries(xml: string): IrlPoint[] {
  return (xml.match(/<Obs\b[^>]*>/g) ?? []).flatMap((tag): IrlPoint[] => {
    const quarter = attribute(tag, "TIME_PERIOD");
    const value = Number(attribute(tag, "OBS_VALUE"));
    if (!quarter || !/^\d{4}-Q[1-4]$/.test(quarter) || !Number.isFinite(value) || value <= 0) return [];
    return [{ quarter, value, published: attribute(tag, "DATE_JO") }];
  });
}

async function fetchSeries(fetcher: Fetcher, id: string): Promise<IrlPoint[]> {
  const res = await fetcher(`https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/${id}`, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new MarketError(`Réponse ${res.status} de l'INSEE`);
  return parseIrlSeries(await res.text());
}

/** Les trois séries ; une zone en échec garde les valeurs déjà connues. */
export async function fetchIrl(fetcher: Fetcher, previous: IrlData | null, checkedAt: string): Promise<IrlData> {
  const series = { ...(previous ?? NO_IRL_DATA).series };
  const zones = Object.keys(SERIES) as IrlZone[];
  const results = await Promise.allSettled(zones.map((z) => fetchSeries(fetcher, SERIES[z])));
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.length > 0) series[zones[i]] = r.value;
  });
  if (results.every((r) => r.status === "rejected")) throw new MarketError("INSEE injoignable");
  return { series, checkedAt };
}
