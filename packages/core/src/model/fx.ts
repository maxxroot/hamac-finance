import { EUR } from "../base";

/**
 * Taux de change de référence de la BCE : nombre d'unités de la devise pour 1 € (convention de la BCE,
 * 1,0832 USD pour 1 €). Un montant en devise vaut `montant / rate` euros.
 */
export interface FxRate {
  currency: string;
  date: string;
  rate: number;
}

/**
 * Carnet des taux de change : dernier taux connu à une date (la BCE ne publie pas les week-ends et jours fériés,
 * le taux de la veille s'applique). L'euro vaut toujours 1.
 */
export class FxBook {
  private byCurrency = new Map<string, FxRate[]>();

  constructor(rates: readonly FxRate[] = []) {
    for (const r of rates) {
      if (!(r.rate > 0)) continue;
      const list = this.byCurrency.get(r.currency) ?? [];
      list.push(r);
      this.byCurrency.set(r.currency, list);
    }
    for (const list of this.byCurrency.values()) list.sort((x, y) => x.date.localeCompare(y.date));
  }

  /** Dernier taux publié à ou avant `date` ; à défaut, le premier connu ; null si la devise n'a aucun taux. */
  point(currency: string, date: string): FxRate | null {
    if (currency === EUR) return { currency, date, rate: 1 };
    const list = this.byCurrency.get(currency);
    if (!list?.length) return null;
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.date <= date) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return list[Math.max(0, found)]!;
  }

  rate(currency: string, date: string): number | null {
    return this.point(currency, date)?.rate ?? null;
  }

  has(currency: string): boolean {
    return currency === EUR || !!this.byCurrency.get(currency)?.length;
  }
}

/** Montant en devise converti en euros au taux donné (unités pour 1 €). */
export function toEur(amount: number, rate: number): number {
  return rate > 0 ? amount / rate : amount;
}
