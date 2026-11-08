import type { PriceProvider } from "@hamac/core";
import type { PgProvider, PgSession, RawDb } from "../db/driver";
import { rawFor, tenantNames } from "../db/postgres";
import { assertPlausible } from "./plausible";
import { normalizeOrder, twelveDataAssets, type MarketState } from "./config";
import { chainFor, defaultFetcher, fetchFrom, instrumentKey, type Fetcher, type MarketAsset, type ProviderSetting } from "./index";
import { refreshIntervalMinutes, TwelveDataBudget, type TwelveDataUsage } from "./twelvedata";

const today = () => new Date().toISOString().slice(0, 10);
/** Un même titre n'est pas réinterrogé avant ce délai, quels que soient les utilisateurs qui le demandent. */
const COOLDOWN_MS = 10 * 60_000;

export interface Instrument {
  key: string;
  provider: PriceProvider | null;
  lastDate: string | null;
  checkedAt: string | null;
  message: string | null;
  failed: boolean;
  tried: Array<{ provider: PriceProvider; message: string }>;
}

interface Row extends MarketAsset {
  key: string;
  provider: PriceProvider | null;
  last_date: string | null;
  checked_at: string | null;
  message: string | null;
  failed: boolean;
  tried: string;
}

const toInstrument = (r: Row): Instrument => ({ key: r.key, provider: r.provider, lastDate: r.last_date, checkedAt: r.checked_at, message: r.message, failed: r.failed, tried: JSON.parse(r.tried) as Instrument["tried"] });

const COLUMNS = `key, kind, isin, symbol, "priceProvider", provider, last_date, checked_at, message, failed, tried`;

const asAsset = (r: Pick<Row, "kind" | "isin" | "symbol" | "priceProvider">): MarketAsset => ({ kind: r.kind, isin: r.isin, symbol: r.symbol, priceProvider: r.priceProvider, priceSource: "auto", priceUrl: null, pricePath: null });

/**
 * Base de cours commune à toute l'instance (schéma « marche ») : chaque titre n'est téléchargé
 * qu'une fois, quel que soit le nombre de personnes qui le détiennent. Les tenants n'y ont aucun
 * droit SQL : seul ce service y lit et y écrit, et la clé Twelve Data n'en sort jamais.
 */
export class SharedMarket {
  private inFlight = new Map<string, Promise<boolean>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  private constructor(
    private session: PgSession,
    private db: RawDb,
    private fetcher: Fetcher,
  ) {}

