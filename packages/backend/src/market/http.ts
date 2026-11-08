/** Client HTTP minimal, injectable (tests sans réseau). */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export const defaultFetcher: Fetcher = (url, init = {}) =>
  fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });

export class MarketError extends Error {}

export async function getJson<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const res = await fetcher(url, init);
  if (res.status === 429) throw new MarketError("Trop de requêtes : le fournisseur limite l'accès, réessayez plus tard.");
  if (!res.ok) throw new MarketError(`Réponse ${res.status} de ${new URL(url).host}`);
  return (await res.json()) as T;
}

export interface Quote {
  date: string;
  price: number;
}

export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
