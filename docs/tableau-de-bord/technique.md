# Tableau de bord : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/dashboard/pages/TableauDeBord.tsx` | La page et ses cartes (chiffres clés, Évolution, Allocation, Mes comptes, Projection, Actifs et dettes, À regarder, Projets en cours). |
| UI, composant | `packages/ui/src/features/dashboard/components/Alerts.tsx` | `AlertList` : icône + libellé + couleur par niveau, ligne cliquable si l'alerte a un lien. |
| UI, façade | `packages/ui/src/features/dashboard/index.ts` | Seul point d'entrée du domaine `dashboard` pour `app/`. |
| UI, logique testable | `packages/ui/src/shared/lib/evolution.ts` | `PERIODS`, `historyForPeriod`, `gainSinceLastMonth`, `gainBand`, `alertsToReview`, `accountRows`, `allocationBars`. |
| UI, graphique | `packages/ui/src/shared/components/EvolutionChart.tsx` | `EvolutionChart` (valeur totale, montant investi, bande de gain) et `PeriodSelector`. |
| UI, calculs partagés | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio` (`computePortfolio`), `useHistory` (`buildHistory`), mémoïsés par objet `Workspace` et par jour. |
| UI, projection | `packages/ui/src/features/planning/lib/projection.ts` | `useProjection(null, enabled)` : `project` + `monteCarlo(input, 300)`, en cache par `PortfolioState`. |
| UI, accueil | `packages/ui/src/features/entry/components/Onboarding.tsx` | Affiché quand `ws.accounts` est vide. |
| UI, menu | `packages/ui/src/shared/nav.ts` | Entrée `/` « Tableau de bord ». |
| Core, moteur | `packages/core/src/portfolio/engine.ts` | `computePortfolio` : `totals`, `buckets`, `allocation`, `netWorth`, `accounts`, `performance` (`PERF_GROUPS`, `irrOf`, `contributionFlows`). |
| Core, historique | `packages/core/src/portfolio/history.ts` | `buildHistory` : un `HistoryPoint` par fin de mois (et aujourd'hui pour le mois en cours). |
| Core, rendement annualisé | `packages/core/src/base/xirr.ts` | `xirr` par bissection, base exact/365. |
| Core, alertes | `packages/core/src/alerts/alerts.ts` | `computeAlerts`, `leaseAlerts`, `energyAlerts`, `documentAlerts`. |
| Core, concentration | `packages/core/src/analysis/concentration.ts` | `concentrationReport` (alertes de concentration) et `MAX_EFFORT_RATE` (taux d'effort). |
| Core, paramètres | `packages/core/src/model/params.ts` | `isRetirementPlan`, `retirementYear`, `classTargets`, `etfTarget`. |
| Core, projection | `packages/core/src/planning/projection.ts` | `projectionInputFromState`, `project`, `monteCarlo`. |
| Core, projets | `packages/core/src/planning/goals.ts` | `goalProgress`. |
| Backend | `packages/backend/src/market/compositions/exposure.ts` | `compositionAdmin` : échecs de téléchargement des compositions, pour l'alerte de l'administrateur. |

## Données

- **Procédures** : `workspace.load` (`packages/api/src/system/procedures.ts`) pour tout le reste ; `exposure.admin` (`packages/api/src/exposure/procedures.ts`), appelée par la page pour compter les compositions d'ETF en échec. Pour un compte qui n'administre pas l'instance, la réponse est vide (`failures: []`).
- **Champs du `Workspace` lus** (via `EngineData`) : `params`, `accounts`, `assets`, `transactions`, `plans`, `skips`, `prices`, `statements`, `institutions`, `properties`, `propertyValues`, `loans`, `otherAssets`, `otherAssetValues`, `crowdProjects`, `goals`, `priceStatus` (erreurs d'actualisation des cours), et pour les alertes des biens loués `leases`, `leaseRents`, `rentPayments`, `rentWaivers`, `rentNotices`, `lots`, `leaseGuarantees`, `propertyDocuments`.
- **Tables** correspondantes : `accounts`, `assets`, `transactions`, `contribution_plans`, `contribution_skips`, `prices`, `statements`, `institutions`, `properties`, `property_values`, `loans`, `other_assets`, `other_asset_values`, `crowd_projects`, `goals`, `settings` (clé `plan.parameters`), et les tables de la gestion locative. Côté instance : `marche.compositions` (échecs).
- La page n'écrit rien. Elle ne déclenche aucune mutation.

## Règles de calcul

**Choix des cartes.**

- `retraite = isRetirementPlan(params)` (`profile.goal === "retraite"`). En gestion de patrimoine, `useProjection` est appelé avec `enabled = false` : rien n'est calculé.
- `hasRealEstate` est vrai si `netWorth.realEstate`, `netWorth.otherAssets` ou `netWorth.debts` est non nul, ou si `netWorth.financial !== totals.value` (compte joint, `account.share < 1`). Il choisit le libellé « Patrimoine net » et le détail Financier / Immobilier / Autres biens / Crédits ; sinon « Patrimoine financier » avec Précaution (`buckets.precaution`) et Investi (`totals.value − buckets.precaution`).
- Carte du milieu : `RetirementCard` si retraite et projection prête ; `NetWorthCard` si gestion de patrimoine et `hasRealEstate` ; rien sinon.
- `GoalsCard` seulement si `params.modules.projets`, sur les projets non archivés, six au plus.

**Chiffres clés** (tous en euros décimaux, `PortfolioState`) :

- `totals.value` = somme des `AccountState.value` des comptes non archivés ou de valeur non nulle ; `value = espèces + positions + projets de crowdlending`.
- `totals.netContrib` = somme des `netContrib` (apports initiaux + versements + versements programmés payés − retraits ± transferts, par compte).
- `totals.gain = totals.value − totals.netContrib` ; pourcentage affiché `gain / netContrib` (null si `netContrib ≤ 0`).
- `netWorth.financial` = somme de `value × account.share` ; `netWorth.net = financial + realEstate + otherAssets − debts` (part détenue, capital restant dû à charge).
- Rendement annualisé : ligne `total` de `state.performance`. `irrOf(contributionFlows(…, includeTransfers = false), totals.value, asOf)` ; convention des flux : apports négatifs, retraits et valeur finale positifs. `null` avec une raison si valeur ≤ 0 (« Valeur nulle »), aucun flux (« Aucun versement »), premier flux à moins de 365 jours (« Moins d'un an d'historique »), ou pas de solution (« Incalculable »).
- `totals.monthly` = somme des `currentMonthly` (calendrier `Schedule` au jour `asOf`).
- Gain depuis la fin du mois précédent : `gainSinceLastMonth(history)` = `gain` du dernier point − `gain` de l'avant-dernier.

**Évolution.** `EvolutionChart` sur `buildHistory(data, today)` : `value` et `netContrib` de chaque point ; la bande de gain est `min(value, netContrib)` + `|value − netContrib|`. `historyForPeriod` garde `months + 1` points (point de départ compris) ; période par défaut « 1A ». Message à la place du graphique sous deux points.

**Allocation.** `state.allocation.rows` : valeur de chaque classe incluse dans l'allocation (comptes joints à la part détenue, biens, autres biens à classe personnalisée), `share = value / invested`, cible `classTargets(params, age)`. `etfTarget` fait baisser la cible des actions de l'âge de sécurisation à l'âge de départ (plan de retraite seulement), la différence allant au fonds euros, sinon aux obligations. `action` vaut `alleger` si `share − target > params.livrets.driftAlert`, `renforcer` si `< −driftAlert` (0,05 par défaut). `allocationBars` place barre et repère sur une échelle commune (le maximum des parts et des cibles).

**Mes comptes.** `accountRows(accounts, 6)` : comptes de valeur > 0, triés par valeur ; au-delà de six lignes, les plus petits sont regroupés en « N autres comptes » (sans pourcentage).

**Projection** (`RetirementCard`). `base.atRetirement` (`total`, `real`, `invested`, `contributed`) ; `base.income.investedToday = invested / (1 + inflation)^années restantes` ; `monthlyToday = annuity(investedToday, taux réel mensuel, mois entre l'âge de départ et l'âge de fin)` ; `monthlyNominal` = `monthlyToday` revalorisé de l'inflation. Fourchette : `bands` (p10 et p90) de `monteCarlo(input, 300)`, rendement des actions tiré chaque année d'une loi log-normale de volatilité 0,16, graine fixe (42), les autres classes déterministes.

**À regarder.** `computeAlerts(data, state, { priceErrors, compositionFailures })` renvoie des `Alert` triées critique → attention → info → ok. `alertsToReview` retire les `ok`. La carte affiche les cinq premières (`MAX_ALERTS`) en mode `compact` (titre sans détail). Familles et seuils lus dans le code :

- `warnings` du moteur (critique, lien Journal) ;
- livrets : sous `params.livrets.floor`, au-dessus de `ceiling`, au-delà du plafond de dépôt ;
- allocation hors seuil ; allocations personnalisées (limite atteinte, versements à ajuster) ; gestion suggérée (`proposeContributions`) ;
- phase de constitution ou de sécurisation (plan de retraite seulement) ;
- espèces d'un compte-titres ≥ `alerts.ctoCashThreshold`, d'un PEA ≥ `alerts.peaCashThreshold` ; échéance d'obligation à moins d'un an ;
- cours manquants (`priceUsed === "cout"`), cours de plus de 7 jours, erreurs d'actualisation, compositions d'ETF en échec ;
- parts cibles des actions dont la somme ≠ 100 % ; clause bénéficiaire d'assurance-vie ; écart avec le dernier relevé (`reconcile`) ;
- liste de fin d'année (`yearEndSeason`, `yearEndChecklist`) ;
- concentration au-delà de `alerts.concentrationMax` ; taux d'effort au-delà de `MAX_EFFORT_RATE` (35 %) ;
- garantie en cas de faillite dépassée (`protectionOf`, plafond `alerts.fgapGuarantee`) ;
- date d'ouverture manquante, anniversaire fiscal (PEA 5 ans, assurance-vie 8 ans) à moins de six mois ;
- frais : tenue de compte, frais sur versements ≥ 1 %, ordres des six derniers mois avec plus de 1 % de frais ;
- crowdlending : échéance dépassée, projets en défaut ;
- biens loués (`leaseAlerts`), DPE (`energyAlerts`), documents qui expirent (`documentAlerts`) ;
- de janvier à mars, intérêts de l'année passée manquants sur un livret ou une assurance-vie.

## Tests

- `packages/ui/src/shared/lib/evolution.test.ts` : période, gain du mois hors versements, bande de gain, alertes à revoir, lignes de comptes, barres d'allocation.
- `packages/core/src/alerts/alerts.test.ts` : livrets, clause bénéficiaire, intérêts de janvier, ordre des niveaux, anniversaire fiscal, alerte des compositions d'ETF.
- `packages/core/src/analysis/concentration.test.ts` : seuils de concentration.
- `packages/core/src/portfolio/engine.test.ts` : rendement annualisé masqué avant un an, allocation et rééquilibrage, historique reconstruit cohérent avec le calcul du jour, patrimoine net (part détenue des biens, des crédits et des comptes joints).
- `packages/ui/src/flows/suivi.flow.test.tsx`, bloc « tableau de bord » : accueil sans compte, jeu de démonstration, graphique d'évolution, gestion de patrimoine, alertes repliées au-delà de cinq, projets en cours.

## Limites connues

- La carte Projection écrit « hors crypto » en dur. Or `projectionInputFromState` inclut la crypto et le crowdlending quand leur ligne de la répartition cible a un rendement attendu et est incluse dans l'allocation.
- `exposure.admin` est appelée à chaque affichage pour tous les comptes ; la réponse n'est remplie que pour l'administrateur.
- Le graphique d'évolution ne suit que le patrimoine financier (`HistoryPoint.value`), pas `netWorth`, même quand l'en-tête affiche le patrimoine net.
- Le texte de l'alerte d'allocation parle d'un écart « de plus de 5 % » alors que l'écart comparé est une différence de parts (des points de pourcentage).
- `Workspace.prices` ne garde que le dernier cours de chaque mois : l'historique est valorisé à ce cours.
