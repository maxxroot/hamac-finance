import { roundCents } from "../base";
import { incomeTaxRate, PriceBook, type Asset, type Transaction } from "../model";
import type { EngineData } from "../portfolio";
import { socialRateFor } from "./fiscalRules";

/** Plus-values sur actifs numériques : article 150 VH bis du CGI. */

export interface CryptoSale {
  tx: Transaction;
  date: string;
  /** Prix de cession brut (avant frais). */
  gross: number;
  net: number;
  fee: number;
  /** Valeur globale du portefeuille crypto au moment de la cession. */
  portfolioValue: number;
  /** Prix total d'acquisition avant la cession. */
  acquisitionBefore: number;
  /** Fraction du prix d'acquisition imputée à cette cession. */
  attributed: number;
  gain: number;
  year: number;
  /** Un autre actif a été valorisé sans cours récent : la valeur globale est approximative. */
  estimatedValue: boolean;
}

export interface CryptoYear {
  year: number;
  grossSales: number;
  netGain: number;
  exempt: boolean;
  incomeTax: number;
  social: number;
  total: number;
}

export interface CryptoTaxReport {
  sales: CryptoSale[];
  years: CryptoYear[];
  /** Prix total d'acquisition restant (portefeuille global). */
  remainingAcquisition: number;
}

/**
 * Plus-value de chaque cession : PV = prix de cession net − PTA × prix de cession brut / valeur globale du portefeuille.
 * Le portefeuille est global (toutes plateformes). Seules les ventes contre des euros sont imposables :
 * un arbitrage d'une crypto à une autre (stablecoins compris) n'est pas une cession et laisse le prix total
 * d'acquisition inchangé (CGI, art. 150 VH bis, II).
 */
export function cryptoTax(data: EngineData, asOf: string): CryptoTaxReport {
  const { params } = data;
  const cryptoAccounts = new Set(data.accounts.filter((a) => a.kind === "crypto").map((a) => a.id));
  const assets = new Map<string, Asset>(data.assets.map((a) => [a.id, a]));
  const book = new PriceBook(data.prices, data.assets);
  const txs = data.transactions
    .filter(
      (t) =>
        t.date <= asOf &&
        cryptoAccounts.has(t.accountId) &&
        t.assetId &&
        assets.get(t.assetId)?.kind === "crypto" &&
        (t.type === "achat" || t.type === "vente" || (t.type === "arbitrage" && !!t.counterAssetId && assets.get(t.counterAssetId)?.kind === "crypto")),
    )
    .sort((a, b) => (a.date === b.date ? (a.type === "achat" ? -1 : 1) : a.date.localeCompare(b.date)));

  const qty = new Map<string, number>();
  const costPerUnit = new Map<string, { qty: number; cost: number }>();
  let pta = 0;
  const sales: CryptoSale[] = [];

  for (const t of txs) {
    const id = t.assetId!;
    const q = t.quantity ?? 0;
    if (t.type === "arbitrage") {
      // Les quantités changent de crypto, le prix total d'acquisition ne bouge pas.
      const to = t.counterAssetId!;
      qty.set(id, Math.max(0, (qty.get(id) ?? 0) - q));
      qty.set(to, (qty.get(to) ?? 0) + (t.counterQuantity ?? 0));
      const c = costPerUnit.get(id) ?? { qty: 0, cost: 0 };
      const out = Math.min(q, c.qty);
      const moved = c.qty > 0 ? (c.cost * out) / c.qty : 0;
      costPerUnit.set(id, { qty: c.qty - out, cost: c.cost - moved });
      const d = costPerUnit.get(to) ?? { qty: 0, cost: 0 };
      costPerUnit.set(to, { qty: d.qty + (t.counterQuantity ?? 0), cost: d.cost + moved });
      continue;
    }
    if (t.type === "achat") {
      pta += t.amount;
      qty.set(id, (qty.get(id) ?? 0) + q);
      const c = costPerUnit.get(id) ?? { qty: 0, cost: 0 };
      costPerUnit.set(id, { qty: c.qty + q, cost: c.cost + t.amount });
      continue;
    }
    const fee = t.fee ?? 0;
    const gross = t.amount + fee;
    const unit = q > 0 ? gross / q : 0;
    // Valeur globale : le titre vendu au prix de la cession, les autres au dernier cours connu (sinon au coût).
    let V = 0;
    let estimatedValue = false;
    for (const [aid, held] of qty) {
      if (held <= 0) continue;
      if (aid === id) V += held * unit;
      else {
        const p = book.at(aid, t.date);
        const c = costPerUnit.get(aid);
        if (!p || Date.parse(t.date) - Date.parse(p.date) > 7 * 86_400_000) estimatedValue = true;
        V += held * (p?.price ?? (c && c.qty > 0 ? c.cost / c.qty : 0));
      }
    }
    const attributed = V > 0 ? (pta * gross) / V : 0;
    const gain = t.amount - attributed;
    sales.push({ tx: t, date: t.date, gross: roundCents(gross), net: t.amount, fee, portfolioValue: roundCents(V), acquisitionBefore: roundCents(pta), attributed: roundCents(attributed), gain: roundCents(gain), year: +t.date.slice(0, 4), estimatedValue });
    pta = Math.max(0, pta - attributed);
    qty.set(id, Math.max(0, (qty.get(id) ?? 0) - q));
  }

  const ir = incomeTaxRate(params);
  const yearsSet = [...new Set(sales.map((s) => s.year))].sort((a, b) => a - b);
  const years: CryptoYear[] = yearsSet.map((year) => {
    const ys = sales.filter((s) => s.year === year);
    const grossSales = roundCents(ys.reduce((s, x) => s + x.gross, 0));
    const netGain = roundCents(ys.reduce((s, x) => s + x.gain, 0));
    const exempt = grossSales <= params.crypto.exemptionThreshold;
    const base = exempt ? 0 : Math.max(0, netGain);
    const incomeTax = roundCents(base * ir);
    const social = roundCents(base * socialRateFor(year, "patrimoine", params));
    return { year, grossSales, netGain, exempt, incomeTax, social, total: roundCents(incomeTax + social) };
  });
  return { sales, years, remainingAcquisition: roundCents(pta) };
}
