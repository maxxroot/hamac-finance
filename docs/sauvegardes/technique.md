# Sauvegardes : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| api | `packages/api/src/system/procedures.ts` | Type `DataDump`, procédures `data.export` et `data.import`. |
| backend | `packages/backend/src/backup/dump.ts` | Liste `TABLES`, `exportDump`, `importDump`. |
| backend | `packages/backend/src/backup/dumpUpgrade.ts` | Mise à niveau des anciennes sauvegardes : `upgradeLegacyDump`, `upgradeLegacyRentExceptions`, `upgradeLegacyEuroFunds`. |
| backend | `packages/backend/src/backup/backup.ts` | `backupBeforeMigration` : copie JSON compressée avant migration. |
| backend | `packages/backend/src/index.ts` | `createBackend` : copie avant migration, puis `migrate`. |
| backend | `packages/backend/src/db/migrate.ts` | `pendingMigrations`, `migrate`, table `_hamac_migrations`. |
| backend | `packages/backend/src/handlers/system.ts` | Handlers `data.export`, `data.import`, `system.info`. |
| backend | `packages/backend/src/market/config.ts` | `MARKET_SECRETS_KEY` (`market.secrets`), exclu des sauvegardes. |
| server | `apps/server/src/http/app.ts` | Dossier des copies par tenant (`<dataDir>/tenants/<tenantId>/sauvegardes`), limite de corps `MAX_RPC_BODY`. |
| server | `apps/server/src/main.ts` | `HAMAC_DATA_DIR` (défaut `./data` ; `/data` dans l'image Docker). |
| server | `apps/server/scripts/export-desktop.mjs` | Export d'une base SQLite de l'ancienne application de bureau en `DataDump` (`engine: "sqlite"`). |
| ui | `packages/ui/src/features/settings/pages/Parametres/AppTab.tsx` | `BackupCard` (export, choix du fichier, confirmation) et `AppInfo`. |

## Données

**Format `DataDump`** :

```ts
{
  format: "hamac";
  version: 1;
  engine?: "sqlite" | "postgres";  // absent ou "sqlite" : ancienne application de bureau
  schemaVersion: string;            // dernière migration appliquée (tag)
  exportedAt: string;               // ISO 8601
  appVersion: string;
  tables: Record<string, Array<Record<string, unknown>>>;  // lignes brutes, noms de colonnes SQL
}
```

**Procédures**

| Procédure | Entrée | Sortie |
|---|---|---|
| `data.export` | rien | `DataDump` |
| `data.import` | `{ dump: unknown, confirm: "REMPLACER" }` | `{ tables: Record<string, number> }` (lignes lues par table) |

Le littéral `confirm: "REMPLACER"` est exigé par le schéma zod : un appel sans lui est refusé en `VALIDATION` avant le handler.

**Liste `TABLES`** (`packages/backend/src/backup/dump.ts`), dans l'ordre d'insertion imposé par les clés étrangères :

`settings`, `institutions`, `tax_statement_amounts`, `assets`, `accounts`, `transactions`, `contribution_plans`, `contribution_skips`, `bond_plans`, `fund_rates`, `statements`, `prices`, `planned_expenses`, `companies`, `other_assets`, `other_asset_values`, `properties`, `lots`, `renters`, `leases`, `lease_renters`, `lease_guarantees`, `lease_rents`, `rent_payments`, `rent_waivers`, `rent_notices`, `property_expenses`, `property_values`, `property_incomes`, `property_documents`, `property_reminders`, `crowd_projects`, `loans`, `loan_prepayments`, `account_rates`, `gifts`, `goals`, `goal_allocations`.

`assets` passe avant `accounts` parce qu'un contrat renvoie à son fonds euros par défaut. À la date de rédaction, ces 38 tables sont exactement celles déclarées dans `packages/backend/src/db/schema/`. `_hamac_migrations` n'en fait pas partie.

**Hors sauvegarde** : schéma `comptes` (utilisateurs, sessions, invitations, double authentification), schéma `marche` (cours et compositions communs), réglage `market.secrets`.

**Copie avant migration** : `<dataDir>/tenants/<tenantId>/sauvegardes/hamac-avant-<tag>.json.gz`, où `<tag>` est la première migration en attente. Contenu : `exportDump` en JSON, compressé en gzip, fichier en mode `0600`. `schemaVersion` y vaut `"avant-migration"`.

## Règles

- **Toute nouvelle table doit entrer dans `TABLES`**, à sa place dans l'ordre des clés étrangères. Une table absente n'est ni exportée ni vidée ni restaurée : elle disparaît silencieusement des sauvegardes. Voir aussi `CLAUDE.md`, section « Changing things ».
- **Export** (`exportDump`) : `SELECT *` de chaque table de `TABLES` qui existe dans le schéma du tenant (`raw.columns(t)` non vide) ; puis retrait des lignes `settings` de clé `market.secrets`.
- **Import** (`importDump`), dans l'ordre :
  1. refus si `format` n'est pas `"hamac"`, si `version` n'est pas `1` ou si `tables` n'est pas un objet ;
  2. refus si `engine === "postgres"` et `schemaVersion` plus grand (comparaison de chaînes) que celui de la base : « mettez l'application à jour ». Les sauvegardes du bureau ne sont pas comparées, leur numérotation est à part ;
  3. mises à niveau en place de `tables` : `upgradeLegacyDump` (baux sans lot, migration 0022), `upgradeLegacyRentExceptions` (suivi strict des loyers, migration 0025), `upgradeLegacyEuroFunds` (fonds euros comme supports, migration 0028). Chacune refait la reprise de la migration correspondante ;
  4. une transaction : `DELETE` de chaque table dans l'ordre inverse de `TABLES`, puis `INSERT` ligne par ligne dans l'ordre de `TABLES`. Seules les colonnes qui existent dans la table sont reprises ; une table absente du fichier reste vide. Un booléen noté `0`/`1` (bureau) est converti ;
  5. suppression de `market.secrets` dans la même transaction.
  Toute erreur annule la transaction et remonte en `RpcError("VALIDATION", "Import impossible : …")`.
- **Isolement** : l'import n'écrit que dans le schéma du tenant (rôle `hamac_t_<hex>`). Les cours restaurés vont dans `prices` du tenant ; `mergePrices` les classe après les cours communs. La base commune n'est jamais modifiée par une restauration.
- **Copie avant migration** (`createBackend`) : seulement si `backupsDir` n'est pas `null` et si `pendingMigrations` n'est pas vide (un tenant neuf, sans `_hamac_migrations`, n'a rien à copier). Si l'écriture échoue, le backend ne s'ouvre pas (« Sauvegarde impossible avant la mise à jour de la base »). Une copie existante pour le même tag n'est pas remplacée (`backupBeforeMigration` renvoie `null`).
- **Taille** : le corps d'un appel RPC est limité à 32 Mio (`MAX_RPC_BODY`), réponse 413 au-delà.
- **Interface** : `BackupCard` vérifie `format === "hamac"` avant d'ouvrir la confirmation, appelle `data.import` avec `confirm: "REMPLACER"`, puis invalide toutes les requêtes. Le récapitulatif n'affiche que `accounts`, `assets`, `transactions`, `contribution_plans` et `prices` (`TABLE_LABELS`).
- **`system.info`** renvoie `backupsDir` sous forme de phrase (« Copie sur le serveur avant chaque migration ») ou `null`, jamais le chemin du dossier.

## Tests

- `packages/backend/src/backend.test.ts`, bloc « sauvegarde et import » : export puis import dans une autre base, fichier étranger refusé sans rien toucher ; et « garde les montants du document fiscal … et les inclut dans la sauvegarde ».
- `packages/backend/src/db/postgres.test.ts` : « copie avant migration : écrite une fois, jamais remplacée », « migrations : tenant neuf sans rien à sauvegarder », « restaure une sauvegarde de l'ancien bureau (numéro de schéma à part, booléens 0 ou 1) ».
- `packages/backend/src/market/market.test.ts` : « une restauration ne modifie pas les cours des autres ».
- Allers-retours export/import et sauvegardes d'avant une migration, par domaine : `packages/backend/src/handlers/realestate/leases.test.ts`, `packages/backend/src/handlers/realestate/lots.test.ts`, `packages/backend/src/handlers/euroFunds.test.ts`, `packages/backend/src/handlers/loans.test.ts`.
- `packages/ui/src/flows/reglages.flow.test.tsx`, bloc « paramètres › application » : export, fichier étranger refusé, restauration confirmée, erreur du serveur affichée.

## Limites connues

- Aucun test ne vérifie automatiquement que `TABLES` couvre toutes les tables de `packages/backend/src/db/schema/` : la cohérence repose sur la relecture.
- La comparaison de `schemaVersion` est une comparaison de chaînes ; elle suppose des tags de migration à préfixe numérique de même largeur.
- Le fichier exporté n'est pas chiffré. Les copies avant migration restent sur le même disque que la base.
- Les copies avant migration ne sont jamais supprimées automatiquement.
- `exportDump` charge toutes les lignes en mémoire, et une sauvegarde de plus de 32 Mio ne peut pas être restaurée par l'interface.
- `export-desktop.mjs` ne lit qu'une partie des tables (celles de l'ancienne application de bureau) ; `importDump` vide les autres.
