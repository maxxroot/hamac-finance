import { ECB_CURRENCIES, type FxRate } from "@hamac/core";
import type { RawDb } from "../../db/driver";
import { tenantNames } from "../../db/postgres";
import type { Fetcher } from "../http";
import { ECB_FIRST_DAY, fetchEcbRates } from "../sources/ecb";

/**
 * Taux de change de la BCE, communs à toute l'instance (schéma « marche ») : chaque devise n'est téléchargée qu'une fois,
 * tout son historique la première fois, puis les derniers jours. Seules les devises des titres d'au moins un utilisateur
 * sont suivies. Les tenants n'y ont aucun droit SQL : ils reçoivent les taux par `workspace.load`.
 */

/** Une devise n'est pas réinterrogée avant ce délai (la BCE publie une fois par jour ouvré). */
export const FX_MAX_AGE_MS = 6 * 3_600_000;
/** Délai avant de réessayer une devise dont le téléchargement a échoué. */
export const FX_RETRY_MS = 15 * 60_000;
/** Jours retéléchargés avant le dernier taux connu : une publication tardive ou corrigée est reprise. */
const OVERLAP_DAYS = 7;

export const FX_TABLES = [
  `CREATE TABLE IF NOT EXISTS marche.fx_rates (
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (currency, date)
  )`,
  "CREATE TABLE IF NOT EXISTS marche.fx_status (currency TEXT PRIMARY KEY, checked_at TEXT NOT NULL)",
];

const tracked = (c: string): boolean => (ECB_CURRENCIES as readonly string[]).includes(c);
const dayBefore = (date: string, days: number) => new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10);

export class FxStore {
  private inFlight = new Map<string, Promise<void>>();
  private failedAt = new Map<string, number>();

  constructor(
    private db: RawDb,
    private fetcher: Fetcher,
  ) {}

  /** Met à jour les devises demandées qui en ont besoin. Une erreur de la BCE n'interrompt rien : les taux connus restent. */
  async ensure(currencies: readonly string[]): Promise<void> {
    for (const currency of new Set(currencies.filter(tracked))) {
      let run = this.inFlight.get(currency);
      if (!run) {
        run = this.refreshOne(currency).finally(() => this.inFlight.delete(currency));
        this.inFlight.set(currency, run);
      }
      await run;
    }
  }

  private async refreshOne(currency: string): Promise<void> {
    const status = await this.db.get<{ checked_at: string }>("SELECT checked_at FROM marche.fx_status WHERE currency = ?", [currency]);
    if (status && Date.now() - Date.parse(status.checked_at) < FX_MAX_AGE_MS) return;
    if (Date.now() - (this.failedAt.get(currency) ?? 0) < FX_RETRY_MS) return;
    const last = await this.db.get<{ date: string | null }>("SELECT MAX(date) AS date FROM marche.fx_rates WHERE currency = ?", [currency]);
    try {
      const rates = await fetchEcbRates(this.fetcher, currency, last?.date ? dayBefore(last.date, OVERLAP_DAYS) : ECB_FIRST_DAY);
      for (let i = 0; i < rates.length; i += 1000) {
        const part = rates.slice(i, i + 1000);
        await this.db.run(
          `INSERT INTO marche.fx_rates (currency, date, rate) VALUES ${part.map(() => "(?, ?, ?)").join(", ")} ON CONFLICT (currency, date) DO UPDATE SET rate = excluded.rate`,
          part.flatMap((r) => [currency, r.date, r.rate]),
        );
      }
      await this.db.run("INSERT INTO marche.fx_status (currency, checked_at) VALUES (?, ?) ON CONFLICT (currency) DO UPDATE SET checked_at = excluded.checked_at", [currency, new Date().toISOString()]);
      this.failedAt.delete(currency);
    } catch (err) {
      this.failedAt.set(currency, Date.now());
      console.error(`[hamac] taux de change ${currency} :`, (err as Error).message);
    }
  }

  /** Devises qui ont déjà au moins un taux. */
  async known(currencies: readonly string[]): Promise<Set<string>> {
    if (!currencies.length) return new Set();
    const rows = await this.db.all<{ currency: string }>(`SELECT DISTINCT currency FROM marche.fx_rates WHERE currency IN (${currencies.map(() => "?").join(", ")})`, [...currencies]);
    return new Set(rows.map((r) => r.currency));
  }

  /** Tous les taux publiés de ces devises depuis `since`, plus le dernier avant (il s'applique à `since`). */
  async rates(currencies: readonly string[], since: string): Promise<FxRate[]> {
    if (!currencies.length) return [];
    const list = currencies.map(() => "?").join(", ");
    return this.db.all<FxRate>(
      `SELECT currency, date, rate FROM marche.fx_rates WHERE currency IN (${list}) AND (date >= ? OR (currency, date) IN (SELECT currency, MAX(date) FROM marche.fx_rates WHERE currency IN (${list}) AND date < ? GROUP BY currency)) ORDER BY currency, date`,
      [...currencies, since, ...currencies, since],
    );
  }

  /** Dernier taux publié à ou avant `date` ; à défaut, le premier connu. */
  async rateOn(currency: string, date: string): Promise<{ rate: number; date: string } | null> {
    return (
      (await this.db.get<{ rate: number; date: string }>("SELECT rate, date FROM marche.fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1", [currency, date])) ??
      (await this.db.get<{ rate: number; date: string }>("SELECT rate, date FROM marche.fx_rates WHERE currency = ? ORDER BY date LIMIT 1", [currency])) ??
      null
    );
  }

  /** Devises des titres de tous les tenants : elles restent à jour même quand personne n'est connecté. */
  async collect(tenantIds: readonly string[]): Promise<string[]> {
    const out = new Set<string>();
    for (const id of tenantIds) {
      const { schema } = tenantNames(id);
      const hasColumn = await this.db.get("SELECT 1 AS x FROM information_schema.columns WHERE table_schema = ? AND table_name = 'assets' AND column_name = 'currency'", [schema]);
      if (!hasColumn) continue;
      const rows = await this.db.all<{ currency: string }>(`SELECT DISTINCT currency FROM "${schema}".assets WHERE NOT archived AND currency <> 'EUR'`);
      for (const r of rows) out.add(r.currency);
    }
    return [...out];
  }
}
