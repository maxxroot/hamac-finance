# Mes comptes : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/accounts/pages/Comptes.tsx` | Page `/comptes` (l'ancienne adresse `/enveloppes` redirige) : `AccountsTable`, évolution, allocation de la partie investie, `LivretsStatus` (réutilisé par Livrets). |
| UI, composant | `packages/ui/src/features/accounts/components/ConcentrationCard.tsx` | Carte « Concentration ». |
| UI, composant | `packages/ui/src/features/accounts/components/ProtectionCard.tsx` | Carte « Protection en cas de faillite ». |
| UI, socle | `packages/ui/src/shared/components/AccountEvolution.tsx`, `packages/ui/src/shared/lib/evolution.ts` | Courbes d'évolution d'un ou de plusieurs comptes. |
| UI, socle | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio` : `computePortfolio` mémoïsé par workspace et par jour. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/AccountDialog.tsx`, `packages/ui/src/features/entry/dialogs/AllocationChoice.tsx` | Fiche d'un compte (création, modification, archivage). |
| UI, saisie partagée | `packages/ui/src/features/entry/components/AccountButtons.tsx`, `Onboarding.tsx`, `TransactionButton.tsx` (`EmptyAccount`) | Boutons « Ajouter… », crayon, accueil. |
| UI, réglages | `packages/ui/src/features/settings/pages/Parametres/AccountsTab.tsx` | Paramètres › Comptes : liste, « Nouveau compte », suppression. |
| UI, navigation | `packages/ui/src/shared/nav.ts`, `packages/ui/src/app/App.tsx` | Entrée « Mes comptes » du menu, route. |
| Cœur, portefeuille | `packages/core/src/portfolio/engine.ts` | `computePortfolio` : `AccountState` (valeur, versé net, gain…), `totals`, `allocation`, `livrets`, `netWorth`. |
| Cœur, portefeuille | `packages/core/src/portfolio/history.ts` | `buildHistory` : points mensuels des courbes. |
| Cœur, modèle | `packages/core/src/model/protection.ts`, `packages/core/src/model/institutionProtection.ts` | `protectionOf`, plafonds, sources ; réglages « établissement garant » et « pays ». |
| Cœur, modèle | `packages/core/src/model/domain.ts` | `Account`, `ACCOUNT_KIND_LABELS`, `isEnvelope`, `accountNoun`, `canBeJoint`, `holdsEuroFunds`, `CASH_BUCKET`, `cashBucketOf`. |
| Cœur, modèle | `packages/core/src/model/validation.ts` | `uniqueAccountConflict` : un seul PEA, PEA-PME, LEP, LDDS, Livret A. |
| Cœur, modèle | `packages/core/src/model/params.ts` | `classTargets`, `etfTarget`, `classEnabled`, `livrets`, `alerts.fgapGuarantee`, `alerts.concentrationMax`. |
| Cœur, analyse | `packages/core/src/analysis/concentration.ts` | `concentrationReport`. |
| Cœur, alertes | `packages/core/src/alerts/alerts.ts` | Alertes `allocation`, `concentration-*`, `protection-*` (lien `/comptes`). |
| Contrat | `packages/api/src/accounts/procedures.ts`, `packages/api/src/accounts/inputs.ts` | `accounts.upsert`, `accounts.delete` ; `AccountInput`. |
| Backend | `packages/backend/src/handlers/accounts.ts` | `upsertAccount`, `defaultEuroFund`, `stopPlans`, `deleteUnusedEuroFund`, `euroFundOperations`. |
| Backend | `packages/backend/src/db/schema/accounts.ts` | Tables `accounts`, `institutions`. |
| Backend | `packages/backend/src/repo/mappers/accounts.ts` | `mapAccount`, `mapInstitution`, `parseProtection`. |

## Données

### Table `accounts`

