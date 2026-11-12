# Plan de migration : réorganiser la structure du code

> Statut : **validé le 2026-11-12** (décisions au § 7), **en cours** sur la branche `structure` (avancement au § 8).
> Rédigé le 2026-11-12, sur la branche `gestion-locative` (commit `f317f63`).
> Démarrage : **après la fusion de `gestion-locative` dans `main`**, dans un **worktree dédié** (§ 4).
> Modèle : l'organisation d'Argonis-paysage (couches, puis domaines, frontières vérifiées par la CI, une doc par sujet), adaptée à un monorepo TypeScript.

## 1. Pourquoi

Les paquets eux-mêmes sont bien découpés (`core` ← `api` ← `backend` ← `apps/*`, et `ui` qui ne dépend que de `core` et `api`). C'est **à l'intérieur** de chaque paquet que le rangement ne suit plus :

| Paquet | État actuel | Problème |
|---|---|---|
| `packages/core/src` | **97 fichiers à plat** (53 modules et 44 tests) | Rien ne dit qu'un fichier relève de l'immobilier, de la fiscalité ou des placements. Le seul plan, c'est `index.ts` avec ses 52 `export *`. |
| `packages/api/src` | `contract.ts` (396 lignes), `entities.ts` (508 lignes) | Plus de 40 familles de procédures dans un seul fichier. |
| `packages/backend/src` | `handlers.ts` (**1 164 lignes**), `db/schema.ts` (722), `repo.ts` (520) | Ajouter une table ou une procédure oblige à modifier quatre gros fichiers communs, et les conflits de fusion se concentrent toujours sur les mêmes. |
| `packages/ui/src` | Classement **par nature** : `pages/` (35), `components/` (53), `dialogs/` (27), `lib/` (50), avec 9 tests de parcours à la racine | Une fonctionnalité (la gestion locative, par exemple) est éclatée entre quatre dossiers. Les composants partagés sont mélangés aux composants métier. |
| `apps/server/src` | 16 fichiers à plat | L'authentification (mot de passe, TOTP, double facteur), l'interface en ligne de commande et HTTP sont mélangés. |
| `docs/` | `architecture/modele-de-donnees.md`, `propositions/`, `captures/` | Aucune doc par sujet, aucune décision consignée. Tout passe par le `CLAUDE.md` racine. |
| Racine | `scripts/` non suivi, un export `.xlsx` réel (ignoré par git), `coverage/`, `.scannerwork/` | Ce qui fait partie du projet n'est pas séparé de ce qui traîne. |

L'analyse des imports de `core` montre aussi des **cycles** et des **dépendances à rebours**, qu'il faut traiter dans le même chantier :

- `leases` → `lots` → `leases`, et `leases` → `realestate` → `lots` → `leases` ;
- `taxes` ↔ `taxReport` ;
- `institutions` ↔ `protection` ;
- `engine` (le calcul du portefeuille, censé être générique) importe `leases`, `lots`, `rental`, `renters` et `rentNotices` : le moteur commun dépend du domaine immobilier ;
- `alerts` importe 17 modules : c'est un agrégateur, il doit être rangé au sommet.

## 2. Ce qu'on reprend d'Argonis, et ce qu'on laisse

**On reprend :**

1. **Le chemin dit la couche, puis le domaine.** Un fichier se range sous `<couche>/<domaine>/` ; on lit une fonctionnalité dans un seul dossier.
2. **Un sens unique des dépendances**, vérifié par un test exécuté en CI, et non par la seule relecture.
3. **Une façade par domaine** (`index.ts`) : les autres domaines importent la façade, jamais un fichier interne.
4. **Une responsabilité par fichier.** Repère indicatif : environ 150 lignes, sans plafond fixe. Quand un fichier grossit, on le transforme en dossier avec sa façade, et les sous-modules privés sont préfixés `_`.
5. **Une doc par sujet**, dans un dossier qui contient `guide.md` (pour l'utilisateur) et `technique.md` (pour le développeur ou l'agent), plus des ADR dans `docs/decisions/`.
6. **Un `CLAUDE.md` par paquet**, pour garder le `CLAUDE.md` racine court : il pointe vers eux.

