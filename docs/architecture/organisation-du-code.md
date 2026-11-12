# Organisation du code

> Référence de la structure, à lire avant de créer un fichier ou un dossier. Le chantier qui l'a mise en place : [plan de réorganisation](plan-migration-structure.md). Le contrôle qui la fait respecter : [frontières du code](../frontieres-du-code/technique.md).

## Principe

Le chemin d'un fichier dit sa **couche**, puis son **domaine**. Une fonctionnalité se lit dans un seul dossier par paquet, et les dépendances vont dans un seul sens, vérifié à chaque `pnpm test`.

- Un domaine n'importe que des couches inférieures.
- Un domaine en importe un autre par sa façade (`index.ts`), jamais par un fichier interne. Cette règle ne vaut que dans `core`, `api` et l'interface : les dossiers du backend sont des briques techniques.
- Aucun cycle.
- Un fichier, une responsabilité. Environ 150 lignes est un repère, pas un plafond. Quand un fichier grossit, il devient un dossier du même nom avec un `index.ts` qui ré-exporte ce qui était public : les appelants ne changent pas. Les fichiers internes à ce dossier commencent par `_` (`_parts.tsx`, `_controls.tsx`).
- Noms de code en anglais (dossiers en minuscules, avec un tiret entre les mots : `other-assets/`) ; commentaires, interface et documentation en français.

Les mêmes noms de domaine reviennent d'un paquet à l'autre, pour suivre une fonctionnalité de `core` jusqu'à l'interface : `accounts`, `journal`, `assets`, `investments`, `realestate`, `loans`, `other-assets`, `planning`, `tax`…

## `packages/core` : calculs purs

Aucune entrée-sortie, aucun `import "node:…"` : ce code tourne dans le navigateur. Toute règle de calcul ou de fiscalité vit ici, avec des tests chiffrés et une source citée.

| Couche | Domaine | Contenu |
|---|---|---|
| 0 | `base/` | argent (arrondis), dates, TRI (`xirr`), frais |
| 1 | `model/` | types du domaine (`domain.ts`), paramètres du plan (`params.ts`), validation partagée avec le backend, établissements et protection, échéancier des versements, cours |
| 2 | `loans/` | le crédit : échéancier, capital restant dû, coût, remboursement anticipé |
| 3 | `investments/`, `other-assets/`, `realestate/` | obligations et crowdlending ; autres biens ; biens, lots, baux, locataires, loyers, IRL, DPE |
| 4 | `portfolio/` | calcul du portefeuille (`engine.ts` : `computePortfolio`), historique mensuel, rapprochement, compteurs, plus-values sur titres |
| 5 | `tax/` | règles fiscales par année (`fiscalRules.ts`), impôts, impôt sur les cryptomonnaies, récapitulatif fiscal, fin d'année |
| 6 | `analysis/`, `planning/`, `imports/` | performance, historique et étapes, exposition réelle, concentration, endettement ; projection, projets, versements suggérés, simulateurs ; lecture des relevés et imports |
| 7 | `alerts/` | les alertes du tableau de bord, qui lisent tout le reste |

`src/index.ts` ré-exporte chaque domaine : les autres paquets n'importent que `@hamac/core`.

## `packages/api` : le contrat

```
src/
  contract.ts    assemble `procedures` à partir des domaines ; types ProcName, ProcInput, ProcOutput
  common.ts      briques de schémas (id, isoDate, money, text, ok, byId, entity), internes au paquet
  transport.ts   enveloppe RpcResult, RpcError
  <domaine>/     inputs.ts (schémas d'entrée zod)  procedures.ts (procédures et types de sortie)  index.ts
```

Domaines : `system` (réglages, `workspace.load` et le type `Workspace`, export et import), `accounts`, `journal`, `assets` (titres, cours, sources), `exposure`, `investments`, `realestate`, `loans`, `other-assets`, `planning`. Seuls `journal` (qui lit `assets`) et `system` (qui lit `assets`) dépendent d'un autre domaine.

## `packages/backend` : stockage, cours, handlers

| Couche | Dossier | Contenu |
|---|---|---|
| 0 | `db/` | connexion et tenants (`postgres.ts`, `enterTenant`), migrations, conversions (`units.ts` : centimes, identifiants, horodatage), schéma (`schema/<domaine>.ts`) |
| 1 | `market/` | cours de l'instance : chaîne de sources (`index.ts`), `SharedMarket` (`shared.ts`), fusion (`merge.ts`), vraisemblance, réglages ; `sources/` (une source par fichier), `compositions/` (compositions d'ETF et exposition) |
| 2 | `repo/` | données du tenant : `mappers/<domaine>.ts` (ligne de la base → objet du domaine), `params.ts`, `loadWorkspace.ts` |
| 3 | `prices/`, `backup/` | actualisation des cours d'un tenant ; export, import et copie avant migration (`TABLES` dans `dump.ts`) |
| 4 | `handlers/` | un fichier par domaine du contrat (`realestate/` est un dossier : biens, baux, loyers) ; `index.ts` les assemble |

