import { addDays, currencyOf, roundCents, type IsoDate } from "../../base";
import { remainingFlows } from "../../investments";
import type { Asset, FxBook, Transaction } from "../../model";
import { bondTerms } from "../../portfolio";

/** Délai laissé pour saisir un coupon : avant, il n'est ni attendu ni signalé comme manquant. */
export const COUPON_GRACE_DAYS = 10;
/** Un coupon saisi est rapproché du coupon prévu s'il tombe dans cette fenêtre autour de la date (au plus une demi-période). */
const MATCH_BEFORE_DAYS = 15;
const MATCH_AFTER_DAYS = 45;

export interface CouponEvent {
  accountId: string;
  assetId: string;
  date: IsoDate;
  /** Coupon brut prévu par le calendrier, pour le nominal détenu la veille, en euros (au taux de la BCE du jour pour un titre en devise). */
  expected: number;
  /** Coupon brut saisi et rapproché ; null s'il manque. */
  received: number | null;
}

export interface CouponYear {
  year: number;
  expected: number;
  received: number;
}

export interface CouponCheck {
  events: CouponEvent[];
  byYear: CouponYear[];
  expected: number;
  /** Tous les coupons saisis sur des obligations, rapprochés ou non, bruts quand le brut est connu. */
  received: number;
  missing: number;
  missingAmount: number;
  /** Coupons saisis par ligne (clé `compte|titre`). */
  receivedByLine: ReadonlyMap<string, number>;
}

export const lineKey = (accountId: string, assetId: string) => `${accountId}|${assetId}`;

/** Montant brut d'un coupon saisi : le brut du détail fiscal s'il est rempli, sinon le montant reçu. */
const grossOf = (tx: Transaction) => tx.gross ?? tx.amount;

/**
 * Coupons attendus d'après le calendrier de chaque obligation et le nominal détenu, comparés aux opérations
 * « Intérêts / coupon » saisies sur cette obligation. Les coupons ne sont jamais générés : ce rapprochement
 * signale ceux qui manquent dans le Journal. Un coupon en devise est attendu en euros au taux du jour du versement :
 * celui de l'opération rapprochée s'il est saisi, sinon celui de la BCE.
 */
export function couponCheck(transactions: readonly Transaction[], assets: readonly Asset[], asOf: IsoDate, fx?: FxBook): CouponCheck {
  const bonds = new Map(assets.filter((a) => a.kind === "obligation").map((a) => [a.id, a]));
  const lines = new Map<string, { accountId: string; asset: Asset; moves: Array<{ date: IsoDate; qty: number }>; coupons: Transaction[] }>();
  const line = (accountId: string, asset: Asset) => {
    const key = lineKey(accountId, asset.id);
    let l = lines.get(key);
    if (!l) lines.set(key, (l = { accountId, asset, moves: [], coupons: [] }));
    return l;
  };
  for (const tx of transactions) {
    if (tx.date > asOf) continue;
    const asset = tx.assetId ? bonds.get(tx.assetId) : undefined;
    if (asset && tx.quantity) {
      if (tx.type === "achat") line(tx.accountId, asset).moves.push({ date: tx.date, qty: tx.quantity });
      if (tx.type === "vente" || tx.type === "arbitrage") line(tx.accountId, asset).moves.push({ date: tx.date, qty: -tx.quantity });
    }
    const target = tx.type === "arbitrage" && tx.counterAssetId ? bonds.get(tx.counterAssetId) : undefined;
    if (target && tx.counterQuantity) line(tx.accountId, target).moves.push({ date: tx.date, qty: tx.counterQuantity });
    if (asset && tx.type === "interets") line(tx.accountId, asset).coupons.push(tx);
  }

  const events: CouponEvent[] = [];
  const receivedByLine = new Map<string, number>();
  const unmatched: Transaction[] = [];
  const due = addDays(asOf, -COUPON_GRACE_DAYS);
  for (const [key, l] of lines) {
    const coupons = [...l.coupons].sort((a, b) => a.date.localeCompare(b.date));
    receivedByLine.set(key, roundCents(coupons.reduce((s, tx) => s + grossOf(tx), 0)));
    const terms = bondTerms(l.asset);
    const first = l.moves.map((m) => m.date).sort()[0];
    if (!terms || !first) {
      unmatched.push(...coupons);
      continue;
    }
    const used = new Set<Transaction>();
    // Fenêtre bornée à une demi-période : un coupon mensuel ne se rapproche pas du coupon du mois voisin.
    const half = (365 / Math.max(1, terms.frequency)) / 2;
    const before = Math.min(MATCH_BEFORE_DAYS, Math.floor(half));
    const after = Math.min(MATCH_AFTER_DAYS, Math.floor(half));
    for (const f of remainingFlows(terms, first)) {
      // Un coupon dû ces derniers jours n'est attendu que s'il est déjà saisi.
      if (f.date > asOf) break;
      const couponPart = f.date === terms.maturityDate ? f.amount - 1 : f.amount;
      // Le coupon revient à qui détient le titre la veille du versement.
      const qty = l.moves.filter((m) => m.date < f.date).reduce((s, m) => s + m.qty, 0);
      if (qty <= 1e-9 || couponPart <= 0) continue;
      const match = coupons.find((tx) => !used.has(tx) && tx.date >= addDays(f.date, -before) && tx.date <= addDays(f.date, after));
      if (!match && f.date > due) continue;
      if (match) used.add(match);
      const rate = match?.fxRate ?? fx?.rate(currencyOf(l.asset), f.date) ?? 1;
      events.push({ accountId: l.accountId, assetId: l.asset.id, date: f.date, expected: roundCents((couponPart * qty) / rate), received: match ? grossOf(match) : null });
    }
    unmatched.push(...coupons.filter((tx) => !used.has(tx)));
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  const years = new Map<number, CouponYear>();
  const year = (y: number) => years.get(y) ?? years.set(y, { year: y, expected: 0, received: 0 }).get(y)!;
  for (const e of events) {
    const row = year(+e.date.slice(0, 4));
    row.expected += e.expected;
    row.received += e.received ?? 0;
  }
  for (const tx of unmatched) year(+tx.date.slice(0, 4)).received += grossOf(tx);
  const missingEvents = events.filter((e) => e.received == null);
  return {
    events,
    byYear: [...years.values()].sort((a, b) => a.year - b.year).map((r) => ({ year: r.year, expected: roundCents(r.expected), received: roundCents(r.received) })),
    expected: roundCents(events.reduce((s, e) => s + e.expected, 0)),
    received: roundCents([...receivedByLine.values()].reduce((s, v) => s + v, 0)),
    missing: missingEvents.length,
    missingAmount: roundCents(missingEvents.reduce((s, e) => s + e.expected, 0)),
    receivedByLine,
  };
}