**On laisse** (Argonis en a besoin, pas Hamac) : produits et options payantes, RLS et rôles PostgreSQL multiples, files de travaux, console d'exploitation, i18n, BMAD. Hamac n'a qu'un produit, et ses tenants sont déjà isolés par schéma.

## 3. Structure cible

### 3.1 Les domaines

Les mêmes noms servent dans tous les paquets, pour qu'on puisse suivre un domaine de `core` jusqu'à `ui` :

| Domaine | Contenu actuel (fichiers de `core`) |
|---|---|
| `base` | `money`, `dates`, `xirr`, `fees` : outils sans règle métier |
| `model` | `domain`, `params`, `validation`, `ownership`, `schedule`, `prices`, `allocations`, `institutions`, `protection`, `rates` |
| `loans` | Le prêt lui-même : `Loan`, `loanSchedule`, `loanState` (sortis de `realestate.ts`), plus le coût et le remboursement anticipé (`loanCost`, `comparePrepayment`, `maxPrepaymentFee`, sortis de `debt.ts`) |
| `investments` | `bonds`, `bondnames`, `crowdlending` : les placements cotés ou prêtés |
| `other-assets` | `otherAssets` : or, objets, véhicules, parts de société non cotée, argent prêté |
| `realestate` | `realestate`, `lots`, `leases`, `renters`, `rental`, `rentalPark`, `irl`, `energy`, `rentNotices` |
| `portfolio` | `engine`, `history`, `reconciliation`, `counters`, `securitiesGains` |
| `analysis` | Ce qui **regarde le passé et le présent** : `performance`, `timeline`, `concentration`, `exposure`, `debtOverview` (sorti de `debt.ts`) |
| `tax` | `fiscalRules`, `taxes`, `taxReport`, `accountTaxes`, `yearEnd` |
| `planning` | Ce qui **regarde l'avenir** : `projection`, `goals`, `contributions`, `allocationTargets`, `simulation`, `simulators` |
| `imports` | `csv`, `statementImport`, `bricksImport` |
| `alerts` | `alerts` (agrégateur, au sommet) |

Pourquoi ces choix pour les cas difficiles :

- **`performance` et `timeline` vont dans `analysis`, pas dans `planning`** : ils mesurent ce qui s'est passé (rendement, grandes étapes, comparaison de deux dates), alors que `planning` projette l'avenir. `timeline` importe `performance` : les deux restent ensemble. `concentration` (risque de concentration du jour) suit la même logique.
- **`otherAssets` a son propre domaine** : ce ne sont pas des placements de marché, et ces biens ont leurs propres règles (démembrement, taxe sur la vente des biens meubles).
- **`exposure` va dans `analysis`, `csv` dans `imports`, et `tax` passe sous `analysis` et `planning`** : c'est ce qu'a montré le premier rapport du test des frontières (étape 0). `exposure` lit l'état du portefeuille, `csv` lit les types du domaine (ce n'est donc pas un outil de `base`), et `performance` comme `simulation` lisent les règles fiscales.
- **Le prêt descend dans `loans`** : aujourd'hui, `otherAssets` (argent prêté) et `debt` importent `realestate` uniquement pour le type `Loan` et son échéancier. Une fois le prêt sorti, `realestate` et `other-assets` dépendent de `loans`, et plus l'inverse. La vue d'endettement (`debtOverview`), qui a besoin de l'état du portefeuille et des biens, monte dans `analysis`.

Noms de dossier : **anglais, en minuscules, avec un tiret entre les mots** (`other-assets/`), comme les fichiers et les identifiants actuels (`realestate.ts`, procédures `leases.*`). Les fichiers gardent leur nom en camelCase. Les commentaires, l'interface et la doc restent en français.

### 3.2 Couches et sens des dépendances

