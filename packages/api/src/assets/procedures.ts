import { z } from "zod";
import { PRICE_PROVIDERS, type Asset, type IrlData, type PriceProvider } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { AssetInput, ManualPriceInput, MarketSeriesInput } from "./inputs";

/** Titres, cours et sources de prix. */

export interface PriceStatus {
  at: string;
  updated: number;
  errors: Array<{ assetId: string; name: string; message: string }>;
  /** Détail par titre à cours automatique : source qui a répondu, dernier cours, essais échoués. */
  assets?: Array<{ assetId: string; name: string; provider: PriceProvider | null; lastDate: string | null; message: string | null; tried: Array<{ provider: PriceProvider; message: string }> }>;
  /** Prochaine actualisation automatique. */
  nextAt?: string;
  twelveData?: { used: number; limit: number; assets: number; intervalMinutes: number } | null;
}

/** Réglages des sources de cours, tels que vus par l'interface (la clé n'en sort jamais entière). */
export interface MarketSettings {
  /** Réservé à l'administrateur de l'instance. */
  canEdit: boolean;
  order: Array<{ id: PriceProvider; enabled: boolean }>;
  twelveData: {
    /** La clé elle-même reste sur le serveur (fichier .env). */
    configured: boolean;
    used: number;
    limit: number;
    /** Titres pouvant passer par Twelve Data à chaque actualisation. */
    assets: number;
    intervalMinutes: number;
  };
}

/** Historique long d'un titre, pour le comparer sans l'ajouter au portefeuille. */
export interface MarketSeries {
  /** Vrai si les dividendes distribués sont inclus, comme s'ils étaient réinvestis. */
  dividends: boolean;
  points: Array<{ date: string; price: number }>;
}

export interface AssetCandidate {
  source: "openfigi" | "coingecko" | "euronext";
  kind: import("@hamac/core").AssetKind;
  name: string;
  isin: string | null;
  symbol: string | null;
  exchange: string | null;
  couponRate: number | null;
  maturityDate: string | null;
  /** Obligation d'État reconnue : pays de l'émetteur (ISO 3166-1). */
  issuerCountry?: string | null;
  detail: string;
}

export const assetsProcedures = {
  "assets.upsert": { input: AssetInput, output: entity<Asset>() },
  "assets.delete": { input: byId, output: ok },
  "prices.setManual": { input: ManualPriceInput, output: ok },
  "prices.refresh": { input: z.void(), output: entity<PriceStatus>() },
  "market.settings": { input: z.void(), output: entity<MarketSettings>() },
  "market.irl": { input: z.void(), output: entity<IrlData>() },
  "market.configure": {
    input: z.object({
      order: z.array(z.object({ id: z.enum(PRICE_PROVIDERS), enabled: z.boolean() })),
    }),
    output: entity<MarketSettings>(),
  },
  "assets.search": { input: z.object({ query: z.string().trim().min(2).max(80) }), output: entity<{ candidates: AssetCandidate[]; errors: string[] }>() },
  "market.series": { input: MarketSeriesInput, output: entity<MarketSeries>() },
} as const;