  static async open(provider: PgProvider, fetcher: Fetcher = defaultFetcher, onLost?: () => void): Promise<SharedMarket> {
    const session = await provider.session(onLost);
    const db = rawFor(session);
    for (const statement of [
      "CREATE SCHEMA IF NOT EXISTS marche",
      `CREATE TABLE IF NOT EXISTS marche.instruments (
        key TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        isin TEXT,
        symbol TEXT,
        "priceProvider" TEXT,
        provider TEXT,
        last_date TEXT,
        checked_at TEXT,
        message TEXT,
        failed BOOLEAN NOT NULL DEFAULT FALSE,
        tried TEXT NOT NULL DEFAULT '[]'
      )`,
      `CREATE TABLE IF NOT EXISTS marche.quotes (
        key TEXT NOT NULL REFERENCES marche.instruments(key) ON DELETE CASCADE,
        date TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY (key, date)
      )`,
      "CREATE TABLE IF NOT EXISTS marche.config (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    ])
      await db.exec(statement);
    return new SharedMarket(session, db, fetcher);
  }

  private async read<T>(key: string): Promise<T | null> {
    const r = await this.db.get<{ value: string }>("SELECT value FROM marche.config WHERE key = ?", [key]);
    return r ? (JSON.parse(r.value) as T) : null;
  }

  private async write(key: string, value: unknown): Promise<void> {
    await this.db.run("INSERT INTO marche.config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(value)]);
  }

  async state(): Promise<MarketState> {
    const [order, twelveDataKey, usage] = await Promise.all([this.read<ProviderSetting[]>("order"), this.read<string>("twelveDataKey"), this.read<TwelveDataUsage>("usage")]);
    return { order: normalizeOrder(order), twelveDataKey, usage };
  }

  async configure(input: { order?: ProviderSetting[]; twelveDataKey?: string | null }): Promise<void> {
    if (input.order) await this.write("order", normalizeOrder(input.order));
    if (input.twelveDataKey !== undefined) await this.write("twelveDataKey", input.twelveDataKey);
  }

  /** Titres connus de l'instance pouvant solliciter Twelve Data : sert à calculer le rythme d'actualisation. */
  async twelveDataCount(state: MarketState): Promise<number> {
    const rows = await this.db.all<Row>(`SELECT ${COLUMNS} FROM marche.instruments`);
    return twelveDataAssets(rows.map(asAsset), state);
  }

  async instruments(keys: readonly string[]): Promise<Map<string, Instrument>> {
    if (!keys.length) return new Map();
    const rows = await this.db.all<Row>(`SELECT ${COLUMNS} FROM marche.instruments WHERE key IN (${keys.map(() => "?").join(", ")})`, keys);
    return new Map(rows.map((r) => [r.key, toInstrument(r)]));
  }

  /** Dernier cours de chaque mois, et tous les jours pour la crypto (plus-values à la date de vente). */
  async quotes(keys: readonly string[]): Promise<Array<{ key: string; date: string; price: number; source: string }>> {
    if (!keys.length) return [];
    const list = keys.map(() => "?").join(", ");
    return this.db.all(
      `SELECT key, date, price, source FROM marche.quotes WHERE key IN (${list}) AND (key LIKE 'crypto|%' OR (key, date) IN (SELECT key, MAX(date) FROM marche.quotes WHERE key IN (${list}) GROUP BY key, substr(date, 1, 7)))`,
      [...keys, ...keys],
    );
  }

  /** Actualise ces titres. Renvoie les clés qui ont reçu de nouveaux cours. */
  async refresh(assets: readonly MarketAsset[]): Promise<Set<string>> {
    const state = await this.state();
    const budget = state.twelveDataKey ? new TwelveDataBudget(state.twelveDataKey, state.usage) : null;
    const updated = new Set<string>();
    const unique = new Map(assets.flatMap((a) => { const key = instrumentKey(a); return key ? [[key, a] as const] : []; }));
    for (const [key, asset] of unique) {
      let run = this.inFlight.get(key);
      if (!run) {
        run = this.refreshOne(key, asset, state, budget).finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, run);
      }
      if (await run) updated.add(key);
    }
    if (budget) await this.write("usage", budget.usage);
    return updated;
  }

  private async refreshOne(key: string, asset: MarketAsset, state: MarketState, budget: TwelveDataBudget | null): Promise<boolean> {
    await this.db.run(`INSERT INTO marche.instruments (key, kind, isin, symbol, "priceProvider") VALUES (?, ?, ?, ?, ?) ON CONFLICT (key) DO NOTHING`, [key, asset.kind, asset.isin, asset.symbol, asset.priceProvider]);
    const current = await this.db.get<Row>(`SELECT ${COLUMNS} FROM marche.instruments WHERE key = ?`, [key]);
    if (current?.checked_at && Date.now() - Date.parse(current.checked_at) < COOLDOWN_MS) return false;

    const day = today();
    const { chain, reason } = chainFor(asset, state.order, !!state.twelveDataKey);
    const finish = (fields: { provider: PriceProvider | null; lastDate: string | null; message: string | null; failed: boolean; tried: Instrument["tried"] }) =>
      this.db.run("UPDATE marche.instruments SET provider = ?, last_date = ?, message = ?, failed = ?, tried = ?, checked_at = ? WHERE key = ?", [fields.provider, fields.lastDate, fields.message, fields.failed, JSON.stringify(fields.tried), new Date().toISOString(), key]);
    if (!chain.length) {
      await finish({ provider: null, lastDate: current?.last_date ?? null, message: reason, failed: false, tried: [] });
      return false;
    }
    const last = await this.db.get<{ date: string; price: number; source: string }>("SELECT date, price, source FROM marche.quotes WHERE key = ? ORDER BY date DESC LIMIT 1", [key]);
    const tried: Instrument["tried"] = [];
    for (const provider of chain) {
      try {
        // On re-télécharge les derniers jours connus (cours de clôture qui a pu changer).
        const since = last ? new Date(Date.parse(last.date) - 86_400_000 * 3).toISOString().slice(0, 10) : null;
        const quotes = await fetchFrom(this.fetcher, provider, asset, since, day, { twelveDataKey: state.twelveDataKey, budget, web: true });
        assertPlausible(asset, provider, quotes, last);
        for (let i = 0; i < quotes.length; i += 1000) {
          const part = quotes.slice(i, i + 1000);
          await this.db.run(
            `INSERT INTO marche.quotes (key, date, price, source) VALUES ${part.map(() => "(?, ?, ?, ?)").join(", ")} ON CONFLICT (key, date) DO UPDATE SET price = excluded.price, source = excluded.source`,
            part.flatMap((q) => [key, q.date, q.price, provider]),
          );
        }
        await finish({ provider, lastDate: quotes.at(-1)?.date ?? last?.date ?? null, message: null, failed: false, tried });
        return quotes.length > 0;
      } catch (e) {
        tried.push({ provider, message: (e as Error).message });
      }
    }
    await finish({ provider: null, lastDate: last?.date ?? null, message: "Aucune source n'a répondu", failed: true, tried });
    return false;
  }

  /** Titres à cours automatique de tous les tenants : personne n'a besoin d'être connecté pour qu'ils soient à jour. */
  async collect(tenantIds: readonly string[]): Promise<MarketAsset[]> {
    const out: MarketAsset[] = [];
    for (const id of tenantIds) {
      const { schema } = tenantNames(id);
      if (!(await this.db.get<{ t: string | null }>(`SELECT to_regclass('"${schema}".assets')::text AS t`))?.t) continue;
      const rows = await this.db.all<MarketAsset>(`SELECT kind, isin, symbol, price_source AS "priceSource", price_provider AS "priceProvider", price_url AS "priceUrl", price_path AS "pricePath" FROM "${schema}".assets WHERE NOT archived`);
      out.push(...rows);
    }
    return out;
  }

  /** Boucle d'actualisation de l'instance, au rythme imposé par le quota des sources. */
  start(listTenants: () => Promise<string[]>): void {
    const tick = async () => {
      try {
        await this.refresh(await this.collect(await listTenants()));
      } catch (err) {
        console.error("[hamac] actualisation des cours :", err);
      }
      if (this.stopped) return;
      const minutes = refreshIntervalMinutes(await this.twelveDataCount(await this.state()).catch(() => 0));
      this.timer = setTimeout(() => void tick(), minutes * 60_000);
      this.timer.unref?.();
    };
    this.timer = setTimeout(() => void tick(), 3_000);
    this.timer.unref?.();
  }

  async close(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.session.end();
  }
}
