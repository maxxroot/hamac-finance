import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { MarketError, type Fetcher, type Quote } from "./http";

/** Source « URL personnalisée » : une adresse propre au titre, renvoyant du JSON, et le chemin du prix. */

const MAX_BYTES = 2_000_000;

const privateRanges = new BlockList();
for (const [net, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) privateRanges.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::1", 128], ["::", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) privateRanges.addSubnet(net, bits, "ipv6");

function isPrivate(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  const ip = mapped ? mapped[1]! : address;
  return privateRanges.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/** En mode web, le serveur ne doit pas servir de relais vers son réseau interne. */
export async function assertPublicUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MarketError("Adresse invalide.");
  }
  if (url.protocol !== "https:") throw new MarketError("Sur un serveur, seules les adresses https sont acceptées.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new MarketError(`Adresse introuvable : ${host}.`);
  }
  if (!addresses.length || addresses.some(isPrivate)) throw new MarketError("Cette adresse pointe vers un réseau privé : refusée sur un serveur.");
}

/** Lit « data.0.close » dans une réponse JSON. */
export function readPath(json: unknown, path: string): unknown {
  let cur = json;
  for (const part of path.split(".").filter(Boolean)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function toPrice(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[\s  ]/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function customQuote(fetcher: Fetcher, asset: { priceUrl: string | null; pricePath: string | null; isin: string | null; symbol: string | null }, today: string, web: boolean): Promise<Quote[]> {
  if (!asset.priceUrl || !asset.pricePath) throw new MarketError("Adresse ou chemin du prix manquant.");
  const url = asset.priceUrl.replaceAll("{isin}", encodeURIComponent(asset.isin ?? "")).replaceAll("{symbol}", encodeURIComponent(asset.symbol ?? ""));
  if (web) await assertPublicUrl(url);
  const res = await fetcher(url, web ? { redirect: "error" } : undefined);
  if (!res.ok) throw new MarketError(`Réponse ${res.status} de ${new URL(url).host}.`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new MarketError("Réponse trop volumineuse.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new MarketError("La réponse n'est pas du JSON.");
  }
  const price = toPrice(readPath(json, asset.pricePath));
  if (price == null) throw new MarketError(`Aucun prix trouvé au chemin « ${asset.pricePath} ».`);
  return [{ date: today, price }];
}