```
alerts
  ↑
analysis · planning · imports            (indépendants entre eux)
  ↑
tax                                      (lu par performance et par les simulations)
  ↑
portfolio                                (calcul du portefeuille : engine, history…)
  ↑
investments · other-assets · realestate  (domaines d'actifs)
  ↑
loans                                    (le prêt et son échéancier)
  ↑
model                                    (types du domaine, paramètres, validation)
  ↑
base                                     (outils purs)
```

État relevé par l'étape 0 (2026-11-12) : en dehors des trois cycles de fichiers, les seuls écarts restants viennent du prêt rangé dans `realestate.ts` (`crowdlending`, `otherAssets` et `debt` l'importent pour `loanState`) et de `debt`, qui lit l'état du portefeuille. L'étape 2 les supprime. Si une exception doit malgré tout rester, elle sera déclarée dans le test et justifiée par une ligne de commentaire.

Règles :

- un domaine n'importe que des couches **inférieures**, ou un domaine de **la même couche** quand c'est explicitement permis (liste courte, tenue dans le test des frontières) ;
- `base` n'importe rien ; `model` n'importe que `base` ;
- entre domaines, l'import passe **par la façade** (`../realestate`), jamais par `../realestate/leases` ;
- **aucun cycle**, ni entre domaines ni à l'intérieur d'un domaine.

Le point délicat est `portfolio/engine` : aujourd'hui il lit l'immobilier, ce qui le place **au-dessus** de `realestate`. Le schéma ci-dessus en tient compte. Le jour où le moteur devra rester générique, on pourra passer à des contributions par type d'actif, sur le modèle de `composition/` dans Argonis. Ce n'est pas l'objet de ce chantier.

### 3.3 `packages/core`

```
packages/core/src/
  index.ts                    façade publique : export * de chaque domaine (inchangée pour les appelants)
  base/       index.ts  money.ts  dates.ts  xirr.ts  csv.ts  fees.ts  (+ tests à côté)
  model/      index.ts  domain.ts  params.ts  validation.ts  …
  investments/
  realestate/
  loans/
  portfolio/  index.ts  engine/ (façade + sous-modules si besoin)  history.ts  …
  tax/
  planning/
  imports/
  alerts/
  architecture.test.ts        test des frontières (§ 5)
```

`@hamac/core` n'exporte que `"."`, et aucun paquet n'importe un chemin profond de `core`. Le déplacement est donc **invisible pour `api`, `backend` et `ui`**.

### 3.4 `packages/api`

```
packages/api/src/
  index.ts        façade : contrat, domaines, transport
  contract.ts     assemble `procedures` à partir des domaines ; types Procedures, ProcName, ProcInput, ProcOutput
  common.ts       briques de schémas (id, isoDate, money, text, ok, byId, entity…), internes au paquet
  transport.ts    enveloppe RPC et RpcError
  <domaine>/      index.ts  inputs.ts (schémas d'entrée)  procedures.ts (procédures et types de sortie du domaine)
                  system · accounts · journal · assets · exposure · investments · realestate · loans · other-assets · planning
```

`entities.ts` ne contenait que des schémas d'entrée : ils sont devenus les `inputs.ts` des domaines. `contract.ts` fusionne les objets de procédures par domaine. Le type `Procedures`, l'`RpcResult` et les noms de procédure (`leases.save`, par exemple) ne changent pas.

### 3.5 `packages/backend`

```
packages/backend/src/
  index.ts  context.ts  testkit.ts  demo.ts      dispatch, contexte d'un tenant, kit de test, jeu fictif
  db/         driver  migrate  postgres  units (centimes, identifiants, horodatage)  migrations.generated.ts
              schema/  index.ts  _columns.ts  <domaine>.ts       (drizzle.config.ts → "./src/db/schema/index.ts")
  market/     cours de l'instance : index (chaîne de sources)  shared  merge  plausible  config  http
              sources/       yahoo  euronext  coingecko  twelvedata  justetf  openfigi  custom  irl
              compositions/  composition  compositionStore  exposure
  repo/       données du tenant : index (façade)  params  loadWorkspace  mappers/<domaine>.ts
  prices/     refresh (actualisation des cours d'un tenant)
  backup/     backup  dump  dumpUpgrade        (TABLES reste dans dump.ts)
  handlers/   index.ts (assemble ; le type exige un handler par procédure)  _types.ts  _shared.ts
              <domaine>.ts, et realestate/ (properties, leases, rents)
```