À la racine : `index.ts` (`Backend.dispatch`, file d'attente), `context.ts`, `testkit.ts`, `demo.ts` (jeu fictif).

Chaque fichier de handlers est typé `DomainHandlers<typeof <domaine>Procedures>` : une procédure du domaine sans handler est une erreur de compilation, signalée dans ce fichier. Entre domaines, un handler n'en appelle un autre que dans le sens `system` → `accounts` → `journal` → `assets`.

## `packages/ui` : l'interface

| Couche | Dossier | Contenu |
|---|---|---|
| 0 | `shared/` | kit visuel (`components/` : ui, form, table, Chart…), accès aux données (`lib/transport.ts`, `lib/workspace.ts`, `lib/portfolio.ts`), formats, thème, carte des pages (`nav.ts`). Aucune règle métier propre, n'importe jamais `features/`. |
| 1 | `features/entry/` | saisie partagée par les pages : opération, titre, compte, allocation, premiers pas |
| 2 | `features/<domaine>/` | une fonctionnalité par dossier, rangée en `pages/`, `components/`, `dialogs/`, `lib/` : `accounts`, `journal`, `analysis`, `investments`, `realestate`, `loans`, `other-assets`, `planning`, `tax`, `settings`, `help` |
| 3 | `features/dashboard/` | le tableau de bord, qui agrège les autres |
| 4 | `app/` | routes (`App.tsx`), coquille (`layout/`), ce qui ne sert qu'à elle |

Chaque fonctionnalité a une façade `index.ts` qui n'exporte que ce que les autres utilisent. `flows/` contient les tests de parcours qui traversent plusieurs fonctionnalités ; ceux d'une seule fonctionnalité sont dans son dossier. `main.tsx` (cité par `index.html`) et `styles.css` restent à la racine.

La logique testable de l'interface va dans des fichiers `.ts` de `lib/` : les tests tournent dans Node, sans rendu de composant hors des tests de parcours.

## `apps/server` : le serveur web

`auth/` (mots de passe, comptes, double authentification) → `http/` (Hono : `app.ts`) et `cli/` (commandes). À la racine : les points d'entrée cités par `tsup.config.ts` (`main.ts`, `cli.ts`) et `env.ts`.

## Où va un nouveau fichier

| Je veux… | Où |
|---|---|
| une règle de calcul, de fiscalité, de validation | `packages/core/src/<domaine>/`, avec son test et sa source |
| une nouvelle procédure | son entrée dans `packages/api/src/<domaine>/inputs.ts`, la procédure dans `procedures.ts` du même dossier, puis le handler dans `packages/backend/src/handlers/<domaine>.ts` (le compilateur le réclame). Côté interface : `call(...)` (`shared/lib/transport.ts`) ou `useMutate(...)` (`shared/lib/workspace.ts`). |
| une nouvelle table | `packages/backend/src/db/schema/<domaine>.ts`, puis `pnpm --filter @hamac/backend db:generate`. Il faut aussi : son mapper dans `repo/mappers/<domaine>.ts`, son chargement dans `repo/loadWorkspace.ts`, le type `Workspace` (`packages/api/src/system/procedures.ts`), `normalizeWorkspace` (`packages/ui/src/shared/lib/workspace.ts`) et la liste `TABLES` de `packages/backend/src/backup/dump.ts`, dans l'ordre des clés étrangères (une table absente de `TABLES` disparaît des sauvegardes). |
| une nouvelle source de cours | `packages/backend/src/market/sources/`, branchée dans la chaîne de `market/index.ts`, avec un test sur un faux `Fetcher` |
| une nouvelle page | `packages/ui/src/features/<domaine>/pages/`, exportée par la façade du domaine, routée dans `app/App.tsx`, déclarée dans `shared/nav.ts` |
| un composant utilisé par plusieurs fonctionnalités | `shared/components/` s'il ne porte aucune règle métier, sinon `features/entry/` |
| un nouveau domaine | un dossier au bon endroit, sa façade `index.ts`, et une ligne dans la table des couches du test de son paquet (`packages/architecture/src/<paquet>.test.ts`) |
| un réglage du plan | `packages/core/src/model/params.ts` : le schéma et `defaultParams` (`withDefaultParams` complète les anciennes données) |

Et dans tous les cas : la documentation du sujet, `docs/<sujet>/guide.md` et `technique.md`, dans le même changement que le code.
