import { addMonths, NO_IRL_DATA, type IrlData, type PriceProvider } from "@hamac/core";
import { fetchIrl } from "./sources/irl";
import type { PgProvider, PgSession, RawDb } from "../db/driver";
import { rawFor, tenantNames } from "../db/postgres";
import { assertPlausible } from "./plausible";
import { normalizeOrder, twelveDataAssets, type MarketState } from "./config";
import { MarketError } from "./http";
import { chainFor, defaultFetcher, fetchFrom, fetchLongHistory, instrumentKey, type Fetcher, type LongHistory, type MarketAsset, type ProviderSetting } from "./index";
import { BASE_REFRESH_MINUTES, refreshIntervalMinutes, TD_DAILY_LIMIT, TwelveDataBudget, type TwelveDataUsage } from "./sources/twelvedata";
import { COMPOSITION_TABLES, CompositionStore } from "./compositions/compositionStore";

const today = () => new Date().toISOString().slice(0, 10);
/** Un même titre n'est pas réinterrogé avant ce délai, quels que soient les utilisateurs qui le demandent. */
const COOLDOWN_MS = 10 * 60_000;

/** Un historique de comparaison est retéléchargé en entier au plus deux fois par jour. */
const SERIES_MAX_AGE_MS = 12 * 3_600_000;
/** Délai avant de réessayer un titre qu'aucune source n'a su donner, et nombre d'échecs retenus en mémoire. */
const SERIES_RETRY_MS = 10 * 60_000;
const SERIES_MAX_FAILURES = 500;
/** Un historique qui remonte aussi loin suffit : inutile d'interroger les sources suivantes. */
const SERIES_ENOUGH_MONTHS = 60;

/** Titre à comparer : seulement ce qui permet de trouver ses cours. */
export type SeriesAsset = Pick<MarketAsset, "kind" | "isin" | "symbol">;

export interface StoredSeries {
  dividends: boolean;
  points: Array<{ date: string; price: number }>;
}

/** Réglages de l'instance, lus au démarrage du serveur (fichier .env). */
export interface MarketConfig {
  twelveDataKey: string | null;
  refreshMinutes: number;
  twelveDataDailyLimit: number;
  /** Pause entre deux téléchargements de composition d'ETF (0 dans les tests). */
  compositionSpacingMs?: number;
}

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
 * droit SQL : seul ce service y lit et y écrit. La clé Twelve Data ne vient que de l'environnement du serveur :
 * elle n'est ni stockée en base, ni transmise à l'interface.
 */
const IRL_MAX_AGE_MS = 24 * 3_600_000;
const IRL_RETRY_MS = 15 * 60_000;

export class SharedMarket {
  private irlFailedAt = 0;
  private inFlight = new Map<string, Promise<boolean>>();
  private seriesInFlight = new Map<string, Promise<StoredSeries>>();
  private seriesFailures = new Map<string, { at: number; message: string }>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  /** Compositions des ETF et liens vers un ETF physique équivalent. */
  readonly compositions: CompositionStore;

  private constructor(
    private session: PgSession,
    private db: RawDb,
    private fetcher: Fetcher,
    private config: MarketConfig,
  ) {
    this.compositions = new CompositionStore(db, fetcher, { spacingMs: config.compositionSpacingMs });
  }

