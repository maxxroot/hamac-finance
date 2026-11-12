# Projets : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/planning/pages/Projets.tsx` | Page `/projets` : alerte de sur-affectation, résumé mensuel, cartes (`GoalCard`), section des archivés. Exporte `GOAL_STATUS` (libellés et tons des statuts). |
| UI | `packages/ui/src/features/planning/dialogs/GoalDialog.tsx` | Fenêtre de création et de modification ; appelle `goals.upsert`. |
| UI | `packages/ui/src/features/dashboard/pages/TableauDeBord.tsx` | `GoalsCard` : six premiers projets en cours, si `params.modules.projets`. |
| UI | `packages/ui/src/shared/nav.ts` | Entrée `/projets`, `module: "projets"`. |
| UI | `packages/ui/src/app/App.tsx` | Route `/projets`. |
| UI | `packages/ui/src/shared/lib/workspace.ts` | `normalizeWorkspace` : liste `goals`. |
| Core | `packages/core/src/planning/goals.ts` | Types `Goal`, `GoalAllocation`, `GoalProgress` ; `GOAL_ALLOCATION_MODES`, `allocationAmount`, `monthlySaving`, `goalProgress`, `overAllocatedAccounts`. |
| Core | `packages/core/src/base/dates.ts` | `monthsBetween` (mois entiers, le jour compte). |
| API | `packages/api/src/planning/inputs.ts` | `GoalInput` (validation zod). |
| API | `packages/api/src/planning/procedures.ts` | `goals.upsert`, `goals.delete` (et `gifts.*`, voir plus bas). |
| API | `packages/api/src/system/procedures.ts` | Champ `goals: Goal[]` du `Workspace`. |
| Backend | `packages/backend/src/handlers/planning.ts` | Handlers : écriture du projet et remplacement de ses comptes dans une transaction. |
| Backend | `packages/backend/src/db/schema/planning.ts` | Tables `goals` et `goal_allocations`. |
| Backend | `packages/backend/src/repo/mappers/planning.ts` | `mapGoal`. |
| Backend | `packages/backend/src/repo/loadWorkspace.ts` | Charge `goals` triés par `target_date` et leur `goal_allocations`. |
| Backend | `packages/backend/src/backup/dump.ts` | `goals` puis `goal_allocations` dans `TABLES`. |

### Donations (`gifts.*`)

