import { roundCents, yearsBetween } from "../base";

/**
 * Impôt sur la plus-value d'un bien immobilier (hors résidence principale), relu le 13 novembre 2026 sur des sources
 * secondaires concordantes (textes à confirmer : CGI art. 150 U à 150 VH, 1609 nonies G ; BOI-RFPI-PVI) :
 * - prix d'acquisition majoré des frais (réels ou 7,5 % du prix) et des travaux (réels, ou 15 % du prix après 5 ans) ;
 * - location meublée : les amortissements déduits minorent le prix d'acquisition (loi de finances pour 2025, cessions
 *   depuis le 15 février 2025) ;
 * - abattement pour durée de détention (CGI art. 150 VC) : impôt sur le revenu 6 % par an de la 6e à la 21e année,
 *   4 % la 22e (exonération après 22 ans) ; prélèvements sociaux 1,65 % par an de la 6e à la 21e, 1,60 % la 22e,
 *   9 % par an de la 23e à la 30e (exonération après 30 ans) ;
 * - 19 % d'impôt sur le revenu, 17,2 % de prélèvements sociaux (hors de la hausse de la CSG de la LFSS 2026) ;
 * - surtaxe sur la plus-value nette au-delà de 50 000 €, de 2 % à 6 % avec lissage (CGI art. 1609 nonies G).
 * Une réforme raccourcissant la durée d'exonération a été discutée pour 2026 sans être confirmée : barème actuel retenu.
 */

export const REAL_ESTATE_GAIN_RATES = { incomeTax: 0.19, social: 0.172, acquisitionFlat: 0.075, worksFlat: 0.15 };

/** Abattements pour durée de détention, selon les années pleines de détention. */
export function holdingAllowances(years: number): { incomeTax: number; social: number } {
  const beyond = Math.max(0, years - 5);
  const incomeTax = years >= 22 ? 1 : Math.min(16, beyond) * 0.06;
  const social = years >= 30 ? 1 : Math.min(16, beyond) * 0.0165 + (years >= 22 ? 0.016 : 0) + Math.max(0, years - 22) * 0.09;
  return { incomeTax: Math.min(1, incomeTax), social: Math.min(1, social) };
}

/** Surtaxe sur une plus-value nette (après abattement de l'impôt sur le revenu), avec le lissage des seuils. */
export function gainSurtax(g: number): number {
  if (g <= 50_000) return 0;
  if (g <= 60_000) return 0.02 * g - (60_000 - g) / 20;
  if (g <= 100_000) return 0.02 * g;
  if (g <= 110_000) return 0.03 * g - (110_000 - g) / 10;
  if (g <= 150_000) return 0.03 * g;
  if (g <= 160_000) return 0.04 * g - (160_000 - g) * 0.15;
  if (g <= 200_000) return 0.04 * g;
  if (g <= 210_000) return 0.05 * g - (210_000 - g) * 0.2;
  if (g <= 250_000) return 0.05 * g;
  if (g <= 260_000) return 0.06 * g - (260_000 - g) * 0.25;
  return 0.06 * g;
}

export interface RealEstateGainInput {
  purchaseDate: string;
  saleDate: string;
  /** Prix d'achat et de vente, frais d'achat réels, frais de vente, travaux (améliorations), pour la part vendue. */
  purchasePrice: number;
  acquisitionFees: number;
  works: number;
  salePrice: number;
  saleFees: number;
  /** Location meublée : amortissements déduits, qui minorent le prix d'acquisition. */
  amortization: number;
}

export interface RealEstateGain {
  years: number;
  /** Prix d'acquisition majoré des frais et travaux, minoré des amortissements. */
  acquisition: number;
  gain: number;
  allowances: { incomeTax: number; social: number };
  incomeTax: number;
  social: number;
  surtax: number;
  total: number;
}

export function realEstateGain(i: RealEstateGainInput): RealEstateGain {
  const years = yearsBetween(i.purchaseDate, i.saleDate);
  const fees = Math.max(i.acquisitionFees, i.purchasePrice * REAL_ESTATE_GAIN_RATES.acquisitionFlat);
  const works = Math.max(i.works, years > 5 ? i.purchasePrice * REAL_ESTATE_GAIN_RATES.worksFlat : 0);
  const acquisition = i.purchasePrice + fees + works - i.amortization;
  const gain = Math.max(0, i.salePrice - i.saleFees - acquisition);
  const allowances = holdingAllowances(years);
  const incomeTaxBase = gain * (1 - allowances.incomeTax);
  const incomeTax = incomeTaxBase * REAL_ESTATE_GAIN_RATES.incomeTax;
  const social = gain * (1 - allowances.social) * REAL_ESTATE_GAIN_RATES.social;
  const surtax = gainSurtax(incomeTaxBase);
  return {
    years,
    acquisition: roundCents(acquisition),
    gain: roundCents(gain),
    allowances,
    incomeTax: roundCents(incomeTax),
    social: roundCents(social),
    surtax: roundCents(surtax),
    total: roundCents(incomeTax + social + surtax),
  };
}
