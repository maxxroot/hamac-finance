# Fonds euros : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/accounts/pages/FondsEuros/FondsEuros.tsx` | Page `/fonds-euros` (module `fondsEuros`), tous contrats confondus : bandeau des contrats, chiffres d'ensemble, tableau, mouvements. |
| UI, page | `packages/ui/src/features/accounts/pages/FondsEuros/_FundTable.tsx` | Une ligne par fonds et par contrat (clé `accountId:assetId`), dépliée sur les taux servis et l'évolution du fonds. |
| UI, page | `packages/ui/src/features/accounts/pages/FondsEuros/_FundRates.tsx` | Taux servis d'un fonds dans un contrat (`fundRates.set`, `fundRates.delete`), intérêts saisis de chaque année. |
| UI, lib | `packages/ui/src/features/accounts/lib/fundLines.ts` | `fundLines` (fonds par défaut, détenus, avec taux), `weightedAverageRate`. |
| UI, composant | `packages/ui/src/features/accounts/components/StatementCard.tsx` | « Contrôle avec le relevé », sur la page du contrat (`/comptes/:id`). |
| UI, socle | `packages/ui/src/shared/components/AccountStrip.tsx` | Bandeau des comptes concernés, partagé avec Actions & ETF et Obligations. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/AccountDialog.tsx` | Type de PER, « Fonds euros par défaut » (nouveau, existant ou aucun). |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx` | Champ « Support » / « Sur le support », `NEW_FUND_PRESET`, arbitrage. |
| UI, saisie partagée | `packages/ui/src/features/entry/components/Movements.tsx`, `TransactionButton.tsx`, `AccountButtons.tsx` | Mouvements, boutons « Arbitrage » et « Verser sur un autre fonds euros », crayon, `EmptyAccount`. |
| UI, socle | `packages/ui/src/shared/components/AccountEvolution.tsx` | `PositionEvolution` (évolution d'un fonds dans un contrat). |
| Cœur, modèle | `packages/core/src/model/domain.ts` | `EURO_FUND_ACCOUNT_KINDS`, `holdsEuroFunds`, `isBankPer`, `PER_KINDS`, `FundRate`, `Statement`, `Account.defaultAssetId`. |
| Cœur, modèle | `packages/core/src/model/validation.ts` | `EURO_FUND_TYPES`, `allowedIn`, `arbitrageErrors`. |
| Cœur, portefeuille | `packages/core/src/portfolio/engine.ts` | `euroFund`, `moveMoney`, valorisation d'un fonds euros (prix 1), alerte de solde négatif, `fiscalAnniversary`, `accountAgeYears`. |
| Cœur, portefeuille | `packages/core/src/portfolio/reconciliation.ts` | `reconcile`, `MONEY_TOLERANCE`. |
| Cœur, alertes | `packages/core/src/alerts/alerts.ts` | `clause-<id>` et `releve-<id>` (lien vers la page du contrat, `/comptes/<id>`), `interets-<id>` (assurance-vie et livrets, janvier à mars). |
| Contrat | `packages/api/src/accounts/procedures.ts`, `packages/api/src/accounts/inputs.ts` | `fundRates.set`, `fundRates.delete`, `statements.upsert`, `statements.delete`, `accounts.upsert` ; `FundRateInput`, `StatementInput`, `AccountInput.defaultAssetId`. |
| Contrat | `packages/api/src/journal/procedures.ts` | `transactions.createWithAsset` (nouveau fonds euros avec un versement). |
| Backend | `packages/backend/src/handlers/accounts.ts` | `defaultEuroFund`, reprise des taux servis au changement de fonds par défaut, `deleteUnusedEuroFund`, `euroFundOperations`, handlers `fundRates.*` et `statements.*`. |
| Backend | `packages/backend/src/db/schema/accounts.ts` | Tables `fund_rates`, `statements`, colonne `accounts.default_asset_id`. |
| Backend | `packages/backend/src/repo/mappers/accounts.ts` | `mapFundRate`, `mapStatement`. |

## Données

### Tables

- `assets` avec `kind = 'fonds_euros'`, `price_source = 'modele'` : le fonds euros, propre à l'assureur, partageable entre contrats.
- `accounts.default_asset_id` : fonds euros par défaut d'un contrat (`set null` si le titre disparaît).
- `fund_rates` : `account_id` (cascade), `asset_id` (cascade), `year`, `rate`, `comment` ; clé primaire `(account_id, asset_id, year)`. Un taux par contrat, par fonds et par année : un même fonds peut être bonifié dans un contrat.
- `statements` : `id`, `account_id` (cascade), `date`, `value_cents`, `comment`.

### Procédures

| Procédure | Effet |
|---|---|
| `accounts.upsert` | `defaultAssetId` absent : inchangé, ou, pour un nouveau contrat, création de `Fonds euros (<nom>)`. `null` : aucun. Sinon, doit désigner un fonds euros (`VALIDATION`). Un compte qui ne détient pas de fonds euros a toujours `null`. Au changement de fonds par défaut, les taux du contrat passent au nouveau fonds pour les années qu'il n'a pas, puis l'ancien fonds est supprimé s'il ne sert plus. |
| `fundRates.set` | Insère ou remplace le taux `(compte, fonds, année)`. Refusé si `assetId` n'est pas un fonds euros. |
| `fundRates.delete` | `{ accountId, assetId, year }`. |
| `statements.upsert` | Crée (sans `id`) ou met à jour un relevé. La page crée toujours. |
| `statements.delete` | Existe dans le contrat ; la page ne l'appelle pas. |
| `transactions.createWithAsset` | « ＋ Nouveau fonds euros » : crée `{ kind: "fonds_euros", name, priceSource: "modele" }` puis l'opération. |

### Champs du `Workspace` utilisés

`accounts`, `assets`, `transactions`, `plans`, `skips`, `fundRates`, `statements`, `institutions` (`offers.assurance_vie.entryFee`, `euroFee`), `params` (`alerts.fgapGuarantee`, `returns.fondsEuros`).

## Règles de calcul

### Contrats affichés

`holdsEuroFunds(account)` : `assurance_vie`, ou `per` dont `perKind` n'est pas `bancaire` (un PER sans type est assurantiel). Contrats non archivés.

### Argent d'un contrat (`computePortfolio`)

`euroFund(compte, explicite)` : le fonds euros visé par l'opération, sinon le fonds par défaut du contrat, sinon `null` (espèces). `moveMoney` ajoute ou retire le montant à la quantité **et** au prix de revient du fonds : un fonds euros n'a pas de plus-value latente, son gain est ses intérêts.

- Apport, versement, retrait, intérêts, frais, impôts, correction : support visé ou par défaut.
- Transfert : côté départ, `assetId` ; côté arrivée, `counterAssetId` ou le fonds par défaut du compte d'arrivée.
- Dividende, achat, vente : toujours le fonds par défaut (pas de support visé).
- Arbitrage : depuis ou vers un fonds euros, en euros ; vers un fonds euros, montant reçu = `amount − fee`.
- Versements programmés : `scheduledPaid` va au fonds par défaut.
- Intérêts : `income` du fonds crédité, sauf s'ils portent sur une obligation (`assetId` non fonds euros), qui garde le revenu.

Valorisation : prix 1, `value = qty`, `priceUsed = "modele"`. Un fonds reste affiché tant que |solde| ≥ 0,005 €, même négatif ; sous −0,01 €, un avertissement « Solde négatif sur … » remonte au tableau de bord (lien `/journal`).

Le fonds par défaut est résolu au moment du calcul : en changer réattribue toutes les opérations passées sans support précisé.

### Page

- Fonds listés : `defaultAssetId`, puis les positions fonds euros du contrat, puis les fonds qui ont des taux pour ce contrat (sans doublon).
- « Intérêts reçus » = `PositionState.income` du fonds.
- « Intérêts saisis » d'une année = Σ opérations `interets` du contrat datées de l'année, dont `assetId` = ce fonds, ou nul si c'est le fonds par défaut.
- « Taux moyen servi » = moyenne arithmétique des taux saisis pour ce fonds dans ce contrat.
- Ancienneté : `accountAgeYears` années et `monthsBetween % 12` mois. Fiscalité allégée : `fiscalAnniversary(openedOn, 8)` = ouverture + 96 mois.
- Marge FGAP = `params.alerts.fgapGuarantee − value` du contrat.

### Rapprochement (`reconcile`)

Pour chaque compte, le dernier relevé de date ≤ aujourd'hui ; valeur calculée par `computePortfolio(data, date du relevé)` (mise en cache par date) ; `valueGap = relevé − calcul`, arrondi au centime ; statut `ecart` si |écart| ≥ `MONEY_TOLERANCE` (1 €), sinon `concorde`. L'écart se corrige par une opération « Correction ».

`AccountState.statementGap` existe aussi, mais compare le relevé à la valeur du jour ; la page ne l'utilise pas.

## Tests

- `packages/core/src/portfolio/euroFunds.test.ts` : valeur, versé net, gain et intérêts identiques au centime avec ou sans fonds par défaut, argent sur le fonds et plus en espèces, historique, performance, gain par titre, autre fonds visé, sans fonds par défaut, solde négatif, validation.
- `packages/core/src/portfolio/arbitrage.test.ts` : fonds euros ↔ unité de compte, fonds euros vers un autre, frais, validation.
- `packages/core/src/portfolio/reconciliation.test.ts` : comparaison à la date du relevé, écart signalé.
- `packages/core/src/model/protection.test.ts` : PER bancaire ou assurantiel.
- `packages/backend/src/handlers/euroFunds.test.ts` : fonds créé avec le contrat, fonds partagé, changement de fonds (argent et taux suivent, ancien fonds supprimé), suppression d'un contrat vide, taux servis par fonds, transfert vers un fonds, PER bancaire, migration et restauration d'anciennes sauvegardes.
- `packages/ui/src/flows/placements.flow.test.tsx` : bloc « Fonds euros » (deux contrats et taux moyen pondéré, lien vers le contrat ; page du contrat : fiche, informations manquantes, relevé ; taux servis dans la ligne dépliée ; plusieurs fonds ; arbitrage).
- `packages/ui/src/features/accounts/lib/fundLines.test.ts` : lignes par fonds et par contrat, taux moyen pondéré.

## Limites connues

- La marge FGAP de la page du contrat est calculée contrat par contrat, sur la valeur entière (unités de compte comprises), alors que `protectionOf` applique le plafond par assureur, tous contrats confondus. Les deux chiffres peuvent se contredire pour deux contrats chez le même assureur.
- Les frais affichés viennent de `institution.offers.assurance_vie` ; les champs `entryFeeRate` et `managementFeeRate` de la fiche du contrat ne sont pas lus par la page. Pour un PER, aucun frais n'est affiché.
- `fundRates` n'entre dans aucun calcul du cœur (`EngineData.fundRates` est déclaré mais pas lu) : la projection utilise `params.returns.fondsEuros`.
- `deleteUnusedEuroFund` ne regarde que les opérations et les fonds par défaut. Un fonds qui n'a plus que des taux servis saisis sur un autre contrat est supprimé, et ces taux disparaissent avec lui (cascade).
- L'alerte des intérêts de janvier ne vise que `assurance_vie` et `livret`, pas le PER assurantiel.
- `EmptyAccount` propose seulement `assurance_vie`. La description du menu (`nav.ts`) parle d'assurance-vie seulement, alors que la page couvre aussi le PER assurantiel.
- Aucune interface ne liste ni ne supprime les relevés.
- `weightedAverageRate` pondère la moyenne des taux de chaque fonds par son solde actuel, pas par les soldes passés de chaque année.