Couches : `db` → `market` → `repo` → `prices`, `backup` → `handlers`. Entre handlers : `system` → `accounts` → `journal` → `assets`, les autres domaines sont indépendants. Les tests d'un domaine sont à côté de ses handlers.

### 3.6 `packages/ui`

Classement par couche, puis par fonctionnalité ; à l'intérieur d'une fonctionnalité, par nature (`pages/`, `components/`, `dialogs/`, `lib/`) :

```
packages/ui/src/
  main.tsx  styles.css   point d'entrée (cité par index.html) et styles
  app/          App.tsx (routes)  Placeholder  layout/ (Shell, AuthGate, RouteError)  components/ et lib/ de la coquille
  shared/       nav.ts (carte des pages, lue par la coquille et les réglages)
                components/ (ui, form, table, Amount, Chart, EvolutionChart, AccountEvolution, Stat, RowActions, PrintPage…)
                lib/ (transport, workspace, portfolio, evolution, numbers, sort, toast, theme, files, queries…)
  features/
    entry/          saisie partagée par les pages : TransactionDialog, NewAssetPanel, AccountDialog, AccountButtons,
                    AllocationChoice, Movements, CompositionNotice, Onboarding (premiers pas)
    accounts/       Comptes, Livrets, FondsEuros, cartes de protection et de concentration
    journal/        Journal, Versements, import de relevés
    analysis/       Performance, Exposition, Historique
    investments/    Actions, Obligations, Crypto, Crowdlending
    realestate/     Immobilier, Bien, GestionLocative, courriers imprimables (Quittance, AvisEcheance, Relance…)
    loans/          Credits
    other-assets/   AutresBiens
    planning/       Projection, Projets, Simulateurs
    tax/            Impots, Declaration, Compteurs
    settings/       Parametres (dont l'onglet Établissements), sécurité du compte, apparence
    help/           Notice
    dashboard/      TableauDeBord
  flows/        tests de parcours qui traversent plusieurs fonctionnalités
```

Chaque fonctionnalité a une façade `index.ts` qui n'exporte que ce que les autres utilisent ; à l'intérieur, les imports restent directs. Couches : `shared` → `entry` → pages métier (indépendantes entre elles) → `dashboard` → `app`. `shared/` n'importe jamais `features/`. Les tests de parcours propres à une fonctionnalité sont dans son dossier (`realestate/gestion-locative.flow.test.tsx`).

Au premier essai, `assets` → `journal` → `accounts` en couches successives faisait des cycles : la saisie d'un compte, d'un titre ou d'une opération sert dans tous les sens. D'où la couche `entry`.

Fichiers à découper au passage, sans changer leur comportement (étape 6) : `Parametres.tsx` (759 lignes, une section par fichier), `HistoryBlocks.tsx` (704), `Notice.tsx` (628), `Declaration.tsx` (596), `PerformanceBlocks.tsx` (479).

### 3.7 `apps/server`

```
apps/server/src/
  main.ts  env.ts
  http/   app.ts (Hono, CSP, routes)
  auth/   password.ts  totp.ts  twoFactor.ts  twoFactorKey.ts  users.ts
  cli/    cli.ts  commands.ts
  tenants/  BackendPool, si on le sort de app.ts
```

### 3.8 `docs/`

```
docs/
  README.md                      index
  architecture/                  général : organisation du code (ce plan, puis sa version finale), modele-de-donnees.md
  decisions/                     ADR numérotés (0001-web-uniquement-postgresql.md, 0002-calculs-dans-l-ui.md…)
  <sujet>/guide.md + technique.md
    prix/  compositions-etf/  fiscalite/  gestion-locative/  sauvegardes/  comptes-et-securite/  …
  propositions/                  chantiers non engagés (inchangé)
  captures/                      (inchangé)
  cahier-des-charges/            (privé, ignoré, inchangé)
```

