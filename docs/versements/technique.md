# Versements : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/journal/pages/Versements.tsx` | Page `/versements` : onglets libre / suggérée, `PlanForm`, `AccountPlans`, `SkipsCard`, carte « Ce mois-ci », calendrier. |
| UI, composant | `packages/ui/src/features/journal/components/SuggestedContributions.tsx` | Gestion suggérée : capacité d'épargne, tableau de la proposition, application aux plans. |
| UI, composant | `packages/ui/src/features/journal/components/CustomAllocationCards.tsx` | `ContributionSplitCard` : répartition conseillée des versements selon les allocations personnalisées. |
| UI, logique | `packages/ui/src/features/journal/lib/versements.ts` | `oneOffByMonth`, `oneOffTotal` : versements ponctuels du journal par mois et par compte. |
| UI, logique | `packages/ui/src/features/journal/lib/allocations.ts` | `useAllocationReport` : `allocationReport` sur les comptes non archivés. |
| Cœur, modèle | `packages/core/src/model/schedule.ts` | `Schedule` : montant prévu, versé, jour de prélèvement, cumul, flux, opérations au journal ; `addMonth`, `monthsBetweenInclusive`, `dayOfMonth`. |
| Cœur, modèle | `packages/core/src/model/allocations.ts` | Allocations personnalisées : `AllocationRule`, `effectiveShares`, `allocationReport`, `allocationIssues`. |
| Cœur, modèle | `packages/core/src/model/params.ts` | `profile.startMonth`, `profile.contributionDay`, `contributions.mode` et `capacity`, `isRetirementPlan`, `retirementYear`. |
| Cœur, projection | `packages/core/src/planning/contributions.ts` | `proposeContributions` : gestion suggérée. |
| Cœur, portefeuille | `packages/core/src/portfolio/engine.ts` | `scheduledPaid`, `currentMonthly`, versé net et fonds euros par défaut des versements programmés. |
| Cœur, alertes | `packages/core/src/alerts/alerts.ts` | Alertes `alloc-versements` et `versements-suggeres` (lien `/versements`). |
| Contrat | `packages/api/src/journal/procedures.ts`, `packages/api/src/journal/inputs.ts` | `plans.set`, `plans.delete`, `skips.upsert`, `skips.delete` ; `PlanInput`, `SkipInput`. |
| Contrat | `packages/api/src/system/procedures.ts` | `params.update`. |
| Backend | `packages/backend/src/handlers/journal.ts` | Handlers des plans et des mois manqués. |
| Backend | `packages/backend/src/handlers/accounts.ts` | `stopPlans` : arrêt des plans d'un compte archivé. |
| Backend | `packages/backend/src/db/schema/journal.ts` | Tables `contribution_plans`, `contribution_skips`. |

## Données

### Tables

- `contribution_plans` : `id`, `account_id` (cascade à la suppression du compte), `from_month` (`AAAA-MM`), `amount_cents` (0 = arrêt), `comment`. Index unique `(account_id, from_month)`.
- `contribution_skips` : `id`, `account_id` (cascade), `month`, `amount_cents` (> 0), `comment`. Plusieurs lignes possibles pour un même mois : elles s'additionnent.

### Procédures

| Procédure | Entrée | Effet |
|---|---|---|
| `plans.set` | `{ accountId, fromMonth, amount ≥ 0, comment }` | Met à jour le plan de ce compte et de ce mois s'il existe, sinon le crée. |
| `plans.delete` | `{ id }` | Supprime un palier. |
| `skips.upsert` | `{ id?, accountId, month, amount > 0, comment }` | Crée ou met à jour un mois manqué. |
| `skips.delete` | `{ id }` | Supprime un mois manqué. |
| `params.update` | `PlanParams` complet | Mode (`contributions.mode`) et capacité (`contributions.capacity`). |

`SuggestedContributions.apply` appelle `call("plans.set", …)` compte par compte, puis invalide le workspace : ce n'est pas une transaction.

### Champs du `Workspace` utilisés

`plans`, `skips`, `transactions` (versements ponctuels), `accounts`, `params` (`profile.startMonth`, `profile.contributionDay`, `profile.birthYear`, `profile.retirementAge`, `profile.goal`, `contributions`, `livrets.floor`, `customAllocations`, `targets`).

## Règles de calcul

### `Schedule`