  static async open(provider: PgProvider, fetcher: Fetcher = defaultFetcher, onLost?: () => void, config: Partial<MarketConfig> = {}): Promise<SharedMarket> {
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
      "CREATE TABLE IF NOT EXISTS marche.series (key TEXT PRIMARY KEY, dividends BOOLEAN NOT NULL, checked_at TEXT NOT NULL)",
      `CREATE TABLE IF NOT EXISTS marche.series_points (
        key TEXT NOT NULL REFERENCES marche.series(key) ON DELETE CASCADE,
        date TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        PRIMARY KEY (key, date)
      )`,
      ...COMPOSITION_TABLES,
      // Une clé saisie autrefois dans l'interface ne doit pas rester en base.
      "DELETE FROM marche.config WHERE key = 'twelveDataKey'",
    ])
      await db.exec(statement);
    return new SharedMarket(session, db, fetcher, { twelveDataKey: null, refreshMinutes: BASE_REFRESH_MINUTES, twelveDataDailyLimit: TD_DAILY_LIMIT, ...config });
  }

  private async read<T>(key: string): Promise<T | null> {
    const r = await this.db.get<{ value: string }>("SELECT value FROM marche.config WHERE key = ?", [key]);
    return r ? (JSON.parse(r.value) as T) : null;
  }

  private async write(key: string, value: unknown): Promise<void> {
    await this.db.run("INSERT INTO marche.config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(value)]);
  }

  async state(): Promise<MarketState> {
    const [order, usage] = await Promise.all([this.read<ProviderSetting[]>("order"), this.read<TwelveDataUsage>("usage")]);
    return { order: normalizeOrder(order), twelveDataKey: this.config.twelveDataKey, usage };
  }

  async configure(order: ProviderSetting[]): Promise<void> {
    await this.write("order", normalizeOrder(order));
  }

  get dailyLimit(): number {
    return this.config.twelveDataDailyLimit;
  }

  /** Minutes entre deux actualisations, pour `assets` titres pouvant solliciter Twelve Data. */
  intervalMinutes(assets: number): number {
    return refreshIntervalMinutes(assets, this.config.refreshMinutes, this.dailyLimit);
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
    const budget = state.twelveDataKey ? new TwelveDataBudget(state.twelveDataKey, state.usage, this.dailyLimit) : null;
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

  /**
   * Historique long d'un titre, à la demande, sans passer par le portefeuille. Conservé à part des cours
   * qui valorisent les positions : il peut inclure les dividendes. Twelve Data en est exclu pour préserver son quota.
   */
  /** Indice des loyers de l'INSEE : relu au plus une fois par jour pour toute l'instance, valeurs connues si l'INSEE ne répond pas. */
  async irl(): Promise<IrlData> {
    const cached = await this.read<IrlData>("irl");
    const fresh = cached?.checkedAt != null && Date.now() - Date.parse(cached.checkedAt) < IRL_MAX_AGE_MS;
    if (fresh || Date.now() - this.irlFailedAt < IRL_RETRY_MS) return cached ?? NO_IRL_DATA;
    try {
      const data = await fetchIrl(this.fetcher, cached, new Date().toISOString());
      await this.write("irl", data);
      return data;
    } catch {
      this.irlFailedAt = Date.now();
      return cached ?? NO_IRL_DATA;
    }
  }

  async series(asset: SeriesAsset): Promise<StoredSeries> {
    const key = [asset.kind, (asset.isin ?? "").toUpperCase(), (asset.symbol ?? "").toUpperCase()].join("|");
    let run = this.seriesInFlight.get(key);
    if (!run) {
      run = this.loadSeries(key, asset).finally(() => this.seriesInFlight.delete(key));
      this.seriesInFlight.set(key, run);
    }
    return run;
  }

  private async storedSeries(key: string, dividends: boolean): Promise<StoredSeries> {
    return { dividends, points: await this.db.all<{ date: string; price: number }>("SELECT date, price FROM marche.series_points WHERE key = ? ORDER BY date", [key]) };
  }

  private async loadSeries(key: string, asset: SeriesAsset): Promise<StoredSeries> {
    const known = await this.db.get<{ dividends: boolean; checked_at: string }>("SELECT dividends, checked_at FROM marche.series WHERE key = ?", [key]);
    if (known && Date.now() - Date.parse(known.checked_at) < SERIES_MAX_AGE_MS) return this.storedSeries(key, known.dividends);
    const failure = this.seriesFailures.get(key);
    if (failure && Date.now() - failure.at < SERIES_RETRY_MS) {
      if (known) return this.storedSeries(key, known.dividends);
      throw new MarketError(failure.message);
    }

    const state = await this.state();
    const target: MarketAsset = { ...asset, priceSource: "auto", priceProvider: null, priceUrl: null, pricePath: null };
    const { chain, reason } = chainFor(target, state.order, false);
    let message = reason ?? "Aucune source n'a de cours pour ce titre.";
    // Toutes les sources ne remontent pas aussi loin (Euronext : deux ans environ) : on garde la plus longue.
    let best: LongHistory | null = null;
    for (const provider of chain) {
      try {
        const found = await fetchLongHistory(this.fetcher, provider, target, today());
        if (found.quotes.length < 2) throw new MarketError("Historique trop court.");
        if (!best || found.quotes[0]!.date < best.quotes[0]!.date) best = found;
        if (best.quotes[0]!.date <= addMonths(today(), -SERIES_ENOUGH_MONTHS)) break;
      } catch (e) {
        message = (e as Error).message;
      }
    }
    if (best) {
      const { quotes, dividends } = best;
      await this.db.run("INSERT INTO marche.series (key, dividends, checked_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET dividends = excluded.dividends, checked_at = excluded.checked_at", [key, dividends, new Date().toISOString()]);
      for (let i = 0; i < quotes.length; i += 1000) {
        const part = quotes.slice(i, i + 1000);
        await this.db.run(`INSERT INTO marche.series_points (key, date, price) VALUES ${part.map(() => "(?, ?, ?)").join(", ")} ON CONFLICT (key, date) DO UPDATE SET price = excluded.price`, part.flatMap((q) => [key, q.date, q.price]));
      }
      await this.db.run("DELETE FROM marche.series_points WHERE key = ? AND date < ?", [key, quotes[0]!.date]);
      this.seriesFailures.delete(key);
      return this.storedSeries(key, dividends);
    }
    if (this.seriesFailures.size >= SERIES_MAX_FAILURES) this.seriesFailures.delete(this.seriesFailures.keys().next().value!);
    this.seriesFailures.set(key, { at: Date.now(), message });
    if (known) return this.storedSeries(key, known.dividends);
    throw new MarketError(message);
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

  /**
   * ETF de tous les tenants dont la composition sert : leur ISIN, et l'équivalent choisi par chacun.
   * Un tenant pas encore mis à jour n'a pas la colonne du choix : on ne lit alors que l'ISIN.
   */
  async collectCompositionIsins(tenantIds: readonly string[]): Promise<string[]> {
    const out = new Set<string>();
    for (const id of tenantIds) {
      const { schema } = tenantNames(id);
      if (!(await this.db.get<{ t: string | null }>(`SELECT to_regclass('"${schema}".assets')::text AS t`))?.t) continue;
      const hasChoice = !!(await this.db.get("SELECT 1 AS x FROM information_schema.columns WHERE table_schema = ? AND table_name = 'assets' AND column_name = 'composition_isin'", [schema]));
      const rows = await this.db.all<{ isin: string | null; choice: string | null }>(
        `SELECT isin, ${hasChoice ? "composition_isin" : "NULL"} AS choice FROM "${schema}".assets WHERE NOT archived AND kind = 'etf'`,
      );
      for (const r of rows) for (const i of [r.isin, r.choice]) if (i) out.add(i);
    }
    // Les équivalents des liens communs servent aux ETF qui y renvoient.
    for (const [, link] of await this.compositions.links([...out])) out.add(link.proxyIsin);
    return [...out];
  }

  /** Compositions dues de toute l'instance : remises à jour chaque trimestre, oubliées quand plus personne n'en a besoin. */
  async refreshCompositions(tenantIds: readonly string[]): Promise<void> {
    const isins = await this.collectCompositionIsins(tenantIds);
    await this.compositions.refresh(isins);
    await this.compositions.prune(new Set(isins));
  }

  /** Boucle d'actualisation de l'instance, au rythme imposé par le quota des sources. */
  start(listTenants: () => Promise<string[]>): void {
    const tick = async () => {
      try {
        await this.refresh(await this.collect(await listTenants()));
      } catch (err) {
        console.error("[hamac] actualisation des cours :", err);
      }
      try {
        await this.refreshCompositions(await listTenants());
      } catch (err) {
        console.error("[hamac] compositions des ETF :", err);
      }
      if (this.stopped) return;
      const minutes = this.intervalMinutes(await this.twelveDataCount(await this.state()).catch(() => 0));
      this.timer = setTimeout(() => void tick(), minutes * 60_000);
      this.timer.unref?.();
    };
    this.timer = setTimeout(() => void tick(), 3_000);
    this.timer.unref?.();
  }

  async close(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.compositions.stop();
    await this.session.end();
  }
}
