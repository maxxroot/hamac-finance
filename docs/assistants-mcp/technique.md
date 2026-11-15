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
| server, mcp | `apps/server/src/mcp/tools/registrar.ts` | Déclaration d'un outil : résultat en JSON compact, `ToolError` en erreur d'outil, autre erreur journalisée. |
| server, mcp | `apps/server/src/mcp/tools/read.ts` | `get_summary`, `list_accounts`, `get_account`, `list_assets`, `list_transactions`, `check_data`. |
| server, mcp | `apps/server/src/mcp/tools/imports.ts` | `prepare_import`, `apply_import`, `undo_import`. |
| server, mcp | `apps/server/src/mcp/tools/entries.ts` | `compare_statement` (lecture), `record_statement`, `create_asset`. |
| server, http | `apps/server/src/http/mcpRoutes.ts` | Routes `/api/auth/tokens` et `/api/mcp` : jeton Bearer, contrôle de l'origine, 120 requêtes par minute et par jeton. |
| server, http | `apps/server/src/http/app.ts` | `ServerConfig.mcp`, montage des routes avant le `404` de `/api/*`. |
| server | `apps/server/src/main.ts` | `HAMAC_MCP=0` → `mcp: false`. |
| core, import | `packages/core/src/imports/statementImport.ts` | `StatementLine.type` et `StatementLine.assetId` : type et titre imposés par l'appelant. |
| api, backend | `packages/api/src/journal/procedures.ts`, `packages/backend/src/handlers/journal.ts` | `transactions.bulkCreate` renvoie `ids`. |
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

**Outils.** Annotations du protocole : `readOnlyHint` sur les outils de lecture et sur `prepare_import` (qui n'écrit qu'en mémoire), `destructiveHint` sur `undo_import`. Les arguments sont validés par le SDK avec les schémas zod de chaque outil, puis par `dispatch` avec ceux du contrat.

**Import.** `prepare_import` construit des `StatementLine` (depuis `lines`, ou depuis `file` avec `detectFormat`, `parseOfx`, `parseQif`, `parseCsv` + `findHeaderRow` + `guessRoles` + `linesFromCsv`, comme `StatementImportDialog`), appelle `buildImport` avec le calendrier des versements programmés et garde les statuts. `apply_import` recalcule `buildImport` sur le journal actuel et refuse si un statut a changé ; il envoie les lignes `ok` (moins `exclude`) et les lignes `doublon` ou `programme` de `include` à `transactions.bulkCreate`, puis garde les `ids` pour `undo_import`. Une ligne `erreur` ne peut jamais être reprise.

**Type et titre imposés.** Dans `buildImport`, une ligne avec `type` n'est ni devinée ni corrigée d'après le signe ni remplacée si le compte ne l'accepte pas : `validateTransaction` la refuse alors. Une ligne avec `assetId` utilise ce titre ; un identifiant inconnu donne l'erreur « Titre introuvable. ».

**Date du jour.** `parisToday` (fuseau Europe/Paris) : le conteneur tourne en UTC.

**Calculs.** `loadEngine` applique `normalizeParams` et `withCompanyShares` comme l'interface, puis `computePortfolio` ; `check_data` et `get_summary` appellent `computeAlerts` avec les erreurs de cours de `priceStatus`.

## Tests

- `apps/server/src/mcp/mcp.test.ts` : outils par portée, lecture (synthèse, comptes, positions, filtres, erreurs lisibles, arguments invalides), import (aperçu sans écriture, doublon, titre inconnu, application unique, `include` et `exclude`, journal modifié entre-temps, isolement par tenant, annulation, CSV lu par Hamac, colonnes fausses), création de titre, relevé de situation, expiration des aperçus. Client MCP officiel sur `InMemoryTransport`, backend PGlite.
- `apps/server/src/http/mcpRoutes.test.ts` : création (mot de passe, portée), jeton jamais relu, CSRF, 401 sans jeton ou avec un cookie seul, outils selon la portée, données du seul compte du jeton, client HTTP officiel du SDK de bout en bout, origine, méthode, révocation, changement de mot de passe, jeton d'un autre compte, `HAMAC_MCP=0`.
- `packages/core/src/imports/statementImport.test.ts` : type et titre imposés.
- `packages/ui/src/features/settings/lib/assistants.test.ts` : commandes de branchement, dernière utilisation.

## Limites connues

- Aperçus et annulations en mémoire du processus : perdus au redémarrage, et propres à une seule instance du serveur (Hamac n'en lance qu'une).
- Pas d'OAuth : les connecteurs distants de claude.ai ne peuvent pas se brancher (tranche 5 de la proposition).
- `bulkCreate` n'enregistre pas `counterAssetId`, `counterQuantity` ni `accrued` : un arbitrage ou un achat d'obligation avec coupon couru se saisissent dans l'interface.
- `create_asset` ne crée ni obligation ni fonds euros, qui demandent leurs caractéristiques.
- Le plafond de 120 requêtes par minute est en mémoire, par jeton.
