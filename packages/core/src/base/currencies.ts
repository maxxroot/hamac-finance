/**
 * Devises gérées : l'euro et celles dont la Banque centrale européenne publie un taux de référence quotidien
 * (https://data.ecb.europa.eu/main-figures/ecb-reference-exchange-rates, liste relevée le 2026-11-24 :
 * le lev bulgare n'y est plus depuis le passage de la Bulgarie à l'euro).
 */
export const EUR = "EUR";

export const ECB_CURRENCIES = [
  "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON", "TRY",
  "CNY", "HKD", "SGD", "KRW", "INR", "IDR", "MYR", "PHP", "THB", "ILS", "BRL", "MXN", "ZAR",
] as const;

export const CURRENCIES: readonly string[] = [EUR, ...ECB_CURRENCIES];

export function isCurrency(code: string | null | undefined): boolean {
  return !!code && CURRENCIES.includes(code);
}

/** Devise d'un titre : l'euro quand rien n'est indiqué (titres d'avant les devises). */
export function currencyOf(x: { currency?: string | null } | null | undefined): string {
  return x?.currency || EUR;
}

export function isForeign(currency: string | null | undefined): boolean {
  return !!currency && currency !== EUR;
}

let names: Intl.DisplayNames | null = null;

/** « dollar des États-Unis », d'après les noms français du navigateur. */
export function currencyName(code: string): string {
  try {
    names ??= new Intl.DisplayNames("fr", { type: "currency" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

const formats = new Map<string, Intl.NumberFormat>();

/** 1234.5 en USD → « 1 234,50 $US ». `compact` retire les décimales. */
export function formatMoney(value: number, currency: string, opts: { compact?: boolean } = {}): string {
  const key = `${currency}|${opts.compact ? 0 : 2}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", { style: "currency", currency, ...(opts.compact ? { maximumFractionDigits: 0 } : {}) });
    formats.set(key, f);
  }
  return f.format(value);
}

/** Monnaie des pays hors zone euro dont la BCE publie le taux : devise proposée pour la dette de leur État. */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", CH: "CHF", JP: "JPY", CA: "CAD", AU: "AUD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY", CN: "CNY", HK: "HKD", SG: "SGD", KR: "KRW", IN: "INR", ID: "IDR",
  MY: "MYR", PH: "PHP", TH: "THB", IL: "ILS", BR: "BRL", MX: "MXN", ZA: "ZAR",
};

/** Devise d'usage d'un pays (ISO 3166-1) parmi celles gérées : l'euro dans la zone euro, null pour un autre pays. */
export function countryCurrency(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_CURRENCY[country] ?? (EURO_AREA.includes(country) ? EUR : null);
}

/** Pays de la zone euro au 1er janvier 2026 (21 membres, Bulgarie comprise). */
const EURO_AREA = ["AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"];
