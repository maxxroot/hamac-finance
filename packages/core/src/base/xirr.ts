/**
 * Taux de rendement interne annualisé sur des flux datés (équivalent de XIRR/TRI.PAIEMENTS).
 * Convention : apports négatifs, retraits et valeur finale positifs. Base exact/365.
 */
export interface Flow {
  date: string;
  amount: number;
}

const DAY = 86_400_000;
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function daysBetween(a: string, b: string): number {
  return Math.round((toTime(b) - toTime(a)) / DAY);
}

function npv(rate: number, flows: Flow[], t0: number): number {
  let s = 0;
  for (const f of flows) s += f.amount / Math.pow(1 + rate, (toTime(f.date) - t0) / DAY / 365);
  return s;
}

/** Renvoie null si le TRI n'existe pas (pas de flux de signes opposés) ou ne converge pas. */
export function xirr(flows: readonly Flow[]): number | null {
  const fs = flows.filter((f) => f.amount !== 0);
  if (!fs.some((f) => f.amount > 0) || !fs.some((f) => f.amount < 0)) return null;
  const t0 = Math.min(...fs.map((f) => toTime(f.date)));
  // Bissection sur [-99,99 % ; +1000 %] : lente mais sans divergence possible.
  let lo = -0.9999;
  let hi = 10;
  let flo = npv(lo, fs, t0);
  const fhi = npv(hi, fs, t0);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid, fs, t0);
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-10) return mid;
    if (fm * flo < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}
