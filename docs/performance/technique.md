# Performance : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/analysis/pages/Performance.tsx` | Sélecteurs (périmètre, période), six chiffres, assemblage des blocs. |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/CumulativeCard.tsx` | Rendement cumulé ou gain cumulé. |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/SourcesCard.tsx` | D'où vient le gain, par classe ou par nature (`GainBars`). |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/PeriodsCard.tsx` | Année par année, mois par mois, lignes dépliables sur leurs parts. |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/CalendarCard.tsx` | Calendrier des mois et statistiques. |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/RankingCard.tsx` | Classement des titres. |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/EnvelopeTable.tsx` | Tableau par enveloppe, trié et dépliable. |
| UI, blocs | `packages/ui/src/features/analysis/components/PerformanceBlocks/_controls.tsx` | Axes, info-bulles, `Segmented`, `UnitToggle`. |
| UI, comparateur | `packages/ui/src/features/analysis/components/PerformanceCompare.tsx` | Bloc Comparer : choix, chargement des historiques, graphique, « mêmes versements ». |
| UI, dialogue | `packages/ui/src/features/analysis/dialogs/ReferenceDialog.tsx` | Recherche d'un titre à comparer (`assets.search`). |
| UI, logique testable | `packages/ui/src/features/analysis/lib/performance.ts` | Périmètres (`scopeOptions`, `groupSections`, `breakdownParts`), `envelopesForScope`, `rankingView`, `heatShare`, `pctText`, clés et mémoire du comparateur (`localStorage`). |
| UI, calculs partagés | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio`, `useHistory`. |
| Core, analyse | `packages/core/src/analysis/performance.ts` | `monthlyReturns`, `chainRates`, `maxDrawdown`, `volatility`, `gainSources`, `scopePerformance`, `periodTables`, `envelopePerformance`, `assetPerformance`, `comparePerformance`, `sameFlowsOn`, `comparableAssetIds`. |
| Core, moteur | `packages/core/src/portfolio/engine.ts` | `PERF_GROUPS` (groupes et hypothèses), `contributionFlows`, `irrOf`, `accountIrr`. |
| Core, historique | `packages/core/src/portfolio/history.ts` | `buildHistory`, `HistoryPoint` (`byAccount`, `contribByAccount`, `byPosition`, `detailByAccount`, `positionResults`). |
| Core, rendement annualisé | `packages/core/src/base/xirr.ts` | `xirr`. |
| Core, impôts | `packages/core/src/tax/taxes.ts` | `withdrawalTaxes` (gain après impôts). |
| API | `packages/api/src/assets/procedures.ts` | `market.series`, `assets.search`, type `MarketSeries`. |
| Backend, handler | `packages/backend/src/handlers/assets.ts` | `market.series` → `ctx.market.series`. |
| Backend, marché | `packages/backend/src/market/shared.ts` | `SharedMarket.series` : historique long d'un titre, gardé dans `marche.series` et `marche.series_points`. |
| Backend, sources | `packages/backend/src/market/index.ts` | `fetchLongHistory`, par source. |

## Données

- **Procédures** : `workspace.load` ; `market.series` (entrée `{ kind, isin, symbol }`, sortie `{ dividends, points }`) pour un titre cherché ou un titre du portefeuille à cours automatique ; `assets.search` pour la recherche. Aucune écriture.
- **Champs du `Workspace` lus** : `params`, `accounts`, `assets`, `transactions`, `plans`, `skips`, `prices`, `crowdProjects`, `statements`, et ce que `withdrawalTaxes` et `cryptoTax` lisent pour le gain après impôts.
- **Tables** : celles du tenant derrière ces champs (`accounts`, `assets`, `transactions`, `contribution_plans`, `contribution_skips`, `prices`…). Côté instance : `marche.series` (clé `kind|ISIN|SYMBOLE`, `dividends`, `checked_at`) et `marche.series_points` (`date`, `price`).
- **Navigateur** : le choix du comparateur est dans `localStorage` sous `hamac.performance.comparaison` (`left`, `right`, `references`, huit au plus).

## Règles de calcul

**Périmètres.** `scopeOptions(state)` : « Tout le patrimoine financier » (`activeAccountIds` : comptes non archivés ou de valeur non nulle), un groupe par entrée de `PERF_GROUPS` qui a des comptes (rubrique « Enveloppes » si `isEnvelope`, sinon « Placements »), puis chaque compte. Période : `PERIODS` (3, 12, 36 mois ou tout) ; `windowStart` part du point situé `monthsBack` mois avant le dernier.

**Flux.** `accountFlows` = `contributionFlows(…, includeTransfers = true)` : apports et versements négatifs, retraits positifs, versements programmés payés négatifs ; un transfert compte seulement s'il traverse la frontière du périmètre.

**Rendement d'un mois** (`monthlyReturns`), méthode de Dietz modifiée, source citée dans le code : GIPS (CFA Institute), *Guidance Statement on Calculation Methodology*.

- `gain = valeur fin − valeur début − argent entré` ;
- `base = valeur début + Σ flux × (jours restants dans le mois / jours du mois)` ;
- `taux = gain / base`, ou `null` si `base < max(1, 0,1 × max(|début|, |fin|))` ou si `gain / base < −1`.

`chainRates` enchaîne `Π(1 + r) − 1`, un mois `null` comptant pour 0.

**Résumé** (`summarize`). Depuis le début : `gainPct = gain / argent versé`. Sur une période : `gainPct = rate` (rendement enchaîné). Rendement annualisé : `irrOf` sur les flux postérieurs au point de départ, la valeur de départ étant ajoutée comme flux négatif à cette date. La page remplace ce chiffre par la ligne `total` de `envelopePerformance` quand le périmètre est tout le patrimoine et la période « Tout », pour reprendre celui du tableau de bord (`includeTransfers = false`).

**Plus forte baisse** (`maxDrawdown`) : sur l'indice enchaîné des rendements mensuels ; `depth = indice / plus haut − 1` le plus négatif ; `recoveredMonth` = premier mois où l'indice retrouve ce plus haut.

**Volatilité** (`volatility`) : écart-type (n − 1) des rendements mensuels connus × √12, `null` sous 12 mois. Convention citée dans le code : AMF, « indicateur de risque ».

**D'où vient le gain** (`gainSources`) : différences, entre deux `HistoryPoint`, des cumuls de `detailByAccount`. `billedFees = fees − embeddedFees` ; `other = gain − (latentes + réalisées + dividendes + intérêts − billedFees − taxes)`, si bien que la somme des lignes redonne toujours le gain.

**Par classe** (`classBreakdown`) : un titre va dans `ASSET_BUCKET[kind]`, les espèces et le reste du résultat d'un compte (intérêts des espèces…) dans `cashBucketOf(compte)`, en général `liquidites`. Rendement d'un mois par la méthode de Dietz simple : `gain / (valeur début + argent entré / 2)`, l'argent entré dans la classe étant la variation de valeur moins le gain (même source GIPS). La ligne « Frais facturés à part et impôts » complète jusqu'au gain total.

**Année par année, mois par mois** (`periodsOf`, `periodTables`) : regroupement des `MonthReturn` par année ou par mois ; `rate` enchaîné, `income` = dividendes + intérêts, `fees` = tous les frais. Toujours sur tout l'historique du périmètre. Les parts dépliées (`breakdownParts`) sont calculées chacune avec ses propres flux, donc un transfert entre deux parts s'annule dans leur somme.

**Calendrier** (`calendarOf`, `statsOf`) : douze cases par année, total enchaîné ; meilleur et pire mois, mois positifs sur mois comptés. Intensité de couleur `heatShare` bornée à ±6 %.

**Classement** (`assetPerformance`) : titres présents dans `positionResults` du dernier point ; `gain = Δ(latente + réalisée + revenus)` sur la période. Taux : `monthlyReturns` sur les flux du titre (`assetFlows` : achats négatifs ; ventes, dividendes, intérêts, remboursements positifs ; l'arbitrage compte comme vente du titre cédé et achat du titre reçu). Pour un fonds euros (`euroFundFlows`), tout mouvement hors intérêts est un flux daté de la fin du mois : son taux est celui de ses intérêts. `rankingView` : cinq meilleurs, puis cinq moins bons parmi les autres.

**Tableau par enveloppe** (`envelopePerformance`). Sur « Tout » : les lignes reprennent `state.performance` (mêmes chiffres que le moteur) et `accountIrr` par compte ; `afterTax = gain − Σ withdrawalTaxes(...).tax` des comptes concernés. Sur une période : `scopePerformance` par groupe et par compte, sans gain après impôts. Hypothèses (`PERF_GROUPS`) : livrets `returns.livrets`, assurance-vie `returns.fondsEuros`, PEA `returns.actions`, compte-titres moyenne des hypothèses de ses positions pondérée par leur valeur (`returns.obligations` sans position), aucune pour PER, épargne salariale, crowdlending, crypto. Total : moyenne des hypothèses pondérée par la valeur des lignes qui en ont une. `envelopesForScope` filtre selon le périmètre ; le total n'apparaît que sur tout le patrimoine.

**Comparateur** (`comparePerformance`).

- Côté « séries » (titre cherché ou titre à cours automatique avec ISIN ou symbole) : points de `market.series` posés dans un `PriceBook` sous un identifiant fictif.
- Deux titres : `comparePrices`, cours rapportés à celui du premier jour commun (ou du début de la période), 300 points au plus.
- Sinon, mois par mois : rendements de chaque côté (`monthlyReturns` pour des comptes, variation du cours de fin de mois pour un titre), enchaînés sur les mois communs.
- Comptes face à un titre : `sameFlowsOn` achète des parts au cours connu à chaque flux, en vend aux retraits (jamais sous zéro), puis valorise au dernier cours.
- `comparableAssetIds` : titres non archivés, hors obligations, avec des cours sur au moins deux mois distincts ; l'UI ne garde que ceux passés par le journal (`ownedAssetIds`).
- Côté serveur, `SharedMarket.series` garde l'historique 12 h, réessaie un échec après 10 minutes, exclut Twelve Data pour préserver son quota, et garde la source qui remonte le plus loin (arrêt dès 60 mois couverts).

## Tests

- `packages/core/src/analysis/performance.test.ts` : Dietz modifiée, enchaînement, plus forte baisse, sources du gain (dont impôts à part), périodes, classes d'actifs, années et calendrier, détail par enveloppe, mois sans cours, classement (titres vendus compris), tableau par enveloppe, comparaisons (compte et titre, deux titres, titres non détenus, espacement des points), mêmes versements, hypothèse du compte-titres.
- `packages/core/src/analysis/concentration.test.ts`, bloc « volatilité » : annualisation et seuil de 12 mois.
- `packages/ui/src/features/analysis/lib/performance.test.ts` : tableau selon le filtre, détail année par année, rubriques du sélecteur, classement, intensité du calendrier, pourcentage signé.
- `packages/ui/src/features/analysis/performance.flow.test.tsx` : chaque bloc, filtres et comparateur ; comparaison de deux ETF cherchés sans rien ajouter au portefeuille.
- `packages/ui/src/flows/suivi.flow.test.tsx`, bloc « performance » : courbes en % et en €, enveloppes triées et dépliées, titres sans cours, plus forte baisse, volatilité, périmètre.
- `packages/backend/src/market/market.test.ts` : `market.series` côté serveur.

## Limites connues

- Les rendements mensuels ne voient que les fins de mois : `Workspace.prices` ne garde que le dernier cours de chaque mois. Pour deux titres du portefeuille sans historique serveur (`seriesRequest` renvoie `null`, par exemple cours manuel), `comparePrices` travaille sur ces points mensuels mais la comparaison est marquée `daily: true` et ses dates s'affichent comme des jours.
- Le périmètre « Tout le patrimoine financier » exclut les comptes archivés de valeur nulle (`activeAccountIds`), alors que la page Historique les garde.
- Une baisse et sa remontée dans le même mois n'apparaissent ni dans la plus forte baisse ni dans la volatilité.
- Dans `packages/backend/src/market/shared.ts`, le commentaire qui décrit `series` est placé au-dessus de la méthode `irl`.
