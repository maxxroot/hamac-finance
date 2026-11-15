# Projection : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/planning/pages/Projection.tsx` | Page `/projection` : message en gestion de patrimoine, résultats, graphique ECharts, carte « Et si… » (`Simulator`), « Dépenses imprévues » (`Expenses`), phase de retraits, tableau annuel mémorisé (`ProjectionTable`). |
| UI | `packages/ui/src/features/planning/lib/projection.ts` | `useProjection(scenario, enabled)` : projection du plan et fourchette (300 tirages) mises en cache par `PortfolioState` (`WeakMap`), scénario calculé en différé (`useDeferredValue`). |
| UI | `packages/ui/src/features/planning/index.ts` | Façade : exporte `useProjection` pour le tableau de bord. |
| UI | `packages/ui/src/features/dashboard/pages/TableauDeBord.tsx` | `RetirementCard` : mêmes chiffres, appel `useProjection(null, retraite)`. |
| UI | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio` : `EngineData` (le `Workspace` étalé) et `PortfolioState`, mémorisés par workspace et par jour. |
| UI | `packages/ui/src/shared/nav.ts` | Entrée de menu `/projection`, `retirementOnly: true`, sans `module` (non masquable par les modules). |
| UI | `packages/ui/src/app/App.tsx` | Route `/projection`. |
| Core | `packages/core/src/planning/projection.ts` | `project`, `projectionInputFromState`, `projectFromState`, `monteCarlo`, `annuity`, types `Flows`, `ProjectionInput`, `ProjectionRow`, `Projection`, `Band`. |
| Core | `packages/core/src/model/params.ts` | `PlanParams`, `retirementYear`, `ageInYear`, `etfTarget`, `isRetirementPlan`. |
| Core | `packages/core/src/model/schedule.ts` | `Schedule.inYear` : versements programmés d'un compte sur une année civile. |
| Core | `packages/core/src/model/institutions.ts` | `orderFee` : grille de courtage d'un établissement. |
| Core | `packages/core/src/model/domain.ts` | `isBankPer`, `BUCKET_LABELS`, type `PlannedExpense`. |
| Core | `packages/core/src/portfolio/engine.ts` | `PortfolioState.buckets` (point de départ), `totals.netContrib`, `accounts[].netContrib`. |
| API | `packages/api/src/planning/inputs.ts` | `PlannedExpenseInput`. |
| API | `packages/api/src/planning/procedures.ts` | `plannedExpenses.upsert`, `plannedExpenses.delete`. |
| Backend | `packages/backend/src/handlers/planning.ts` | Handlers des dépenses imprévues. |
| Backend | `packages/backend/src/db/schema/planning.ts` | Table `planned_expenses`. |
| Backend | `packages/backend/src/repo/mappers/planning.ts` | `mapExpense` (centimes → euros). |
| Backend | `packages/backend/src/repo/loadWorkspace.ts` | Chargement trié par année. |
| Backend | `packages/backend/src/backup/dump.ts` | `planned_expenses` dans `TABLES`. |

## Données

**Table** `planned_expenses` : `id`, `year`, `amount_cents`, `label`, `account_id` (clé étrangère vers `accounts`, `on delete set null`), horodatages.

**Procédures** (`packages/api/src/planning/procedures.ts`) :

| Procédure | Entrée | Sortie |
|---|---|---|
| `plannedExpenses.upsert` | `PlannedExpenseInput` : `id?`, `year` (entier 2000–2200), `amount` (> 0), `label` (1–120 caractères), `accountId` (nullable, défaut `null`) | `PlannedExpense` |
| `plannedExpenses.delete` | `{ id }` | `ok` |

Le formulaire de la page n'envoie jamais `accountId`.

**Champs du `Workspace` lus** : `params` (profil, `returns`, `allocation.etfAtRetirement`, `targets`, `customClasses`, `livrets.floor` et `ceiling`), `accounts` (type, `perKind`, `institutionId`), `institutions` (`offers`), `plans` et `skips` (calendrier des versements), `plannedExpenses`, plus tout ce qui sert à `computePortfolio` pour obtenir `PortfolioState`.

Aucune procédure ne calcule la projection : tout tourne dans le navigateur (voir `docs/decisions/0002-calculs-dans-l-interface.md`).

## Règles de calcul

Tout est dans `packages/core/src/planning/projection.ts`. Le commentaire d'en-tête situe le modèle : onglet « Projection » du sheet d'origine, avant impôts, avec quatre améliorations (calendrier complet des versements, plancher des livrets, phase de retraits, fourchette).

### Entrée (`projectionInputFromState`)

- `startYear` = année de `state.asOf`.
- `start` : `livrets = buckets.precaution`, `fondsEuros = buckets.garanti`, `obligations = buckets.obligations`, `actions = buckets.croissance`, plus les liquidités de chaque compte dans la ligne de `plannedBucketOf(compte)` (PEA → actions, assurance-vie → fonds euros, compte-titres → obligations…).
- `others` : lignes de `params.targets` avec `inAllocation && expectedReturn != null`.
  - Classe créée (`customClasses`) : valeur des positions de cette classe, retirée de sa ligne naturelle (`garanti`, `obligations` ou `croissance`) ; aucun versement.
  - `immobilier` : `buckets.immobilier`, aucun versement.
  - `crowdlending`, `speculatif` : `buckets.<clé>`, versements des comptes `crowdlending` ou `crypto` du calendrier.
- `startContributed` = `totals.netContrib` moins le versé net des comptes `crypto` et `crowdlending` dont la classe n'est pas projetée.
- `contributions(year)` : `Schedule.inYear(compte, année)` moins les frais sur versements, routé par type de compte : `livret` → livrets ; `assurance_vie` → fonds euros ; `per` → actions si `isBankPer`, sinon fonds euros ; `epargne_salariale`, `pea`, `pea_pme` → actions ; `cto` → obligations. Le scénario ajoute `12 × extraMonthly[classe]`.
- `contributionFees(year)` : assurance-vie `montant × offers.assurance_vie.entryFee` ; PEA et PEA-PME `12 × orderFee(offre pea, montant / 12) + custodyFixed` ; compte-titres `orderFee(offre cto, montant) + custodyFixed`. Rien pour les autres types.
- `feeDrag` : moyenne pondérée par la valeur actuelle des comptes de `offers.assurance_vie.euroFee` (fonds euros), `offers.pea.custodyRate` (actions, comptes PEA et PEA-PME seulement), `offers.cto.custodyRate` (obligations).
- `expenses(year)` : somme des `plannedExpenses` de l'année.
- Les fonctions de l'année sont mémorisées (`perYear`) : elles ne dépendent pas des rendements tirés.

### Boucle annuelle (`project`)

Ligne 0 = `startYear`, valeurs de départ, sans versement. Puis pour `year` de `startYear + 1` à `retirementYear(p) = birthYear + retirementAge` :

- `r = returnsFor(year) − feeDrag` par classe ; `age = year − birthYear` ; `active = age ≤ retirementAge` ; `secured = age ≥ securisationAge`.
- `livrets = prev × (1 + r) + c.livrets − dépense` ; excédent au-delà de `livrets.ceiling` vers le fonds euros.
- `fePre = prev.fondsEuros × (1 + r) + c.fondsEuros + (secured ? c.actions : 0) + excédent`.
- Plancher : si `livrets < floor`, on prend `min(manque, max(0, fePre))` au fonds euros ; `belowFloor` si l'écart reste supérieur à 0,50 €.
- `obligations = prev × (1 + r) + c.obligations`.
- `etfPre = prev.actions × (1 + r) + (secured ? 0 : c.actions)` ; si `secured`, `actions = min(etfPre, etfTarget(p, age) × (obligations + etfPre + fePre))`, sinon `actions = etfPre`. Le reste va au fonds euros.
- `etfTarget` (`params.ts`) : part de la ligne `croissance` avant l'âge de sécurisation, puis baisse linéaire jusqu'à `allocation.etfAtRetirement` à l'âge de départ ; constante en gestion de patrimoine.
- Autres classes : `valeur × (1 + rate) + versement` (si `active`).
- `real = total / (1 + inflation)^(year − startYear)`.
- `contributed` cumule les versements bruts (frais d'entrée compris) des années actives.
- `gains = total − contributed + Σ dépenses`.
- `fees` cumule les frais d'entrée et `Σ prev.classe × feeDrag.classe`.

### Revenu et retraits

- `atRetirement` = ligne de l'année de départ.
- `investedToday = atRetirement.invested / (1 + inflation)^(retYear − startYear)` : `invested` exclut les livrets.
- `monthlyToday = annuity(investedToday, (1 + realReturnRetirement)^(1/12) − 1, (horizonAge − retirementAge) × 12)` ; `annuity` est la formule PMT (`pv × r / (1 − (1 + r)^−n)`, `pv / n` à taux nul).
- `monthlyNominal = monthlyToday × (1 + inflation)^(retYear − startYear)`.
- `drawdown` : mois par mois, capital rémunéré à `((1 + réel)(1 + inflation))^(1/12) − 1`, retrait `monthlyNominal × (1 + inflation mensuelle)^(mois écoulés)`. Une ligne par année ; la page n'en affiche que la première et une toutes les cinq (`i % 5 === 4`).

### Fourchette (`monteCarlo`)

- Rendement actions annuel log-normal : `exp(μ + σ·Z) − 1`, avec `μ = ln(1 + returns.actions) − σ²/2` (espérance égale à l'hypothèse) et `σ = 0,16`.
- `Z` par Box-Muller sur un générateur reproductible (mulberry32, graine 42) : la fourchette est identique d'un calcul à l'autre.
- Un tirage par année et par passage ; les autres classes restent déterministes ; `drawdown: false`.
- Quantiles 10 %, 50 % et 90 % du total par année. L'interface appelle `monteCarlo(input, 300)` (défaut de la fonction : 400) et n'affiche pas la médiane.

### Scénario « Et si… »

`Simulator` construit un `PlanParams` modifié (`retirementAge`, `securisationAge = min(sécurisation, départ)`, `returns.actions`, `returns.inflation`) et `extraMonthly`. L'âge n'est appliqué qu'entre 50 et 75 ans. Le scénario est `null` si rien ne diffère du plan (comparaison `JSON.stringify`). Il est projeté sans fourchette. Les cartes affichent l'écart s'il dépasse 1 €.

Aucune règle fiscale n'intervient : la projection est avant impôts. Le code ne cite donc aucun texte.

## Tests

| Fichier | Ce qui est couvert |
|---|---|
| `packages/core/src/planning/projection.test.ts` | Valeurs de non-régression (mécanique du sheet, montants fictifs : 2027, 2061, 2062), revenu mensuel, épuisement du capital à l'âge horizon, plafond et plancher des livrets, formule PMT, fourchette ordonnée et reproductible, effet des frais, autres classes avec rendement attendu. |
| `packages/core/src/model/params.test.ts` | `etfTarget` (baisse linéaire de la part d'actions). |
| `packages/ui/src/flows/suivi.flow.test.tsx`, bloc `describe("projection")` | Accueil sans compte, message en gestion de patrimoine, résultats, fourchette, graphique et tableau avec le jeu de démonstration, scénario « Et si… » et « Revenir au plan », ajout et suppression d'une dépense imprévue. |
| `packages/ui/src/flows/suivi.flow.test.tsx`, bloc `describe("tableau de bord")` | Carte de projection du tableau de bord, absence en gestion de patrimoine. |
| `packages/ui/src/app/compte.flow.test.tsx` | Lien « Projection » présent ou retiré du menu selon le format. |

Aucun test backend ne vise `plannedExpenses.*` : la procédure n'est exercée que par le test de parcours ci-dessus.

## Limites connues

- Les versements restant à faire dans l'année en cours ne sont jamais comptés : la boucle commence à `startYear + 1`. Une dépense imprévue de l'année en cours ou d'une année passée est ignorée, comme une dépense après l'année du départ (la phase de retraits n'en tient pas compte).
- `PlannedExpense.accountId` existe en base et dans le contrat, mais ni le formulaire ni le calcul ne s'en servent : la dépense sort toujours des livrets.
- Routage des versements par type de compte : une assurance-vie en unités de compte compte comme du fonds euros, un compte-titres comme des obligations.
- `feeDrag.actions` n'est pondéré que sur les comptes PEA et PEA-PME, alors que la ligne actions contient aussi les PER bancaires, l'épargne salariale et les ETF d'autres comptes. Pas de frais pour PER et épargne salariale.
- Le texte « hors crypto » de l'en-tête (page et tableau de bord) est faux quand la ligne `speculatif` a un rendement attendu : la crypto entre alors dans « Autres classes ». Le crowdlending, exclu par défaut, n'est pas mentionné.
- `start` vient de `state.buckets`, qui additionne la valeur entière des comptes (`engine.ts`, boucle de valorisation) : la part détenue d'un compte joint (`account.share`) ne semble pas appliquée, alors que les projets l'appliquent. À vérifier.
- `buckets.immobilier` ne contient que ce qui est rangé dans la classe Immobilier au sein des comptes ; les biens de la page Immobilier ne semblent pas y être ajoutés. À vérifier.
- Rééquilibrage à sens unique : après la sécurisation, les actions ne sont jamais rachetées si elles passent sous la cible.
- Le plafond des livrets est celui du plan (`livrets.ceiling`), global, pas le plafond légal de chaque livret.
- La fourchette ne fait varier que les actions ; 300 tirages seulement, avec une graine fixe.
- La doc du modèle de données (`docs/architecture/modele-de-donnees.md`) décrit `planned_expenses` comme une « dépense prévue (voiture, travaux…) », alors que la page les appelle « dépenses imprévues » et renvoie les dépenses prévues vers « Projets ».