- `planned(compte, mois)` : montant du dernier plan dont `fromMonth ≤ mois` ; 0 avant `startMonth`.
- `amount(compte, mois)` = max(0, `planned` − somme des mois manqués), arrondi au centime.
- `dueDate(mois)` = `dayOfMonth(mois, contributionDay)`, ramené au dernier jour du mois.
- `isPaid(mois, today)` : `dueDate(mois) ≤ today`.
- `paidTotal` : somme des `amount` des mois de `startMonth` au mois en cours, ce dernier seulement si son jour est passé.
- `current(compte, today)` : montant du mois en cours, ou du premier mois si le calendrier n'a pas commencé.
- `paidTransactions(today)` : voir [Journal](../journal/technique.md#versements-programmés-au-journal).

Différence voulue avec le sheet d'origine (commentaire de `schedule.ts`) : un versement se programme pour un mois, il n'y a plus de déclaration datée qui ne compte qu'au mois suivant.

### Effet dans le moteur

`computePortfolio` ajoute `scheduledPaid` au versé net (`netContrib = contributions du journal + scheduledPaid`). Pour un compte qui détient des fonds euros et a un fonds par défaut, `scheduledPaid` s'ajoute à la quantité et au prix de revient de ce fonds ; sinon aux espèces.

### Page

- Fin du calendrier : `retirementYear(params)-12` en format retraite ; sinon `max(année courante, année de startMonth) + 10`, en décembre.
- Début : `startMonth`, ou le mois du premier versement ponctuel s'il est antérieur.
- Fenêtre par défaut : `[mois courant − 3, mois courant + 14]`.
- Colonnes : comptes actifs ayant au moins un plan, plus tout compte (même archivé) ayant un versement ponctuel.
- Total d'un mois = Σ `schedule.amount` des colonnes + Σ versements ponctuels ; mois « versé » si `isPaid`, ou, avant `startMonth`, s'il a un versement ponctuel.
- Une case est signalée « mois manqué » quand `planned > amount`.
- Mois par défaut du formulaire « Programmer » : `startMonth` si le calendrier n'a pas commencé, sinon le mois courant. Pour « Appliquer à partir de » : pareil, mais le mois suivant si le versement du mois courant est déjà passé.

### Gestion suggérée (`proposeContributions`)

1. **Allocations personnalisées** : `allocationReport(règles, comptes, total, capacité)`. Chaque ligne reçoit `min(advisedMonthly, remaining)` s'il y a une limite, réparti sur ses comptes.
2. **Matelas de précaution** : si aucune règle ne vise les livrets et que `state.livrets.total < params.livrets.floor`, min(reste, écart au plancher) va aux livrets, triés par `account.rate` décroissant, chacun jusqu'à son plafond (`depositCeiling`, sinon plafond légal du type).
3. **Allocation de base** : le reste est réparti par `splitByTarget` entre les classes de `state.allocation.rows` qui ont un compte (comptes qui détiennent déjà un titre de la classe, sinon comptes du type associé dans `BUCKET_ACCOUNTS` et inclus dans l'allocation), en visant l'écart à la cible après versement. Sans aucune classe servie, tout va aux livrets.

Partage dans une ligne hors livrets : au prorata de `currentMonthly`, sinon de la valeur, sinon à parts égales. Arrondi : troncature à l'euro, puis les euros restants vont aux plus grandes parties décimales. Une plateforme crypto n'apparaît que si elle reçoit quelque chose ou a déjà un versement. `unassigned ≥ 1 €` produit une note.

### Allocations personnalisées (`allocationReport`, `effectiveShares`)

Une ligne vise un compte ou un type de compte, avec une part des versements et une limite facultative (« versé » net ou « valeur »). Ligne terminée quand le montant atteint la limite à 0,005 € près. Sa part passe à `overflowTo` (en suivant la chaîne si la destination est aussi terminée), sinon aux lignes actives au prorata. `advisedMonthly = contributionShare × monthlyBase`, avec `monthlyBase` = total programmé ce mois (ou la capacité dans la gestion suggérée). La carte signale un écart quand |programmé − conseillé| > max(5 €, 10 % du conseillé).

## Tests

- `packages/core/src/model/schedule.test.ts` : paliers, arrêt à 0, mois manqués, premier mois, jour de prélèvement, opérations au journal.
- `packages/core/src/model/allocations.test.ts` : parts après limite, chaîne de destinations, limites « versé » et « valeur », validation.
- `packages/core/src/planning/contributions.test.ts` : ordre de priorité, plafonds de livrets, arrondi, classes créées, crowdlending.
- `packages/core/src/portfolio/engine.test.ts` : « LEP et versements : 300 €/mois comptés dès novembre ».
- `packages/ui/src/features/journal/lib/versements.test.ts` : versements ponctuels par mois et par compte.
- `packages/backend/src/backend.test.ts` : un plan par compte et par mois (mise à jour en place) ; archiver un compte arrête ses versements sans effacer le passé.
- `packages/ui/src/flows/suivi.flow.test.tsx` : bloc « versements » (programmer, arrêter, supprimer, mois manqués, versements ponctuels).
- `packages/ui/src/flows/placements.flow.test.tsx` : bloc « Répartition conseillée des versements ».

## Limites connues

- `plans.delete` du seul plan d'un compte efface aussi ses versements passés du calcul (aucun plan = 0 pour tous les mois).
- `SkipsCard` ne propose que les comptes actifs qui ont un plan, mais liste tous les mois manqués, y compris ceux de comptes archivés.
- La colonne « Âge » est affichée quel que soit `profile.goal`.
- L'application d'une proposition n'est pas atomique (appels `plans.set` successifs).
- La gestion suggérée trie les livrets sur `account.rate`, le taux recopié au moment de l'enregistrement : un taux daté dans le futur n'y est pris qu'au prochain enregistrement du compte ou de ses taux (voir [Livrets](../livrets/technique.md)).
- Le texte « Ordre de remplissage » de la page Livrets ne suit pas l'ordre de la gestion suggérée (voir [Livrets](../livrets/technique.md#limites-connues)).
