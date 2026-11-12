import type { CompositionInfo, CompositionIssuer, EtfHolding, Replication } from "@hamac/core";
import type { RawDb } from "../../db/driver";
import { fetchComposition, findComposition, type FetchedComposition } from "./composition";
import type { Fetcher } from "../http";

/**
 * Compositions des ETF, communes à toute l'instance (schéma « marche »).
 * Chaque ETF n'est téléchargé qu'une fois, quel que soit le nombre de personnes qui le détiennent,
 * puis remis à jour chaque trimestre, au rythme des révisions des grands indices.
 * La dernière composition valable est gardée quand une mise à jour échoue.
 *
 * Les liens « ETF synthétique ou non géré → ETF physique équivalent » sont aussi communs : le premier lien vérifié
 * sert de proposition à tous. Ils ne disent pas qui les a choisis. Le choix propre à chaque utilisateur reste dans son schéma.
 */

/** Une composition est remise à jour après ce délai : un trimestre. */
export const COMPOSITION_MAX_AGE_MS = 92 * 86_400_000;
/** Délai avant de réessayer un téléchargement qui a échoué. */
export const COMPOSITION_RETRY_MS = 6 * 3_600_000;
/** Un ETF qu'aucun émetteur géré ne connaît est recherché de nouveau après ce délai (un émetteur peut l'ajouter). */
export const COMPOSITION_UNKNOWN_RETRY_MS = 30 * 86_400_000;
/** Au plus autant d'ETF en attente de téléchargement à la demande : au-delà, la boucle de l'instance prend le relais. */
const MAX_QUEUE = 100;

