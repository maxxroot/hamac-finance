# Historique : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/analysis/pages/Historique.tsx` | Période lue dans l'adresse (`du`, `au`), calculs mémoïsés, assemblage des cartes, lien vers le journal. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/RangeControls.tsx` | Listes « Du » et « Au », raccourcis. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/SummaryCard.tsx` | Résumé de la période. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/MonthsCard.tsx` | Mois par mois (ou année par année au-delà de 36 mois). |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/PlanCard.tsx` | Par rapport au plan. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/SituationCard.tsx` | La situation à deux dates. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/AllocationCompareCard.tsx` | Répartition par classe, début et fin. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/CascadeCard.tsx` | Ce qui s'est passé (cascade), périmètre, lien vers le journal. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/MilestoneList.tsx` | Grandes étapes, filtres par famille. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/AccountsCard.tsx` | Compte par compte. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/PositionsCard.tsx` | Titres achetés et vendus. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/MonthlyTable.tsx` | Tableau mois par mois de tout l'historique. |
| UI, blocs | `packages/ui/src/features/analysis/components/HistoryBlocks/_format.tsx` | Couleurs des familles d'étapes, formats d'euros. |
| UI, logique testable | `packages/ui/src/features/analysis/lib/historique.ts` | `parseRange`, `shortcutRange`, `activeShortcut`, `pointLabel`, `rangeLabel`, `inRange`, `rangeFromMilestone`, `byYear`, `waterfall`, `barSpan`, `periodSummary`, `durationLabel`, `monthStats`, `chartBars`, `planVerdict`. |
| UI, journal | `packages/ui/src/features/entry/lib/journal.ts` | `useJournal` : opérations, pour compter celles de la période. |
| UI, calculs partagés | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio`, `useHistory`. |
| Core, historique | `packages/core/src/portfolio/history.ts` | `buildHistory`, `HistoryPoint`, `endOfMonth`. |
| Core, analyse | `packages/core/src/analysis/timeline.ts` | `milestones`, `thresholds`, `periodChange`, `compareSnapshots`, `positionMove`, `monthByMonth`, `expectedRates`, `planComparison`. |
| Core, analyse | `packages/core/src/analysis/performance.ts` | `gainSources`, `monthlyReturns`, `maxDrawdown`, `accountFlows` (réutilisés). |
| Core, calendrier | `packages/core/src/model/schedule.ts` | `Schedule` : versements programmés prévus, payés, mois manqués. |

## Données

- **Procédure** : `workspace.load` uniquement. La page n'écrit rien.
- **Champs du `Workspace` lus** : `params` (calendrier, rendements attendus `returns` et `targets[].expectedReturn`), `accounts`, `assets`, `transactions`, `plans`, `skips`, `prices`, `crowdProjects`, `properties`, `propertyValues`, `loans`, `otherAssets`, `otherAssetValues`.
- **Tables** : `accounts`, `assets`, `transactions`, `contribution_plans`, `contribution_skips`, `prices`, `crowd_projects`, `properties`, `property_values`, `loans`, `other_assets`, `other_asset_values`, `settings`.
- **Adresse** : `#/historique?du=AAAA-MM|debut&au=AAAA-MM`. Lien vers le journal : `#/journal?du=AAAA-MM-01&au=AAAA-MM-JJ&filtre=<compte>`.

## Règles de calcul

**Historique.** `buildHistory(data, asOf)` appelle `computePortfolio` à chaque fin de mois, du plus ancien de `profile.startMonth` et de la première opération jusqu'au mois de `asOf` (point du mois en cours daté d'`asOf`). Chaque point garde la valeur et le versé net par compte, les positions (valeur et prix de revient), les cumuls de revenus, frais, impôts et plus-values, et les biens, autres biens et crédits à la part détenue.

