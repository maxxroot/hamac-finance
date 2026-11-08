import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { get as httpsGet } from "node:https";
import { BlockList, isIP } from "node:net";
import { MarketError, UA, type Fetcher, type Quote } from "./http";

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
    addresses = isIP(host) ? [host] : (await dnsLookup(host, { all: true })).map((a) => a.address);
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

/** Résolution DNS contrôlée au moment même de la connexion : une réponse changée entre-temps ne passe pas. */
export function guardedLookup(resolve: typeof dnsLookup = dnsLookup) {
  return (host: string, options: { family?: number; all?: boolean }, callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void): void => {
    void resolve(host, { all: true, family: options.family ?? 0 }).then(
      (found) => {
        if (!found.length || found.some((a) => isPrivate(a.address))) return callback(new MarketError("Cette adresse pointe vers un réseau privé : refusée sur un serveur."), []);
        if (options.all) callback(null, found);
        else callback(null, found[0]!.address, found[0]!.family);
      },
      (err: Error) => callback(err, []),
    );
  };
}

/** GET https pour une instance web : DNS contrôlé, sans redirection, taille et durée limitées. */
function publicGet(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { lookup: guardedLookup() as never, timeout: 15_000, headers: { Accept: "application/json", "User-Agent": UA } }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_BYTES) {
          req.destroy(new MarketError("Réponse trop volumineuse."));
          return;
        }
        chunks.push(c);
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new MarketError("Délai dépassé.")));
    req.on("error", reject);
  });
}

/** Lit une réponse en s'arrêtant à la taille maximale, sans tout charger en mémoire. */
async function readLimited(res: Response): Promise<string> {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new MarketError("Réponse trop volumineuse.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function customQuote(fetcher: Fetcher, asset: { priceUrl: string | null; pricePath: string | null; isin: string | null; symbol: string | null }, today: string, web: boolean): Promise<Quote[]> {
  if (!asset.priceUrl || !asset.pricePath) throw new MarketError("Adresse ou chemin du prix manquant.");
  const url = asset.priceUrl.replaceAll("{isin}", encodeURIComponent(asset.isin ?? "")).replaceAll("{symbol}", encodeURIComponent(asset.symbol ?? ""));
  let status: number;
  let text: string;
  if (web) {
    await assertPublicUrl(url);
    ({ status, text } = await publicGet(url));
  } else {
    const res = await fetcher(url);
    status = res.status;
    text = await readLimited(res);
  }
  if (status < 200 || status >= 300) throw new MarketError(`Réponse ${status} de ${new URL(url).host}.`);
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
