# Livrets : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/accounts/pages/Livrets.tsx` | Page `/livrets` (module `livrets`) : chiffres clés, tableau trié, `RateHistory`, mouvements. |
| UI, page | `packages/ui/src/features/accounts/pages/Comptes.tsx` | `LivretsStatus` : message plancher / plafond, partagé avec Mes comptes. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/AccountDialog.tsx` | Fiche d'un livret : type, plafond légal pré-rempli, taux et « En vigueur depuis le ». |
| UI, saisie partagée | `packages/ui/src/features/entry/components/Movements.tsx`, `TransactionButton.tsx` | Mouvements des livrets ; bouton « Nouvelle opération » ; `EmptyAccount`. |
| Cœur, modèle | `packages/core/src/model/rates.ts` | `AccountRate`, `rateAt`, `livretInterest` (règle des quinzaines). |
| Cœur, modèle | `packages/core/src/model/domain.ts` | `LIVRET_TYPES`, `LIVRET_LABELS`, `LIVRET_LEGAL_CEILINGS`, `CASH_BUCKET.livret = "precaution"`. |
| Cœur, modèle | `packages/core/src/model/validation.ts` | `ALLOWED_TYPES.livret`, `ALLOWED_ASSETS.livret = []`, `uniqueAccountConflict`. |
| Cœur, portefeuille | `packages/core/src/portfolio/engine.ts` | Solde du livret (`cash`), `interests`, `state.livrets` (total, statut, excédent). |
| Cœur, projection | `packages/core/src/planning/contributions.ts` | Livrets dans la gestion suggérée (`livretRoom`, tri par taux). |
| Cœur, alertes | `packages/core/src/alerts/alerts.ts` | Alertes `livrets` (fourchette), `plafond-<id>` (plafond de dépôt dépassé), `interets-<id>` (intérêts de l'année passée à saisir, janvier à mars). |
| Contrat | `packages/api/src/accounts/procedures.ts`, `packages/api/src/accounts/inputs.ts` | `accountRates.set`, `accountRates.delete`, `accounts.upsert` (`rate`, `rateFrom`, `depositCeiling`) ; `AccountRateInput`. |
| Backend | `packages/backend/src/handlers/accounts.ts` | `setRate`, `syncCurrentRate`, taux daté créé par `upsertAccount`. |
| Backend | `packages/backend/src/db/schema/accounts.ts` | Tables `account_rates`, `accounts`. |

## Données

### Tables

- `accounts` : `kind = 'livret'`, `livret_type` (`LEP`, `LDDS`, `LIVRET_A`, `AUTRE`), `deposit_ceiling_cents`, `rate` (taux courant recopié), `sort_order`.
- `account_rates` : `id`, `account_id` (cascade), `from_date`, `rate` (fraction), `comment`. Index unique `(account_id, from_date)`.

### Procédures

| Procédure | Effet |
|---|---|
| `accountRates.set` | `{ accountId, fromDate, rate, comment }` : insère, ou remplace le taux de cette date ; puis `syncCurrentRate`. `NOT_FOUND` si le compte n'existe pas. |
| `accountRates.delete` | `{ id }` : supprime, puis `syncCurrentRate`. |
| `accounts.upsert` | Pour un livret avec `rate` : si le taux en vigueur à `rateFrom` (aujourd'hui par défaut) diffère, enregistre un taux daté. |

`syncCurrentRate` supprime les taux identiques au précédent (dans l'ordre des dates), puis recopie dans `accounts.rate` le dernier taux dont `from_date ≤` aujourd'hui.

### Champs du `Workspace` utilisés

`accounts`, `accountRates`, `transactions`, `plans`, `skips`, `institutions`, `params` (`profile.startMonth`, `profile.contributionDay`, `livrets.floor`, `livrets.ceiling`).

## Règles de calcul

### Intérêts (`livretInterest`)

Commentaire de `rates.ts` : un dépôt rapporte à partir de la quinzaine qui suit, un retrait cesse de rapporter dès le début de la quinzaine où il a lieu ; intérêts = Σ solde × taux / 24 ; les intérêts crédités au 31/12 rapportent à partir du 1er janvier suivant.

- Quinzaine absolue : `année × 24 + (mois − 1) × 2 + (jour ≥ 16 ? 1 : 0)`.
- Mouvements signés du compte : entrées (`apport_initial`, `versement`, `interets`, `dividende`, `vente`, `correction` avec son signe, transfert reçu) comptées à partir de la quinzaine suivante ; sorties (retrait, transfert émis, frais, achat, impôts) dès leur quinzaine.
- Versements programmés : `Schedule.amount` de chaque mois jusqu'à décembre de l'année, à la quinzaine qui suit leur `dueDate`, y compris les mois à venir. La boucle part au plus tôt 60 ans avant l'année calculée.
- Pour chaque quinzaine de l'année : taux = `rateAt(rates, compte, début de quinzaine)`, sinon `account.rate`, sinon 0 ; intérêt = max(0, solde) × taux / 24.
- `estimated` = Σ des 24 quinzaines ; `earnedToDate` = Σ jusqu'à la quinzaine de `today` incluse ; arrondis au centime. `averageRate` (moyenne simple des 24 taux) est calculé mais pas affiché.

### Page

- Lignes : comptes `livret` non archivés, à partir de `state.accounts`.
- Taux actuel affiché : `rateAt(accountRates, compte, today)`, sinon `account.rate`.
- Total = Σ `value` des lignes ; taux moyen pondéré = Σ (`value × taux`) / total.
- Marge = `depositCeiling − value`, en rouge si négative.
- « Intérêts encaissés » = `AccountState.interests` (toutes années).
- « Ordre de remplissage » : lignes triées par `sortOrder`.

### Fourchette du plan

`state.livrets` dans `computePortfolio` : total = Σ valeur de **tous** les comptes `livret` ; `sous_plancher` si total < `floor`, `au_dessus` si total > `ceiling`, excédent = total − `ceiling`. Paramètres validés : plancher ≤ plafond. Valeurs par défaut : plancher 7 500 €, plafond 15 000 € (`defaultParams`).

### Plafonds légaux

`LIVRET_LEGAL_CEILINGS` : LEP 10 000 €, LDDS 12 000 €, Livret A 22 950 €, autre : aucun (« hors intérêts capitalisés »). Aucune source n'est citée dans le code. L'alerte `plafond-<id>` se déclenche quand le solde dépasse `depositCeiling` de plus de 0,50 €.

## Tests

- `packages/core/src/model/rates.test.ts` : taux en vigueur à une date, solde stable, dépôt du 10 mars compté au 16, retrait, changement de taux en cours d'année et intérêts acquis, versements programmés à venir.
- `packages/core/src/portfolio/engine.test.ts` : « LEP et versements : 300 €/mois comptés dès novembre ».
- `packages/core/src/planning/contributions.test.ts` : livret le mieux rémunéré d'abord, plafond du LEP atteint.
- `packages/core/src/alerts/alerts.test.ts` : livrets sous le plancher, intérêts de janvier.
- `packages/backend/src/backend.test.ts` : bloc « taux datés des livrets » (historique créé par la fiche, pas de doublon) et « comptes uniques ».
- `packages/ui/src/flows/placements.flow.test.tsx` : bloc « Livrets » (page vide, totaux, plafond dépassé, ordre de remplissage, historique des taux).
- `packages/ui/src/flows/reglages.flow.test.tsx` : « nouveau livret : le type règle le nom et le plafond légal, le taux est daté ».
- `packages/ui/src/flows/suivi.flow.test.tsx` : « livrets sous le plancher, puis au-dessus du plafond ».

## Limites connues

- `accounts.rate` n'est recopié qu'à l'écriture (fiche ou historique des taux). Un taux daté dans le futur ne devient le taux de la fiche qu'au prochain enregistrement. La page n'en souffre pas (elle lit `rateAt`), mais `proposeContributions` trie les livrets sur `account.rate`.
- « Ordre de remplissage » trie sur `sortOrder`, que l'interface ne permet pas de régler (toujours 0) : l'ordre est celui du chargement (`sort_order`, puis nom). La gestion suggérée remplit, elle, le livret au meilleur taux d'abord.
- Le total de la page (livrets actifs) et `state.livrets.total` (tous les livrets) diffèrent si un livret archivé garde un solde.
- La règle des quinzaines s'applique aussi aux livrets `AUTRE`.
- La suppression d'un taux dans l'historique ne demande pas de confirmation.