Plus des `CLAUDE.md` par paquet (`packages/core/CLAUDE.md`, `packages/backend/CLAUDE.md`, `packages/ui/CLAUDE.md`). Ils reprennent les sections « Prix », « Compositions », « Tenants » et « Changer des choses » du `CLAUDE.md` racine. Ce dernier ne garde que les commandes, la carte des paquets et les conventions.

### 3.9 Racine

- `scripts/xlsx-vers-csv.mjs` : soit le suivre dans git (avec une ligne dans la doc), soit le déplacer dans `apps/server/scripts/` ou dans un dossier privé.
- L'export `.xlsx` réel à la racine contient des données personnelles. Il est ignoré, mais rien ne justifie qu'il reste dans l'arbre : le sortir du dépôt.
- `coverage/` et `.scannerwork/` sont déjà ignorés : rien à faire.

## 4. Étapes de migration

Principes :

- **une étape = un ou plusieurs commits, CI au vert, aucun changement de comportement** ;
- **un déplacement ne s'accompagne que de la correction des chemins d'import**, jamais d'un changement de logique. Les fichiers passent par `git mv`, et git reconnaît chaque renommage (vérifié à l'étape 1 : 98 renommages sur 98), ce qui garde `git log --follow` et `git blame` intacts. Chaque commit compile, ce qui préserve aussi `git bisect` ;
- partir de `main` **après la fusion de `gestion-locative`**, dans un **worktree dédié** (par exemple `git worktree add ../Invest-structure -b structure main`) : le dépôt principal reste disponible pendant le chantier, et aucune autre branche ne doit modifier le code en parallèle. Les déplacements de masse sur une branche vivante provoquent des conflits sur tous les fichiers ;
- chaque étape se vérifie par `pnpm typecheck && pnpm test`, plus `pnpm build` pour celles qui touchent `ui` ou `server`.

| # | Étape | Contenu | Vérification propre à l'étape |
|---|---|---|---|
| 0 | Préparer | Valider ce plan et trancher le § 7. Écrire `architecture.test.ts` en mode **rapport** : il liste les cycles et les imports interdits sans échouer. Ranger la racine (§ 3.9). | Le rapport sert d'état initial. |
| 1 | `core` : déplacer | Créer les dossiers de domaine, `git mv` des modules **et de leurs tests**, un `index.ts` par domaine, et la façade racine qui ré-exporte les domaines. | `@hamac/core` exporte exactement les mêmes noms : comparer la liste des exports avant et après. |
| 2 | `core` : casser les cycles | `leases`/`lots`/`realestate` (sortir les types communs dans `realestate/types.ts`), `taxes`/`taxReport`, `institutions`/`protection`. Sortir le prêt de `realestate.ts` vers `loans/`, et `debtOverview` vers `analysis/`. Les imports entre domaines passent par les façades. | Le test des frontières ne signale plus de cycle. Aucun test numérique ne change. |
| 3 | `api` | Découper `contract.ts` et `entities.ts` par domaine. | Liste des procédures identique (un test peut comparer `Object.keys(procedures)`). |
| 4 | `backend` | `handlers/`, `repo/`, `db/schema/`, `backup/`, `market/sources/` et `market/compositions/`, tests à côté. Mettre à jour `drizzle.config.ts`. | **`db:generate` ne doit produire aucune migration** : le schéma découpé doit être strictement identique. |
| 5 | `ui` | `app/`, `shared/`, `features/<domaine>/`, déplacement des tests de parcours. | `pnpm build`, puis un passage manuel sur chaque page du menu. |
| 6 | `ui` : gros fichiers | Découper `Parametres`, `HistoryBlocks`, `Notice`, `Declaration` et `PerformanceBlocks`. | Comme l'étape 5. |
| 7 | `server` | `http/`, `auth/`, `cli/`. Vérifier les points d'entrée de `tsup.config.ts`. | `pnpm build`, puis `docker compose up -d --build` et une connexion avec double facteur. |
| 8 | Docs | `docs/README.md`, `decisions/` (ADR rétroactifs des décisions déjà prises), **un dossier par sujet avec `guide.md` et `technique.md` pour chaque fonctionnalité existante** (rattrapage : chaque page du menu doit avoir son sujet), `CLAUDE.md` par paquet, allègement du `CLAUDE.md` racine. | Aucun lien mort vers `docs/` (un petit test ou script peut le vérifier). |
| 9 | Verrouiller | Faire échouer `architecture.test.ts` sur toute violation. Ajouter au `CLAUDE.md` la règle « où va un nouveau fichier ». | La CI échoue si on importe un fichier interne d'un autre domaine (à tester une fois volontairement). |