Les procédures `gifts.upsert` et `gifts.delete`, l'entrée `GiftInput` et la table `gifts` sont rangées dans le domaine `planning` de l'API et du backend, avec les projets. Elles ne s'affichent pas sur la page Projets :

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/tax/pages/Compteurs.tsx` | Page `/compteurs` (« Compteurs et plafonds ») : carte des donations (`GiftsCard`) et fenêtre `GiftDialog`. |
| Core | `packages/core/src/portfolio/counters.ts` | `giftCounters`, `GIFT_ALLOWANCES`, `FAMILY_CASH_GIFT`, `GIFT_RENEWAL_YEARS`, types `Gift`, `GiftKind`, `GiftRelation`. |

Leur documentation est celle de la page « Compteurs et plafonds » : [documentation technique](../compteurs-et-plafonds/technique.md).

## Données

**Table `goals`** : `id`, `name`, `target_cents`, `target_date`, `start_date`, `rate` (fraction, défaut 0), `comment`, `archived`, horodatages.

**Table `goal_allocations`** : clé primaire (`goal_id`, `account_id`) ; `goal_id` → `goals` en cascade, `account_id` → `accounts` en cascade (supprimer un compte retire sa part de tous les projets) ; `mode` (`pourcentage` ou `montant`) ; `value` (fraction ou euros, `double precision`, pas en centimes).

**Procédures** :

| Procédure | Entrée | Sortie |
|---|---|---|
| `goals.upsert` | `GoalInput` : `id?`, `name` (1–120), `target` (> 0), `targetDate`, `startDate`, `rate` (−0,5 à 0,5, défaut 0), `allocations` (≤ 50, défaut `[]`), `comment` (≤ 500), `archived` (défaut `false`) | `Goal` |
| `goals.delete` | `{ id }` | `ok` |

Règles de `GoalInput` : un pourcentage ne dépasse pas 1 ; un compte n'apparaît qu'une fois par projet ; `startDate ≤ targetDate` (erreur sur `targetDate`). `goals.upsert` avec un `id` inconnu renvoie `NOT_FOUND` (« Projet introuvable. »). À chaque enregistrement, toutes les lignes de `goal_allocations` du projet sont supprimées puis réécrites.

**Champs du `Workspace` lus** : `goals`, et tout ce qui sert à `PortfolioState` (`accountById`, valeur et `byBucket` de chaque compte, `account.share`, `asOf`). `GoalDialog` propose `idx.activeAccounts`.

## Règles de calcul

Tout est dans `packages/core/src/planning/goals.ts`. Aucune règle fiscale, aucun texte cité.

- **Part détenue** : `heldValue = valeur du compte × (account.share ?? 1)`.
- **Apport d'un compte** (`allocationAmount`) : `pourcentage` → `max(0, heldValue) × value` ; `montant` → `min(value, max(0, heldValue))`. Arrondi au centime.
- **`saved`** = somme des apports ; `progress = min(1, saved / target)` ; `remaining = max(0, target − saved)`.
- **`monthsLeft`** = `max(0, monthsBetween(asOf, targetDate))`.
- **Statut** : `atteint` si `saved ≥ target` ; sinon `echu` si `targetDate ≤ asOf` ; sinon `en_avance` si `saved ≥ target × écoulé / total`, où `total = max(1, monthsBetween(startDate, targetDate))` et `écoulé` est borné entre 0 et `total` ; sinon `en_retard`.
- **`monthlySaving(target, saved, n, taux)`** : taux mensuel `i = (1 + taux)^(1/12) − 1` ; `manque = target − saved × (1 + i)^n` ; 0 si `manque ≤ 0` ; sinon `manque / n` à taux nul, `manque × i / ((1 + i)^n − 1)` sinon (versement en fin de mois). Si `n ≤ 0`, renvoie `max(0, target − saved)`. `monthlyNeeded` vaut 0 pour un projet atteint.
- **`riskyShare`** : pour chaque compte, part de sa valeur dans les classes `croissance` et `speculatif` (`byBucket`), pondérée par son apport, divisée par `saved`.
- **Avertissement** : statut différent de `atteint`, `monthsLeft ≤ 36` et `riskyShare > 0,3`.
- **`overAllocatedAccounts`** : projets non archivés ; par compte, somme de `heldValue × value` (pourcentage) ou de `value` brut (montant) ; signalé si la somme dépasse `heldValue` de plus de 0,50 €.
- **Page** : `monthly` du résumé = somme des `monthlyNeeded` des projets non archivés.

## Tests

| Fichier | Ce qui est couvert |
|---|---|
| `packages/core/src/planning/goals.test.ts` | Apport en pourcentage et en montant plafonné, versement mensuel à 0 % et avec rendement, statuts en avance, en retard et atteint, avertissement de risque, compte sur-affecté (archivés exclus). |
| `packages/backend/src/backend.test.ts` | `goals.upsert` : création, remplacement des comptes à la modification, refus d'une date avant le début et d'un pourcentage supérieur à 100 %, comptes retirés quand on supprime le compte. `gifts.upsert` et `gifts.delete`. |
| `packages/ui/src/flows/suivi.flow.test.tsx`, bloc `describe("projets")` | Création du premier projet avec ses comptes, statuts, date passée, avertissement, comptes sur-affectés, archivage, suppression avec confirmation. |
| `packages/ui/src/flows/suivi.flow.test.tsx`, bloc `describe("tableau de bord")` | Carte « Projets en cours » : avancement, avance ou retard, versement mensuel. |

## Limites connues

- Le résumé « à mettre de côté chaque mois » additionne les `monthlyNeeded` de tous les projets non archivés, y compris ceux au statut `echu`, pour lesquels `monthlySaving` renvoie toute la somme manquante (`n = 0`). Le total mélange alors un montant mensuel et un montant global.
- `monthsLeft` vaut 0 dès qu'il reste moins d'un mois entier : la carte affiche « la date est passée » alors que le statut reste `en_avance` ou `en_retard` (l'étiquette dit autre chose que le texte).
- Les projets n'entrent pas dans la projection (`packages/core/src/planning/projection.ts` ne lit pas `goals`), bien que la carte « Dépenses imprévues » de la Projection renvoie les dépenses prévues vers Projets.
- La couleur de la barre diffère entre la page (accent, sauf atteint) et le tableau de bord (alerte si `en_retard`).
- `overAllocatedAccounts` compte un montant réservé en entier, alors que `allocationAmount` le plafonne à la valeur du compte : c'est voulu pour l'alerte, mais les deux calculs ne donnent pas la même somme.
- `goals.delete` ne signale pas un `id` inconnu (renvoie `ok`).