**Période** (`parseRange`). `from` est un mois (fin de ce mois) ou `null` (tout début, valeur 0) ; `to` est un mois de l'historique. Par défaut : raccourci « 1a » depuis le dernier mois, ou tout l'historique s'il est plus court. « Depuis janvier » part de la fin de décembre précédent. Une étape cliquée donne `from = mois de l'étape − 1` (`rangeFromMilestone`).

**Ce qui s'est passé** (`periodChange(data, from, to, ids)`). Opérations datées `> from.date` et `≤ to.date` : apports et versements → `deposits`, retraits → `withdrawals`, transferts traversant le périmètre → `transfersIn` / `transfersOut`. Les versements programmés s'ajoutent à `deposits` (`paidTotal(to) − paidTotal(from)`). `sources = gainSources(from, to, ids)`. Invariant : `startValue + deposits − withdrawals + transfersIn − transfersOut + sources.total = endValue`. `waterfall` aligne les lignes non nulles (seuil 0,005 €) ; échelle resserrée (`zoomed`) si les variations restent sous 25 % du plus haut et que tout est positif.

**Périmètre.** Seule la cascade (et le compteur d'opérations du lien) suit le compte choisi. Le résumé, le mois par mois et le plan prennent `pf.data.accounts` (tous les comptes, clôturés compris).

**Résumé** (`periodSummary`). `money = deposits − withdrawals + transfersIn − transfersOut`, `gain = sources.total`, `moneyShare = money / (money + gain)` si les deux sont > 0, sinon `null` ; `perMonth = money / nombre de mois`.

**Mois par mois** (`monthByMonth`) : `periodChange` entre deux points consécutifs, sur tous les comptes. `money = deposits − withdrawals`, `deposits` brut (mois sans versement si < 0,005 €). `chartBars` regroupe par année au-delà de 36 mois (`MONTHS_PER_BAR_LIMIT`).

**Plan** (`planComparison`).

- Départ : `max(0, buckets[b])` au point `from` (zéro depuis le tout début).
- Chaque mois : `plan[b] *= (1 + taux[b])^(1/12)` ; apports initiaux du mois ajoutés dans `plannedBucketOf(compte)` (où le plan place l'argent du compte, comme la projection ; les liquidités ont un taux de 0) ; si `schedule.isPaid(mois, date)`, ajout de `schedule.planned(compte, mois)` (avant mois manqués) dans la même classe.
- `expectedRates` : `returns.livrets`, `returns.fondsEuros`, `returns.obligations`, `returns.actions`, puis `targets[].expectedReturn` pour `immobilier`, `crowdlending`, `speculatif` ; `null` = pas de gain.
- `gap = valeur réelle − valeur prévue = moneyGap + gainGap`, avec `moneyGap = argent apporté réel − plannedMoney` et `gainGap = gain réel − (valeur prévue − départ − plannedMoney)`.
- `planVerdict` : « conforme » sous `max(20, 0,005 × |valeur prévue|)`.
- `unrated` : classes détenues sans rendement attendu.

**La situation** (`compareSnapshots`). `totalsOf(h)` : `value = h.value`, `netContrib = Σ contribByAccount` (tous les comptes, y compris archivés), `gain = value − netContrib`, `realEstate`, `otherAssets`, `debts`, `netWorth` du point. Comptes : ceux qui ont une valeur ou un apport non nul à l'une des deux dates. Répartition : `max(0, buckets[b])` rapporté à leur somme.

**Titres** (`positionMove`) : comparaison des prix de revient ; « inchangé » si l'écart est ≤ `max(0,5 €, 0,1 % du prix de revient de départ)` ; « nouveau » sans ligne au départ, « vendu » sans ligne à la fin.

**Grandes étapes** (`milestones`), triées par date puis par famille, seulement jusqu'à `asOf` :

- `comptes` : ouverture (`openedOn`, sinon première opération ou premier versement programmé payé), clôture (dernière opération d'un compte archivé) ;
- `titres` : premier achat de chaque titre (tous comptes), vente qui ramène une ligne à zéro ; un arbitrage compte comme une vente et un achat ;
- `paliers` : `thresholds` (1, 2, 5 × 10ⁿ à partir de 1 000 €), un seul par mois, le plus haut ;
- `mouvements` : versement ou retrait ≥ `BIG_MOVE_MIN` (5 000 €) et ≥ `BIG_MOVE_SHARE` (10 %) de la valeur de fin du mois précédent ;
- `marches` : `maxDrawdown` sur `monthlyReturns` de tout le patrimoine, si ≤ `DRAWDOWN_MIN` (−5 %) ; point bas puis rattrapage ;
- `immobilier` : achat et vente de bien (prix × part détenue), première échéance de crédit, crédit soldé (`closedOn`) ou remboursé (`paymentsLeft === 0`).

## Tests

- `packages/core/src/analysis/timeline.test.ts` : invariant de la cascade (transferts internes qui s'annulent, transfert reçu sur un compte), situation (mouvements des titres, compte clôturé), étapes (paliers, ouvertures, clôtures, ventes, gros versements, plus forte baisse, tri), mois par mois, plan (sans et avec rendement attendu, apports initiaux, rendements des classes).
- `packages/ui/src/features/analysis/lib/historique.test.ts` : période par défaut, raccourcis, lecture de l'adresse, libellés, étape → période, regroupement par année, cascade et échelle resserrée, résumé, durées, statistiques des mois, barres par mois ou par an, verdict du plan.
- `packages/ui/src/features/analysis/historique.flow.test.tsx` : situation, cascade, étapes ; lien vers le journal avec la période et le filtre.
- `packages/ui/src/flows/suivi.flow.test.tsx`, bloc « historique » : titres inchangés repliés, comptes sans opération, jeu de démonstration (période, étapes filtrées, cascade par enveloppe, tableaux triés, graphiques).
- `packages/core/src/portfolio/engine.test.ts` : historique reconstruit cohérent avec le calcul du jour, patrimoine net dans le temps.

## Limites connues

- Deux définitions du versé net coexistent sur la page. « La situation » utilise `totalsOf` (somme de `contribByAccount`, comptes archivés compris), le tableau mois par mois utilise `HistoryPoint.netContrib` (= `totals.netContrib` du moteur, qui écarte les comptes archivés de valeur nulle). Les deux diffèrent dès qu'un compte clôturé a un versé net non nul ; le gain affiché diffère d'autant.
- `PlanCard` renvoie vers `/projection` pour « Régler les rendements attendus ». Les rendements se règlent dans Paramètres › Répartition (`AllocationTargets.tsx`), et en gestion de patrimoine `/projection` n'affiche qu'un message.
- Le plan est recalculé avec les paramètres actuels, pas ceux de l'époque.
- `Workspace.prices` ne garde que le dernier cours de chaque mois : la valorisation de fin de mois est juste, mais rien n'est connu à l'intérieur d'un mois.
- `buildHistory` refait un `computePortfolio` complet par mois : le coût croît avec la durée de l'historique (le résultat est mis en cache par jour et par espace de travail).