export const COMPOSITION_TABLES = [
  `CREATE TABLE IF NOT EXISTS marche.compositions (
    isin TEXT PRIMARY KEY,
    issuer TEXT,
    issuer_id TEXT,
    fund_name TEXT,
    replication TEXT,
    as_of TEXT,
    lines TEXT,
    line_count INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL,
    fetched_at TEXT,
    message TEXT,
    failed BOOLEAN NOT NULL DEFAULT FALSE
  )`,
  `CREATE TABLE IF NOT EXISTS marche.composition_links (
    isin TEXT PRIMARY KEY,
    proxy_isin TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

export type { CompositionInfo };

export interface CompositionLink {
  isin: string;
  proxyIsin: string;
  createdAt: string;
}

interface Row {
  isin: string;
  issuer: CompositionIssuer | null;
  issuer_id: string | null;
  fund_name: string | null;
  replication: Replication | null;
  as_of: string | null;
  line_count: number;
  checked_at: string;
  fetched_at: string | null;
  message: string | null;
  failed: boolean;
}

const INFO_COLUMNS = "isin, issuer, issuer_id, fund_name, replication, as_of, line_count, checked_at, fetched_at, message, failed";
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

const pending = (isin: string): CompositionInfo => ({ isin, state: "pending", issuer: null, fundName: null, replication: null, asOf: null, lineCount: 0, checkedAt: null, fetchedAt: null, message: null });

function stateOf(r: Row): CompositionInfo["state"] {
  if (r.fetched_at) return "ok";
  if (r.failed) return "failed";
  return r.issuer ? "pending" : "unknown";
}

function toInfo(r: Row): CompositionInfo {
  const state = stateOf(r);
  return { isin: r.isin, state, issuer: r.issuer, fundName: r.fund_name, replication: r.replication, asOf: r.as_of, lineCount: Number(r.line_count), checkedAt: r.checked_at, fetchedAt: r.fetched_at, message: r.message };
}

export interface CompositionStoreOptions {
  /** Pause entre deux téléchargements, par politesse envers les émetteurs. */
  spacingMs?: number;
  now?: () => number;
}

export class CompositionStore {
  private readonly queue = new Set<string>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private worker: Promise<void> | null = null;
  private readonly spacingMs: number;
  private readonly now: () => number;

  constructor(
    private readonly db: RawDb,
    private readonly fetcher: Fetcher,
    options: CompositionStoreOptions = {},
  ) {
    this.spacingMs = options.spacingMs ?? 1_000;
    this.now = options.now ?? Date.now;
  }

  private async rows(isins: readonly string[]): Promise<Row[]> {
    if (!isins.length) return [];
    return this.db.all<Row>(`SELECT ${INFO_COLUMNS} FROM marche.compositions WHERE isin IN (${isins.map(() => "?").join(", ")})`, isins);
  }

  /** État de chaque composition ; un ISIN jamais demandé est « pending ». */
  async info(isins: readonly string[]): Promise<Map<string, CompositionInfo>> {
    const unique = [...new Set(isins)];
    const found = new Map((await this.rows(unique)).map((r) => [r.isin, toInfo(r)]));
    return new Map(unique.map((i) => [i, found.get(i) ?? pending(i)]));
  }

  /** Lignes des compositions connues. */
  async lines(isins: readonly string[]): Promise<Map<string, EtfHolding[]>> {
    const unique = [...new Set(isins)];
    if (!unique.length) return new Map();
    const rows = await this.db.all<{ isin: string; lines: string }>(`SELECT isin, lines FROM marche.compositions WHERE lines IS NOT NULL AND isin IN (${unique.map(() => "?").join(", ")})`, unique);
    return new Map(rows.map((r) => [r.isin, JSON.parse(r.lines) as EtfHolding[]]));
  }

  private due(row: Row | undefined): boolean {
    if (!row) return true;
    const now = this.now();
    const checked = Date.parse(row.checked_at);
    if (row.failed && now - checked < COMPOSITION_RETRY_MS) return false;
    if (row.fetched_at) return row.failed || now - Date.parse(row.fetched_at) >= COMPOSITION_MAX_AGE_MS;
    if (!row.issuer && !row.failed) return now - checked >= COMPOSITION_UNKNOWN_RETRY_MS;
    return true;
  }

  /** ISIN à télécharger parmi ceux-ci : jamais vus, d'il y a plus d'un trimestre, ou dont l'échec est assez ancien. */
  async dueIsins(isins: readonly string[]): Promise<string[]> {
    const unique = [...new Set(isins)].filter((i) => ISIN_RE.test(i));
    const rows = new Map((await this.rows(unique)).map((r) => [r.isin, r]));
    return unique.filter((i) => this.due(rows.get(i)));
  }

  /** Demande le téléchargement de ces compositions, sans attendre : l'appel revient tout de suite. */
  async request(isins: readonly string[]): Promise<void> {
    for (const isin of await this.dueIsins(isins)) {
      if (this.queue.size >= MAX_QUEUE) break;
      if (!this.inFlight.has(isin)) this.queue.add(isin);
    }
    this.worker ??= this.drain().finally(() => {
      this.worker = null;
    });
  }

  private async drain(): Promise<void> {
    while (this.queue.size) {
      const isin = this.queue.values().next().value!;
      this.queue.delete(isin);
      await this.update(isin);
      if (this.queue.size && this.spacingMs) await new Promise((r) => setTimeout(r, this.spacingMs));
    }
  }

  /** Télécharge cette composition si elle est due, en attendant le résultat (vérification d'un équivalent). */
  async ensure(isin: string): Promise<CompositionInfo> {
    if ((await this.dueIsins([isin])).length) await this.update(isin);
    return (await this.info([isin])).get(isin)!;
  }

  /** Met à jour, l'une après l'autre, celles qui sont dues (boucle de l'instance). Renvoie le nombre de téléchargements. */
  async refresh(isins: readonly string[], max = 20): Promise<number> {
    const due = (await this.dueIsins(isins)).slice(0, max);
    for (const [i, isin] of due.entries()) {
      await this.update(isin);
      if (i < due.length - 1 && this.spacingMs) await new Promise((r) => setTimeout(r, this.spacingMs));
    }
    return due.length;
  }

  /** Attend la fin des téléchargements en cours (tests, arrêt du serveur). */
  async idle(): Promise<void> {
    while (this.worker || this.inFlight.size) await Promise.all([this.worker, ...this.inFlight.values()]);
  }

  /** Arrêt du serveur : plus rien de nouveau, on laisse finir ce qui est en cours. */
  async stop(): Promise<void> {
    this.queue.clear();
    await this.idle();
  }

  private update(isin: string): Promise<void> {
    let run = this.inFlight.get(isin);
    if (!run) {
      run = this.download(isin).finally(() => this.inFlight.delete(isin));
      this.inFlight.set(isin, run);
    }
    return run;
  }

  private async download(isin: string): Promise<void> {
    const [row] = await this.rows([isin]);
    const at = new Date(this.now()).toISOString();
    let found: FetchedComposition | null = null;
    let error: string | null = null;
    // Source déjà connue : on la retélécharge directement ; si elle ne répond plus, on recherche de nouveau par ISIN.
    if (row?.issuer && row.issuer_id) {
      try {
        found = await fetchComposition(this.fetcher, { issuer: row.issuer, issuerId: row.issuer_id });
      } catch (e) {
        error = (e as Error).message;
      }
    }
    if (!found) {
      try {
        found = await findComposition(this.fetcher, isin);
        if (found) error = null;
      } catch (e) {
        error = (e as Error).message;
      }
    }
    if (found) {
      await this.db.run(
        `INSERT INTO marche.compositions (isin, issuer, issuer_id, fund_name, replication, as_of, lines, line_count, checked_at, fetched_at, message, failed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, FALSE)
         ON CONFLICT (isin) DO UPDATE SET issuer = excluded.issuer, issuer_id = excluded.issuer_id, fund_name = excluded.fund_name, replication = excluded.replication,
           as_of = excluded.as_of, lines = excluded.lines, line_count = excluded.line_count, checked_at = excluded.checked_at, fetched_at = excluded.fetched_at, message = NULL, failed = FALSE`,
        [isin, found.issuer, found.issuerId, found.fundName, found.replication, found.asOf, JSON.stringify(found.lines), found.lines.length, at, at],
      );
      return;
    }
    if (!error && !row?.fetched_at) {
      // Aucun émetteur géré ne connaît cet ISIN.
      await this.db.run(
        `INSERT INTO marche.compositions (isin, checked_at, message, failed) VALUES (?, ?, ?, FALSE)
         ON CONFLICT (isin) DO UPDATE SET issuer = NULL, issuer_id = NULL, checked_at = excluded.checked_at, message = excluded.message, failed = FALSE`,
        [isin, at, "Ni Amundi ni iShares ne publient la composition de cet ETF."],
      );
      return;
    }
    // Échec, ou ETF que l'émetteur ne publie plus : la dernière composition connue est gardée.
    const message = error ?? "L'émetteur ne publie plus la composition de cet ETF.";
    await this.db.run(
      `INSERT INTO marche.compositions (isin, checked_at, message, failed) VALUES (?, ?, ?, TRUE)
       ON CONFLICT (isin) DO UPDATE SET checked_at = excluded.checked_at, message = excluded.message, failed = TRUE`,
      [isin, at, message],
    );
  }

  // ——— Liens vers un ETF physique équivalent ———

  async links(isins: readonly string[]): Promise<Map<string, CompositionLink>> {
    const unique = [...new Set(isins)];
    if (!unique.length) return new Map();
    const rows = await this.db.all<{ isin: string; proxy_isin: string; created_at: string }>(`SELECT isin, proxy_isin, created_at FROM marche.composition_links WHERE isin IN (${unique.map(() => "?").join(", ")})`, unique);
    return new Map(rows.map((r) => [r.isin, { isin: r.isin, proxyIsin: r.proxy_isin, createdAt: r.created_at }]));
  }

  async allLinks(): Promise<CompositionLink[]> {
    const rows = await this.db.all<{ isin: string; proxy_isin: string; created_at: string }>("SELECT isin, proxy_isin, created_at FROM marche.composition_links ORDER BY isin");
    return rows.map((r) => ({ isin: r.isin, proxyIsin: r.proxy_isin, createdAt: r.created_at }));
  }

  /** Lien commun : le premier vérifié est gardé ; l'administrateur peut le remplacer (`overwrite`). Renvoie vrai s'il a été écrit. */
  async setLink(isin: string, proxyIsin: string, overwrite = false): Promise<boolean> {
    const existing = (await this.links([isin])).get(isin);
    if (existing && !overwrite) return false;
    await this.db.run(
      `INSERT INTO marche.composition_links (isin, proxy_isin, created_at) VALUES (?, ?, ?) ON CONFLICT (isin) DO UPDATE SET proxy_isin = excluded.proxy_isin, created_at = excluded.created_at`,
      [isin, proxyIsin, new Date(this.now()).toISOString()],
    );
    return true;
  }

  async deleteLink(isin: string): Promise<void> {
    await this.db.run("DELETE FROM marche.composition_links WHERE isin = ?", [isin]);
  }

  /** Compositions dont le dernier téléchargement a échoué : à montrer à l'administrateur. */
  async failures(): Promise<CompositionInfo[]> {
    const rows = await this.db.all<Row>(`SELECT ${INFO_COLUMNS} FROM marche.compositions WHERE failed ORDER BY checked_at DESC`);
    return rows.map(toInfo);
  }

  /** Oublie les compositions que plus personne ne détient ni ne référence, une fois périmées. */
  async prune(keep: ReadonlySet<string>): Promise<void> {
    const limit = new Date(this.now() - COMPOSITION_MAX_AGE_MS).toISOString();
    const stale = await this.db.all<{ isin: string }>("SELECT isin FROM marche.compositions WHERE checked_at < ?", [limit]);
    const linked = new Set((await this.allLinks()).flatMap((l) => [l.isin, l.proxyIsin]));
    const drop = stale.map((r) => r.isin).filter((i) => !keep.has(i) && !linked.has(i));
    for (let i = 0; i < drop.length; i += 500) {
      const part = drop.slice(i, i + 500);
      await this.db.run(`DELETE FROM marche.compositions WHERE isin IN (${part.map(() => "?").join(", ")})`, part);
    }
  }
}