`id`, `kind`, `livret_type`, `per_kind`, `name`, `institution_id` (`set null` à la suppression de l'établissement), `opened_on`, `deposit_ceiling_cents`, `rate`, `role`, `beneficiary_clause`, `entry_fee_rate`, `management_fee_rate`, `months_to_invest`, `in_allocation`, `default_asset_id` (`set null`), `share`, `sort_order`, `archived`.

Les réglages de protection sont dans la colonne JSON `institutions.protection` (`{ guarantor, country }`) ; le nom de l'assureur dans `institutions.offers.assurance_vie.insurer`.

### Procédures

| Procédure | Effet |
|---|---|
| `accounts.upsert` | Dans une transaction SQL : refuse un second PEA, PEA-PME, LEP, LDDS ou Livret A non archivé (`CONFLICT`) ; vérifie l'établissement ; refuse un changement de type si le compte a des opérations ; refuse le passage d'un PER en bancaire s'il a des opérations sur un fonds euros ; crée le fonds euros par défaut d'un nouveau contrat (`Fonds euros (<nom>)`) si `defaultAssetId` est absent ; ramène `share` à 1 si le compte ne peut pas être joint ; à l'archivage, appelle `stopPlans` ; pour un livret, enregistre le taux comme taux daté. |
| `accounts.delete` | Refusé (`CONFLICT`) si le compte a des opérations (comme compte ou comme destination) ou des projets de crowdlending ; sinon supprime, puis supprime son fonds euros par défaut s'il n'est plus utilisé. |

La page elle-même n'appelle aucune procédure : elle lit le workspace.

### Champs du `Workspace` utilisés

`accounts`, `assets`, `transactions`, `plans`, `skips`, `prices`, `statements`, `institutions`, `crowdProjects`, `properties`, `otherAssets`, `otherAssetValues`, `loans`, `params` (`targets`, `customClasses`, `livrets`, `alerts`, `profile`).

## Règles de calcul

### Par compte (`AccountState`)

- `cash` = espèces reconstituées du journal + `scheduledPaid` (s'il ne va pas à un fonds euros) − capital de crowdlending encore prêté.
- `value` = `cash` + Σ valeur des positions + valeur des projets de crowdlending en cours.
- `netContrib` = Σ apports + versements − retraits ± transferts + `scheduledPaid`.
- `gain` = `value − netContrib` ; la page affiche aussi `gain ÷ netContrib` quand `netContrib > 0`.
- `currentMonthly` = `Schedule.current(compte, asOf)`.

Lignes du tableau : comptes non archivés, ou archivés de valeur non nulle. `totals` porte sur les mêmes comptes, sans tenir compte de `share`. « Part du patrimoine » = `value / totals.value`.

### Allocation de la partie investie

`allocate(classe, montant × share)` pour : les espèces si `cashInAllocation` (choix du compte, sinon de sa classe `cashBucketOf`), chaque position si `positionInAllocation` (choix du titre, puis du compte, puis de la classe), chaque projet de crowdlending, chaque bien immobilier non archivé inclus, chaque autre bien rangé dans une classe personnalisée incluse. `invested` = Σ. Pour chaque classe : `share = value / invested`, `drift = share − target`, action `alleger` si `drift > driftAlert`, `renforcer` si `drift < −driftAlert` ou si `invested ≤ 0`, sinon `ok`.

Cibles : `classTargets(params, âge)`. En format retraite (`isRetirementPlan`), `etfTarget` fait baisser linéairement la cible `croissance` de `securisationAge` à `retirementAge`, jusqu'à `allocation.etfAtRetirement` ; l'écart va à `garanti` s'il est inclus, sinon à `obligations`. En format patrimoine, les cibles sont fixes. Âge = année − année de naissance (`ageInYear`).

### État des livrets

`livrets.total` = Σ valeur de tous les comptes `livret` (archivés compris). Statut `sous_plancher` si total < `params.livrets.floor`, `au_dessus` si total > `params.livrets.ceiling` (excédent = total − plafond), sinon `ok`.

### Concentration (`concentrationReport`)

Base = `netWorth.financial` (Σ `value × share` des comptes actifs). Titres regroupés d'un compte à l'autre, fonds euros exclus ; une obligation ne déclenche pas d'alerte sur sa ligne, elle est jugée par émetteur (`issuer`, sinon « État français » pour `bondKind = etat`, sinon son nom), et un émetteur d'État n'alerte pas. Plateformes de crowdlending regroupées par établissement, avec la valeur des projets `retard` ou `defaut`. Établissements sans alerte. Alerte quand `share > alerts.concentrationMax` et seuil > 0. `top1`, `top5` : parts des 1 et 5 premières lignes.

Décisions documentées dans `docs/propositions/gestion-de-patrimoine.md` (proposition sur la concentration).

### Protection (`protectionOf`)

Règles et sources citées dans `packages/core/src/model/protection.ts`, vérifiées le 2026-11-11 (`PROTECTION_VERIFIED_ON`) :

- dépôts : 100 000 € par personne et par établissement agréé (Code monétaire et financier, art. L312-4 et suivants) ;
- Livret A, LDDS, LEP : plafond distinct de 100 000 € ;
- titres non restituables : 70 000 € (CMF, art. L322-1) ;
- assurance-vie et PER assurance : `alerts.fgapGuarantee` (70 000 € par défaut), par assureur, tous contrats confondus (Code des assurances, art. L423-1) ;
- autre pays de l'UE : 100 000 € sur les dépôts (directive 2014/49/UE), 20 000 € au moins sur les titres (directive 97/9/CE, art. 4), pas de règle commune pour l'assurance ;
- crowdlending et crypto : aucune garantie.

Découpage d'un compte (`partsOf`, sur `value × share` et `cash × share`) : livret → `livrets` (LEP, LDDS, Livret A) ou `depots` ; PEA, PEA-PME, compte-titres et PER bancaire → `depots` (espèces) + `titres` (reste) ; assurance-vie et PER assurantiel → `assurance` ; épargne salariale → `separe` ; crowdlending et crypto → `aucune`. Un compte sans établissement → `inconnue`. Garant = assureur de l'offre assurance-vie pour une part `assurance`, sinon `protection.guarantor`, sinon le nom de l'établissement ; regroupement par `type|garant` normalisé (casse et espaces). `covered = min(montant, plafond)`, `uncovered = montant − covered`. Les comptes archivés de valeur nulle sont ignorés.

### Création et archivage

- `uniqueAccountConflict` : PEA et PEA-PME uniques ; LEP, LDDS et Livret A uniques ; un compte archivé ne compte pas.
- `canBeJoint` : compte-titres, plateforme crypto, livret de type `AUTRE`.
- `stopPlans` : si le compte a un plan non nul, supprime ses plans après le mois d'arrêt, puis pose un plan à 0 (« Compte archivé ») à partir du mois courant si son jour de prélèvement n'est pas passé, sinon du mois suivant.

## Tests

- `packages/core/src/portfolio/engine.test.ts` : transfert (valeur et versé net déplacés), allocation et action de rééquilibrage, part détenue d'un compte joint.
- `packages/core/src/model/protection.test.ts` : plafonds, PEA découpé, marques regroupées, assureur tous contrats confondus, UE, sans garantie, part détenue, PER bancaire ou assurantiel.
- `packages/core/src/analysis/concentration.test.ts` : regroupement, seuil, obligations par émetteur.
- `packages/core/src/model/validation.test.ts` (« comptes uniques ») et `packages/core/src/model/institutions.test.ts`.
- `packages/backend/src/backend.test.ts` : comptes uniques, archivage qui arrête les versements, établissement supprimé sans perdre le compte.
- `packages/backend/src/handlers/euroFunds.test.ts` : fonds euros créé avec un contrat, suppression d'un contrat vide, PER bancaire.
- `packages/ui/src/flows/suivi.flow.test.tsx` : bloc « mes comptes » (tableau, détail, allocation, livrets, concentration).
- `packages/ui/src/flows/reglages.flow.test.tsx` : blocs « paramètres › comptes » et « protection en cas de faillite ».

## Limites connues

- Le tableau et sa colonne « Part du patrimoine » portent sur les comptes entiers, alors que la concentration, la protection et l'allocation ne comptent que la part détenue des comptes joints. Les deux pourcentages peuvent donc différer pour un même compte.
- `livrets.total` (message d'état) compte les livrets archivés, mais la page Livrets n'affiche que les livrets actifs : un livret archivé qui garde un solde crée un écart entre les deux.
- La création et l'archivage d'un compte ne se font pas depuis cette page, mais depuis Paramètres › Comptes ou les pages de placement.
- La protection ne traite pas les comptes à plusieurs titulaires autrement que par `share`, ni les plafonds propres à chaque pays de l'UE au-delà du minimum européen pour les titres.
- `AccountDialog` n'offre aucun champ pour `sortOrder` : l'ordre des comptes suit leur nom.
