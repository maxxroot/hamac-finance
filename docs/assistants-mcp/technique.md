# Assistants (MCP) : documentation technique

> Pour l'utilisateur : [guide](guide.md). Décision : [0009](../decisions/0009-serveur-mcp-et-jetons-d-acces.md). Chantier : [proposition](../propositions/assistants-mcp.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| server, auth | `apps/server/src/auth/apiTokens.ts` | `ApiTokenStore` : création (plafond dans la même requête que l'insertion), liste, révocation, `resolve` (compte, tenant et portée d'un jeton ; date de dernière utilisation au plus une fois par minute), purge. `TOKEN_SCOPES`, `TOKEN_DAYS`, `MAX_TOKENS_PER_USER`. |
| server, auth | `apps/server/src/auth/users.ts` | Crée `comptes.api_tokens` ; `UserStore.tokens` ; `closeSessions` et `confirmTwoFactor` révoquent aussi les jetons. |
| server, mcp | `apps/server/src/mcp/endpoint.ts` | `handleMcpRequest` : un `McpServer` et un `WebStandardStreamableHTTPServerTransport` par requête, sans état, réponse JSON, corps limité à 8 Mio. |
| server, mcp | `apps/server/src/mcp/server.ts` | `createMcpServer` : consignes, outils de lecture toujours, outils d'écriture pour la portée `write`. |
| server, mcp | `apps/server/src/mcp/instructions.ts` | Consignes envoyées au client à l'initialisation (vocabulaire, marche à suivre de l'import, refus des consignes contenues dans un document). |
| server, mcp | `apps/server/src/mcp/engine.ts` | `callThrough` (le contrat sur `Backend.dispatch`, erreurs en `ToolError` lisibles), `loadEngine` (même préparation que `packages/ui/src/shared/lib/portfolio.ts`), `parisToday`, `cents`. |
| server, mcp | `apps/server/src/mcp/drafts.ts` | `DraftStore` : aperçus (une heure) et importations annulables (24 heures), en mémoire, par tenant, 20 au plus par tenant. |
| server, mcp | `apps/server/src/mcp/confirmations.ts` | `ConfirmationStore` : écritures annoncées (suppressions, montants d'IFU), à usage unique, 15 minutes, par tenant, 50 au plus ; `take` ne rend une confirmation qu'à l'outil de la même nature. |
| server, mcp | `apps/server/src/mcp/prompts.ts` | Scénarios du protocole : `prepare_tax_return` (année facultative), `year_end_review` ; texte adapté à la portée du jeton. |
| server, mcp | `apps/server/src/mcp/testClient.ts` | Tests seulement : serveur MCP relié au client officiel en mémoire. |
| server, mcp | `apps/server/src/mcp/tools/registrar.ts` | Déclaration d'un outil : résultat en JSON compact, `ToolError` en erreur d'outil, autre erreur journalisée. |
| server, mcp | `apps/server/src/mcp/tools/fields.ts` | Champs communs (dates, mois, ISIN, taux), annotations `READ_ONLY` et `WRITE`, `merge` (modification partielle), `found`. |
| server, mcp | `apps/server/src/mcp/tools/summary.ts` | `get_summary`, `check_data`. |
| server, mcp | `apps/server/src/mcp/tools/institutions.ts` | `list_institutions` ; `save_institution`. |
| server, mcp | `apps/server/src/mcp/tools/accounts.ts` | `list_accounts`, `get_account` ; `save_account`, `set_account_rate`, `set_fund_rate`. |
| server, mcp | `apps/server/src/mcp/tools/assets.ts` | `list_assets` ; `save_asset`, `set_price`. |
| server, mcp | `apps/server/src/mcp/tools/journal.ts` | `list_transactions` ; `save_transaction`, `set_contribution_plan`, `save_contribution_skip`. |
| server, mcp | `apps/server/src/mcp/tools/statements.ts` | `compare_statement` ; `record_statement`. |
| server, mcp | `apps/server/src/mcp/tools/tax/_report.ts` | `get_tax_report` (`buildTaxReport`, `taxReportAlerts`, `compareWithStatement`, comme la page Aide à la déclaration) ; `taxReportFor`, `savedStatement`, `comparison` partagés avec l'IFU. |
| server, mcp | `apps/server/src/mcp/tools/tax/_estimate.ts` | `get_tax_estimate` (`accountTaxDetails`, `withdrawalTaxes`, `netYields`, `yearlyTaxes`, comme la page Impôts), `get_year_end_checklist` (`yearEndChecklist`, `dispenseOutlook`, cases cochées du réglage `taxes.yearEnd`), `get_tax_settings` (lecture seule). |
| server, mcp | `apps/server/src/mcp/tools/tax/_statement.ts` | `prepare_tax_statement`, `apply_tax_statement` (`taxStatements.save`). |
| server, mcp | `apps/server/src/mcp/tools/imports.ts` | `prepare_import`, `apply_import`, `undo_import`. |
| server, mcp | `apps/server/src/mcp/tools/deletions.ts` | `prepare_deletion`, `apply_deletion` et la table des objets supprimables (`KINDS`). |
| server, http | `apps/server/src/http/mcpRoutes.ts` | Routes `/api/auth/tokens` et `/api/mcp` : jeton Bearer, contrôle de l'origine, 120 requêtes par minute et par jeton. |
| server, http | `apps/server/src/http/app.ts` | `ServerConfig.mcp`, montage des routes avant le `404` de `/api/*`. |
| server | `apps/server/src/main.ts` | `HAMAC_MCP=0` → `mcp: false`. |
| core, import | `packages/core/src/imports/statementImport.ts` | `StatementLine.type` et `StatementLine.assetId` : type et titre imposés par l'appelant. |
| api, backend | `packages/api/src/journal/procedures.ts`, `packages/backend/src/handlers/journal.ts` | `transactions.bulkCreate` renvoie `ids`. |
| backend | `packages/backend/src/index.ts`, `packages/backend/src/context.ts` | `ctx.revision` augmenté après chaque procédure réussie, sauf celles de `KEEPS_REVISION` (lectures et réglages d'affichage). |
| api, backend | `packages/api/src/system/procedures.ts`, `packages/backend/src/handlers/system.ts` | `workspace.revision` ; `Workspace.revision` renvoyé par `workspace.load`. |
| ui, données | `packages/ui/src/shared/lib/workspaceSync.ts` | `useWorkspaceSync` (appelé par `Shell`) : relit la version quand l'onglet redevient visible et toutes les 20 secondes, recharge l'espace de travail si elle a changé. |
| ui, carte | `packages/ui/src/features/settings/components/AssistantsCard.tsx` | Création, affichage unique, liste et révocation des jetons. |
| ui, logique | `packages/ui/src/features/settings/lib/assistants.ts` | Libellés, `claudeCodeCommand`, `jsonConfig`, `lastUsedText`. |
| ui, client | `packages/ui/src/features/settings/lib/auth.ts` | `auth.tokens.list`, `create`, `revoke`. |

Couches de `apps/server` : `auth` 0, `mcp` 1, `cli` 1, `http` 2 (`packages/architecture/src/server.test.ts`). `mcp/` n'importe ni `@hamac/backend` en dehors des types, ni `db`, ni `repo` : tout passe par `dispatch`.

## Données

| Table | Colonnes |
|---|---|
| `comptes.api_tokens` | `id`, `user_id` (supprimé avec le compte), `name`, `token_hash` (SHA-256 base64url, unique), `scope` (`read` ou `write`), `created_at`, `expires_at`, `last_used_at` |

Jeton : `hamac_` puis 32 octets aléatoires en base64url (43 caractères). La table est dans le schéma `comptes`, hors de portée des rôles des tenants, et hors des sauvegardes d'un tenant (`dump.ts`). Les aperçus d'import ne sont pas stockés en base.

**Routes HTTP**

| Route | Méthode | Authentification | Rôle |
|---|---|---|---|
| `/api/auth/tokens` | GET | session | `{ enabled, tokens }` (jamais le jeton lui-même) |
| `/api/auth/tokens` | POST | session + `X-Hamac: 1` + mot de passe | `{ name, scope, days }` → `{ token, id, name, scope, createdAt, expiresAt, lastUsedAt }`. 400 (mot de passe, portée, durée, nom), 403 (coupé), 409 (plafond), 429. |
| `/api/auth/tokens/revoke` | POST | session + `X-Hamac: 1` | `{ id }` ; 404 si le jeton n'est pas à ce compte. |
| `/api/mcp` | POST | `Authorization: Bearer hamac_…` | JSON-RPC du protocole MCP (`initialize`, `tools/list`, `tools/call`). 401 + `WWW-Authenticate: Bearer`, 403 (origine), 404 (coupé), 405 (autre méthode), 429. |

## Règles

**Authentification.** Seul l'en-tête `Authorization` est lu sur `/api/mcp` ; un cookie de session n'ouvre rien. Un navigateur envoie toujours `Origin` : s'il annonce un autre hôte que celui de la requête, refus. La règle HTTPS de `/api/*` s'applique (hors machine locale et sauf `HAMAC_ALLOW_HTTP`). `resolve` ne lit qu'un jeton non expiré ; l'utilisateur et son tenant viennent de la jointure avec `comptes.users`, jamais de la requête.

**Révocation.** `closeSessions` (changement de mot de passe, `2fa-reset` de la ligne de commande) et `confirmTwoFactor` suppriment aussi les jetons du compte : quelqu'un qui aurait connu le mot de passe ne garde aucun accès.

**Outils.** Un fichier par domaine dans `tools/`, chacun déclare ses lectures puis, pour un jeton `write`, ses écritures. Annotations du protocole : `readOnlyHint` sur les lectures, `prepare_import` et `prepare_deletion` (qui n'écrivent qu'en mémoire), `destructiveHint` sur `undo_import` et `apply_deletion`. Les arguments sont validés par le SDK avec les schémas zod de chaque outil, puis par `dispatch` avec ceux du contrat. Noms en anglais, descriptions en français.

**Saisie (`save_*`).** Sans `id`, l'outil crée l'objet (champs minimaux vérifiés avant l'appel) ; avec `id`, il relit l'objet dans `workspace.load` et `merge` n'y remplace que les champs donnés, car les procédures `*.upsert` remplacent tout l'objet (un champ absent reprendrait sa valeur par défaut). Les sous-objets de l'établissement (`tax`, `protection`) sont fusionnés de même ; une grille de `offers` donnée remplace celle du même type de compte. `save_asset` sans `id` renvoie le titre existant si l'ISIN est connu, et choisit la source de cours comme la fenêtre de l'interface ; pour une obligation d'État, `issuerCountry` (code ISO) donne le pays, sinon celui de l'ISIN, sinon FR. Les règles métier restent celles du backend (un seul PEA, obligation sans échéance, type changé sur un compte qui a des opérations…).

**Suppressions.** `prepare_deletion` décrit l'objet et ce qui part ou se détache avec lui (d'après les cascades du schéma), refuse s'il est encore utilisé (compte ou titre qui a des opérations, plateforme qui a des projets) et garde une confirmation. `apply_deletion` consomme la confirmation, relit l'espace de travail, refuse si l'objet s'est mis à servir entre-temps, puis appelle la procédure `*.delete`. Objets pris en charge : `institution`, `account`, `asset`, `transaction`, `statement`, `account_rate`, `contribution_plan`, `contribution_skip`. Ajouter un objet = une entrée dans `KINDS`.

**Fiscalité.** Les outils reprennent les calculs des pages Impôts et Aide à la déclaration sur `loadEngine` (avec `cryptoTax` à la date du jour), sans règle propre. `get_tax_report` vaut par défaut pour l'an dernier ; avec `institutionId`, il détaille la fiche et la compare aux montants d'IFU déjà saisis. L'IFU suit la règle des documents : `prepare_tax_statement` compare case par case (cases mises en majuscules, doublons refusés, cases que Hamac ne calcule pas gardées sans comparaison), annonce les montants remplacés et garde une confirmation dont la charge utile est ce qui sera écrit ; `apply_tax_statement` l'écrit telle quelle. Les paramètres fiscaux sont en lecture seule (décision du 15 novembre 2026).

**Scénarios.** `registerPrompts` déclare des « prompts » du protocole : un texte de marche à suivre qui nomme les outils, sans logique. Leurs arguments sont des chaînes (règle du protocole).

**Rafraîchissement de l'interface.** L'interface ne recharge l'espace de travail qu'après ses propres écritures (`useMutate`). Pour voir celles de l'assistant, `Backend` tient une version des données (`ctx.revision` : un identifiant tiré à l'ouverture du backend et un compteur), augmentée après chaque procédure réussie hors `KEEPS_REVISION`. `workspace.load` la renvoie ; `useWorkspaceSync` relit `workspace.revision` (appel léger) et invalide l'espace de travail si elle diffère, sauf pendant un chargement ou une écriture de l'onglet. Oublier une lecture dans `KEEPS_REVISION` ne coûte qu'un rechargement de trop.

**Import.** `prepare_import` construit des `StatementLine` (depuis `lines`, ou depuis `file` avec `detectFormat`, `parseOfx`, `parseQif`, `parseCsv` + `findHeaderRow` + `guessRoles` + `linesFromCsv`, comme `StatementImportDialog`), appelle `buildImport` avec le calendrier des versements programmés et garde les statuts. `unknownAssets` donne pour chaque titre inconnu son ISIN, son nom et le type lu dans le fichier (`kind`, null s'il n'en dit rien). `apply_import` recalcule `buildImport` sur le journal actuel et refuse si un statut a changé ; il envoie les lignes `ok` (moins `exclude`) et les lignes `doublon` ou `programme` de `include` à `transactions.bulkCreate`, puis garde les `ids` pour `undo_import`. Une ligne `erreur` ne peut jamais être reprise.

**Type et titre imposés.** Dans `buildImport`, une ligne avec `type` n'est ni devinée ni corrigée d'après le signe ni remplacée si le compte ne l'accepte pas : `validateTransaction` la refuse alors. Une ligne avec `assetId` utilise ce titre ; un identifiant inconnu donne l'erreur « Titre introuvable. ».

**Date du jour.** `parisToday` (fuseau Europe/Paris) : le conteneur tourne en UTC.

**Calculs.** `loadEngine` applique `normalizeParams` et `withCompanyShares` comme l'interface, puis `computePortfolio` ; `check_data` et `get_summary` appellent `computeAlerts` avec les erreurs de cours de `priceStatus`.

## Tests

- `apps/server/src/mcp/mcp.test.ts` : outils par portée, lecture (synthèse, comptes, positions, filtres, erreurs lisibles, arguments invalides), import (aperçu sans écriture, doublon, titre inconnu, application unique, `include` et `exclude`, journal modifié entre-temps, isolement par tenant, annulation, CSV lu par Hamac, colonnes fausses), création de titre, relevé de situation, expiration des aperçus. Client MCP officiel sur `InMemoryTransport`, backend PGlite.
- `apps/server/src/mcp/manage.test.ts` : établissement et compte rattaché, modifications partielles (fiche, fiscalité, réglages), refus lisibles, taux de livret et de fonds euros, titre (ISIN connu, archivage, SCPI et cours saisi, obligation incomplète), opération saisie puis corrigée, versements programmés, suppression en deux temps (usage unique, compte utilisé, établissement qui détache ses comptes, objet devenu utilisé, autre tenant, expiration).
- `apps/server/src/mcp/tax.test.ts` : récapitulatif (cases, fiche, cessions, comparaison), établissement sans fiche, estimation, fin d'année, paramètres, IFU en deux temps (comparaison, case non calculée, confirmation refusée par un autre outil, usage unique, écart signalé ensuite, remplacement annoncé, case en double), outils par portée, scénarios.
- `packages/backend/src/backend.test.ts` : version des données (écriture, lecture, réglage d'affichage, écriture refusée).
- `packages/ui/src/shared/lib/workspaceSync.test.ts` : quand recharger.
- `apps/server/src/http/mcpRoutes.test.ts` : création (mot de passe, portée), jeton jamais relu, CSRF, 401 sans jeton ou avec un cookie seul, outils selon la portée, données du seul compte du jeton, client HTTP officiel du SDK de bout en bout, origine, méthode, révocation, changement de mot de passe, jeton d'un autre compte, `HAMAC_MCP=0`.
- `packages/core/src/imports/statementImport.test.ts` : type et titre imposés.
- `packages/ui/src/features/settings/lib/assistants.test.ts` : commandes de branchement, dernière utilisation.

## Limites connues

- Aperçus et annulations en mémoire du processus : perdus au redémarrage, et propres à une seule instance du serveur (Hamac n'en lance qu'une).
- Pas d'OAuth : les connecteurs distants de claude.ai ne peuvent pas se brancher (section 4 de la proposition).
- `bulkCreate` n'enregistre pas `counterAssetId`, `counterQuantity` ni `accrued` : un arbitrage ou un achat d'obligation avec coupon couru se saisissent dans l'interface.
- Les confirmations de suppression sont en mémoire, comme les aperçus. Une suppression ne s'annule pas : seule une sauvegarde permet de revenir en arrière.
- La version des données est en mémoire du backend du tenant : une écriture faite par un autre processus serveur ne serait pas vue (Hamac n'en lance qu'un). L'actualisation des cours en tâche de fond ne la change pas.
- Pas encore d'outils pour l'immobilier, la gestion locative, les crédits, les autres biens, les obligations suivies par plan, le crowdlending, les objectifs, ni pour la fiscalité locative (tranches C et D de la section 3 de la proposition). Les paramètres fiscaux et du plan ne se modifient pas depuis l'assistant.
- Le plafond de 120 requêtes par minute est en mémoire, par jeton.
