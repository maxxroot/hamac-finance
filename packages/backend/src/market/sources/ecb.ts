import type { FxRate } from "@hamac/core";
import { MarketError, type Fetcher } from "../http";

/**
 * Taux de change de référence de la Banque centrale européenne, par l'API du portail de données de la BCE
 * (accès libre, sans clé) : série EXR quotidienne, unités de la devise pour 1 €, publiée vers 16 h chaque jour ouvré.
 * https://data.ecb.europa.eu/help/api/data
 */
const BASE = "https://data-api.ecb.europa.eu/service/data/EXR";

/** Premier jour de l'euro : les taux de référence commencent le 4 janvier 1999. */
export const ECB_FIRST_DAY = "1999-01-04";

export function ecbUrl(currency: string, since: string): string {
  return `${BASE}/D.${encodeURIComponent(currency)}.EUR.SP00.A?startPeriod=${since}&format=csvdata&detail=dataonly`;
}

/** Lit la réponse CSV : colonnes repérées par leur nom, lignes invalides ignorées. */
export function parseEcbCsv(csv: string): FxRate[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = (lines.shift() ?? "").split(",");
  const iCurrency = header.indexOf("CURRENCY");
  const iDate = header.indexOf("TIME_PERIOD");
  const iValue = header.indexOf("OBS_VALUE");
  if (iCurrency < 0 || iDate < 0 || iValue < 0) return [];
  return lines.flatMap((line): FxRate[] => {
    const cells = line.split(",");
    const date = cells[iDate] ?? "";
    const rate = Number(cells[iValue]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(rate) || rate <= 0) return [];
    return [{ currency: cells[iCurrency] ?? "", date, rate }];
  });
}

/** Taux d'une devise depuis `since` inclus. Une réponse vide (aucune publication depuis) n'est pas une erreur. */
export async function fetchEcbRates(fetcher: Fetcher, currency: string, since: string): Promise<FxRate[]> {
  const res = await fetcher(ecbUrl(currency, since), { headers: { Accept: "text/csv" } });
  // La BCE répond 404 quand la période ne contient aucune observation.
  if (res.status === 404) return [];
  if (!res.ok) throw new MarketError(`Réponse ${res.status} de la BCE`, res.status);
  return parseEcbCsv(await res.text()).filter((r) => r.currency === currency);
}
