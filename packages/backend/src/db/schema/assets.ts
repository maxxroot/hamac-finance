import { bigint, boolean, doublePrecision, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { timestamps } from "./_columns";

/** Titres et cours propres au tenant (manuels, URL personnalisée, historique restauré). */

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    isin: text("isin"),
    symbol: text("symbol"),
    priceSource: text("price_source").notNull().default("manuel"),
    priceProvider: text("price_provider"),
    priceUrl: text("price_url"),
    pricePath: text("price_path"),
    classId: text("class_id"),
    inAllocation: boolean("in_allocation"),
    manualPrice: doublePrecision("manual_price"),
    manualPriceDate: text("manual_price_date"),
    targetWeight: doublePrecision("target_weight"),
    ter: doublePrecision("ter"),
    couponRate: doublePrecision("coupon_rate"),
    maturityDate: text("maturity_date"),
    couponFrequency: bigint("coupon_frequency", { mode: "number" }),
    nextCouponDate: text("next_coupon_date"),
    issuer: text("issuer"),
    bondKind: text("bond_kind"),
    /** Obligation d'État : pays de l'émetteur (ISO 3166-1) ; null = État français (fiches anciennes). */
    issuerCountry: text("issuer_country"),
    /** ETF : ISIN de l'ETF physique équivalent choisi par l'utilisateur pour l'exposition réelle ; null = lien commun de l'instance. */
    compositionIsin: text("composition_isin"),
    /** Devise de cotation (ISO 4217) : cours, nominal et coupon d'une obligation y sont exprimés. */
    currency: text("currency").notNull().default("EUR"),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("assets_isin_idx").on(t.isin)],
);

export const prices = pgTable(
  "prices",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    price: doublePrecision("price").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.date] })],
);