Les étapes 1–2, 3–4 et 5–6 forment des blocs cohérents. Chaque bloc peut faire l'objet d'une PR. L'ordre `core` → `api` → `backend` → `ui` suit le sens des dépendances : chaque paquet est réorganisé quand ceux dont il dépend sont déjà stables.

## 5. Garde-fou des frontières

Le projet n'a pas de linter, et c'est un choix. On propose donc un **test Vitest sans nouvelle dépendance** (`packages/core/src/architecture.test.ts`, et l'équivalent pour `ui`) qui :

1. parcourt les fichiers `.ts` et `.tsx`, et extrait les `import … from "./…"` relatifs ;
2. déduit le domaine de chaque fichier à partir de son chemin ;
3. échoue si :
   - un domaine importe une couche supérieure ;
   - un domaine importe un fichier interne d'un autre domaine au lieu de sa façade ;
   - il existe un cycle ;
   - `core` importe `node:` ou fait des entrées-sorties (règle déjà écrite dans `CLAUDE.md`, désormais vérifiée) ;
   - côté `ui`, `shared/` importe `features/`.

La table des couches tient en une dizaine de lignes dans le test. Comme dans Argonis, ajouter un domaine revient à créer un dossier au bon endroit, puis une ligne dans cette table.

**Retenu : ce test maison.** Il tient en une centaine de lignes, tourne déjà dans `pnpm test` (donc en CI), n'ajoute aucune dépendance et vérifie aussi des règles propres à Hamac (`core` sans `node:`). Écartés : `dependency-cruiser`, plus complet mais c'est une dépendance et un format de configuration de plus pour un dépôt de cette taille ; `eslint-plugin-boundaries`, qui imposerait d'introduire ESLint.

## 6. Risques

| Risque | Parade |
|---|---|
| Conflits avec les branches en cours | Migrer depuis `main` juste après une fusion, par blocs courts, sans autre chantier en parallèle. |
| Perte de l'historique git des fichiers | Commits de `git mv` seul, séparés des modifications. |
| Le schéma Drizzle découpé génère une migration parasite | Vérifier à l'étape 4 que `db:generate` ne produit rien. |
| `TABLES` (sauvegardes) désynchronisé | Ne pas le toucher, juste le déplacer dans `backup/`. Les tests de sauvegarde et de restauration existants (`lots.test.ts`, `loans.test.ts`, `db/postgres.test.ts`) le couvrent en partie ; ajouter un test qui vérifie que chaque table du schéma figure dans `TABLES`. |
| Changement de comportement caché pendant un découpage | Aucune logique ne change pendant la migration. Les tests numériques de `core` et les tests de parcours de `ui` servent de filet. |
| Le `CLAUDE.md` et la doc pointent vers d'anciens chemins | Étape 8, avec une vérification des liens. |

## 7. Décisions prises le 2026-11-12

1. **Langue** : le code est en anglais (dossiers, fichiers, identifiants) ; la doc, les commentaires et l'interface sont en français. Les dossiers de `docs/` portent des noms français (`docs/gestion-locative/`).
2. **Découpage des domaines** : celui du § 3.1. Le choix des cas difficiles m'a été laissé : `analysis` est un domaine à part, `other-assets` aussi, et le prêt descend dans `loans`. À revoir si le rapport de l'étape 0 fait apparaître d'autres dépendances gênantes.
3. **Moment et lieu** : après la fusion de `gestion-locative` dans `main`, dans un worktree dédié.
4. **Outil de frontières** : le test Vitest maison (§ 5).
5. **Documentation** : `guide.md` + `technique.md` sont **obligatoires pour chaque fonctionnalité** ; tout doit être documenté. La règle est inscrite dans le `CLAUDE.md` racine et s'applique dès maintenant, sans attendre la migration. L'étape 8 rattrape les fonctionnalités existantes.

## 8. Avancement

| Étape | État | Notes |
|---|---|---|
| 0 | Fait | Paquet `packages/architecture` ([doc technique](../frontieres-du-code/technique.md)). Le premier rapport a déplacé `exposure` vers `analysis` et `csv` vers `imports`, et placé `tax` sous `analysis` et `planning`. |
| 1 | Fait | 98 fichiers déplacés, tous reconnus comme renommages. Les 461 exports d'exécution de `@hamac/core` sont identiques avant et après. |
| 2 | Fait | Prêt sorti dans `loans/loan.ts` ; `debtOverview` et `MAX_EFFORT_RATE` dans `analysis/debt.ts` ; réglages de protection dans `model/institutionProtection.ts` ; `lots.ts` ne lit plus les baux (`leaseKindsFor` et `rentalModeFromLeases` dans `leases.ts`, état d'un lot dans `lotStatus.ts`) ; impôt crypto dans `tax/cryptoTax.ts`. Aucun cycle ni aucune exception. Le test de `core` est **bloquant** dès maintenant. |
| 3 | Fait | `contract.ts` et `entities.ts` découpés en dix domaines. Les exports de `@hamac/api`, la liste des procédures et l'empreinte de leurs schémas (JSON Schema) sont identiques avant et après ; seuls s'ajoutent les objets de procédures de chaque domaine (`realestateProcedures`…). Test des frontières de `api` bloquant. |
| 4 | Fait | `handlers.ts` (1 164 lignes) en dix domaines, typés chacun sur les procédures de son domaine (`DomainHandlers`) ; l'immobilier en trois fichiers. `repo.ts` en mappers par domaine, `params`, `loadWorkspace` ; conversions dans `db/units.ts`. `schema.ts` en un fichier de tables par domaine : `db:generate` ne produit aucune migration. Sources de cours dans `market/sources/`, compositions dans `market/compositions/`, actualisation dans `prices/`, sauvegardes dans `backup/`. Les cycles de fichiers ne comptent plus que les imports réels : deux cycles de types existants (`context` ↔ `market`, `index` ↔ `demo`) sont sans effet à l'exécution. Test des frontières du backend bloquant. |
| 5 | Fait | 180 fichiers déplacés (`app/`, `shared/`, `features/<domaine>/`, `flows/`), imports `@/` réécrits, `lib/dashboard.ts` renommé `shared/lib/evolution.ts` (son contenu : historiques des graphiques d'évolution). Façades générées à partir des imports réels. `Etablissements` rejoint `settings` (il n'est affiché que comme onglet des Paramètres). Test des frontières de l'interface bloquant. |
| 6 | Fait | Dossiers avec façade, mêmes imports pour les appelants : `Parametres/` (un fichier par onglet, `usePlanDraft`, `Section`), `HistoryBlocks/` et `PerformanceBlocks/` (un fichier par carte), `Declaration/` (page, vue complète, fiche d'un établissement), `Notice/` (une partie par fichier, sommaire, lexique). Restent au-dessus de 400 lignes, à voir dans un chantier à part car ce sont des calculs : `core/portfolio/engine.ts` (827), `core/analysis/performance.ts` (746), `core/analysis/exposure.ts`, `core/realestate/leases.ts`, `core/tax/taxReport.ts` ; côté interface, `TransactionDialog.tsx` (598), `Impots.tsx`, `Simulateurs.tsx`. |

