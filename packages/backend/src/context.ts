import type { RawDb } from "./db/driver";
import type { Db } from "./db/postgres";
import type { Fetcher } from "./market";
import type { SharedMarket } from "./market/shared";

export interface BackendContext {
  db: Db;
  raw: RawDb;
  appVersion: string;
  schemaVersion: string;
  backupsDir: string | null;
  fetcher: Fetcher;
  market: SharedMarket;
  /** Administrateur de l'instance : seul à régler les sources de cours. */
  isAdmin: boolean;
  displayPath: string;
  /**
   * Version des données, augmentée après chaque écriture réussie. L'interface la compare à celle de l'espace
   * de travail chargé pour se recharger après une écriture faite ailleurs (assistant MCP, autre onglet).
   * `boot` change à chaque ouverture du backend : un compteur remis à zéro ne passe pas pour inchangé.
   */
  revision: { boot: string; n: number };
}
