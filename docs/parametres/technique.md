# Paramètres : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| core | `packages/core/src/model/params.ts` | Schéma zod `PlanParams`, `defaultParams`, `withDefaultParams`, `normalizeParams`, `PlanParamsInput`, `MODULES` et `MODULE_LABELS`, `AssetClass`, `TargetLine`, valeurs dérivées (`etfTarget`, `classTargets`, `incomeTaxRate`, `taxRegimeLabel`, `retirementYear`, `classLabel`). |
| core | `packages/core/src/model/allocations.ts` | Allocations personnalisées (`AllocationRule`) et leurs contrôles (`allocationIssues`). |
| core | `packages/core/src/planning/allocationTargets.ts` | `targetRows` (lignes affichées de « Ma répartition cible ») et `targetsTotal`. |
| core | `packages/core/src/model/institutions.ts` | Établissements : `Offers`, `OrderFees`, `InstitutionTax`, `DEFAULT_OFFER_KINDS`, `emptyOffer`, `orderFee`, `embeddedOrderFee`, `defaultOrderFees`, `tradeFeeFor`, `institutionWithholds`. |
| api | `packages/api/src/system/procedures.ts` | `params.update`, `settings.get`, `settings.set`, `system.info`, `workspace.load`, clés `SettingKey`. |
| api | `packages/api/src/accounts/procedures.ts` | `institutions.upsert`, `institutions.delete`, `accounts.upsert`, `accounts.delete`. |
| api | `packages/api/src/assets/procedures.ts` | `assets.upsert`, `assets.delete`. |
| backend | `packages/backend/src/handlers/system.ts` | Handlers de `params.update`, `settings.*`, `system.info`. |
| backend | `packages/backend/src/handlers/accounts.ts` | Handlers des établissements et des comptes. |
| backend | `packages/backend/src/repo/params.ts` | `loadParams`, `saveParams`, clés `plan.parameters` et `prices.status`. |
| backend | `packages/backend/src/db/schema/system.ts` | Table `settings`. |
| backend | `packages/backend/src/db/schema/accounts.ts` | Table `institutions` (offres, fiscalité et protection en JSON). |
| ui | `packages/ui/src/features/settings/pages/Parametres/Parametres.tsx` | Page et onglets (`TABS`), lecture de `?onglet=`. |
| ui | `packages/ui/src/features/settings/pages/Parametres/PlanTab.tsx` | Onglet Plan. |
| ui | `packages/ui/src/features/settings/pages/Parametres/RepartitionTab.tsx` | Onglet Répartition et `CustomAllocations`. |
| ui | `packages/ui/src/features/settings/pages/Parametres/AccountsTab.tsx` | Onglet Comptes (fiche : `AccountDialog` de `packages/ui/src/features/entry`). |
| ui | `packages/ui/src/features/settings/pages/Parametres/AssetsTab.tsx` | Onglet Actifs. |
| ui | `packages/ui/src/features/settings/pages/Parametres/AppTab.tsx` | Onglet Application : `BackupCard`, `AppInfo`. |
| ui | `packages/ui/src/features/settings/pages/Parametres/usePlanDraft.tsx` | Brouillon partagé Plan/Répartition, `planFields`, `SaveBar`. |
| ui | `packages/ui/src/features/settings/pages/Parametres/Section.tsx` | Carte de section. |
| ui | `packages/ui/src/features/settings/lib/planDraft.ts` | `rebaseDraft`, `issueTabs`. |
| ui | `packages/ui/src/features/settings/pages/Etablissements.tsx` | Onglet Établissements : cartes, comparatifs, `DefaultFees`. |
| ui | `packages/ui/src/features/settings/dialogs/InstitutionDialog.tsx` | Fiche d'un établissement. |
| ui | `packages/ui/src/features/settings/dialogs/AssetDialog.tsx` | Fiche d'un titre. |
| ui | `packages/ui/src/features/settings/dialogs/AllocationDialog.tsx` | Fiche d'une allocation personnalisée. |
| ui | `packages/ui/src/features/settings/components/AllocationTargets.tsx` | Tableau « Ma répartition cible ». |
| ui | `packages/ui/src/features/settings/components/MarketSources.tsx` | Onglet Cours (voir [sources de cours](../sources-de-cours/technique.md)). |
| ui | `packages/ui/src/features/settings/components/AppearanceCard.tsx` | Thème (`ui.theme`). |
| ui | `packages/ui/src/app/layout/Shell.tsx` | Filtre le menu selon `params.modules` et `profile.goal` (`retirementOnly`). |
| ui | `packages/ui/src/shared/nav.ts` | Carte des pages : `module` et `retirementOnly` de chaque entrée, `SETTINGS_ITEM`. |

## Données

**Table `settings`** du tenant (clé, valeur JSON en texte, `updated_at`). Clés utilisées :

| Clé | Contenu | Écrite par |
|---|---|---|
| `plan.parameters` | `PlanParams` en JSON | `params.update` (`saveParams`) |
| `prices.status` | Dernier `PriceStatus` | `refreshPrices` |
| `ui.privacyMode`, `ui.theme`, `ui.lastRoute`, `ui.onboardingDone`, `import.formats`, `taxes.yearEnd` | Préférences et états d'interface | `settings.set` (liste fermée `SettingKey`) |
| `market.secrets` | Ancien emplacement d'une clé d'API, jamais exporté ni restauré | aucune écriture actuelle |

**Table `institutions`** : `id`, `name`, `kind` (`banque`, `courtier`, `assureur`, `crowdlending`, `crypto`), `website`, `score`, `comment`, `offers`, `tax`, `protection` (trois colonnes JSON validées par `Offers`, `InstitutionTax`, `InstitutionProtection`), horodatages. Les comptes y renvoient par `accounts.institution_id`.

**Procédures**

| Procédure | Entrée | Sortie | Remarque |
|---|---|---|---|
| `params.update` | `PlanParamsInput` | `PlanParams` | Remplace tous les paramètres. |
| `settings.get` / `settings.set` | `{ key: SettingKey }` / `{ key, value }` | valeur / rien | |
| `institutions.upsert` | `InstitutionInput` | `Institution` | |
| `institutions.delete` | `{ id }` | `ok` | Détache d'abord les comptes (`institution_id = null`). |
| `system.info` | rien | `SystemInfo` | Voir Règles. |

Les paramètres arrivent à l'interface dans `Workspace.params` (`workspace.load`).

**Sections de `PlanParams`** : `profile`, `returns`, `allocation`, `targets`, `livrets`, `broker`, `crypto`, `tax`, `modules`, `contributions`, `customAllocations`, `customClasses`, `removedTargets`, `alerts`, `rental` (biens en location : `coproRecoverable`, part de la copropriété récupérable proposée à la saisie ; `vacancyRate`, `worksRate`, `neutralBand`, `propertyTaxMonths` du cashflow ; `unfurnishedRegime`, `furnishedRegime`, `accountingFees`, `landShare` de l'impôt sur les loyers ; champs dans `packages/ui/src/features/settings/pages/Parametres/RentalSection.tsx`). Les taux sont des fractions (`0.128`), les montants des euros décimaux.

## Règles

- **Valeurs par défaut et anciennes données.** `withDefaultParams` complète les sections objets champ par champ (un niveau de profondeur) et reprend les listes telles quelles si elles sont présentes. `migrateTargets` convertit les anciens réglages (allocation à trois parts, classes prises sur une base, cibles posées sur des comptes) vers `targets` ; les cibles sur comptes retirées vont dans `removedTargets`, signalées une fois dans l'onglet Répartition. `normalizeParams` revient à `defaultParams` si le résultat reste invalide.
- **Enregistrement tolérant.** `PlanParamsInput` applique `withDefaultParams` avant validation : un champ absent (interface d'une version antérieure) prend sa valeur par défaut, un champ présent mais invalide est refusé.
- **Contrôles croisés** (`superRefine`) : relances de loyer dans l'ordre ; en mode retraite, sécurisation ≤ départ, horizon > départ, `etfAtRetirement` ≤ cible `croissance` ; règles d'allocation (`allocationIssues`) ; total des lignes incluses ≤ 100 % ; plancher ≤ plafond des livrets. L'interface ajoute un contrôle « total = 100 % » sur les lignes actives (`targetsTotal(targetRows(...))`, tolérance 0,05 point), clé `targets.total`.
- **Brouillon partagé.** `usePlanDraft` garde un brouillon commun aux onglets Plan et Répartition. Quand les paramètres changent sur le serveur (par exemple les frais par défaut enregistrés depuis l'onglet Établissements), `rebaseDraft` reprend la version du serveur pour chaque section que l'utilisateur n'a pas modifiée. `issueTabs` nomme l'onglet de chaque erreur : `livrets.driftAlert` et les sections `targets`, `allocation`, `customAllocations`, `customClasses` sont rangés dans Répartition.
- **Rendements.** Les quatre classes de base (`precaution`, `garanti`, `obligations`, `croissance`) lisent et écrivent leur rendement dans `returns` (`livrets`, `fondsEuros`, `obligations`, `actions`) ; les autres lignes utilisent `targets[].expectedReturn`, facultatif.
- **Lignes affichées.** `targetRows` montre une classe de base si elle est détenue (compte, titre, projet de crowdlending ou bien non archivés) ou cochée ; une classe personnalisée est toujours montrée. Une ligne non incluse mais dont des éléments sont inclus un par un reste active (`included`).
- **Part d'actions avec l'âge.** `etfTarget` baisse linéairement entre `securisationAge` et `retirementAge` ; `classTargets` reporte la part libérée sur `garanti`, sinon sur `obligations`.
- **Imposition retenue.** `incomeTaxRate` = min(`tmi`, `pfuIncomeTax`).
- **Modules.** Masquer un module ne change que le menu (`Shell.tsx`). En mode patrimoine, les entrées `retirementOnly` de `nav.ts` (aujourd'hui la Projection) disparaissent aussi.
- **Frais.** `tradeFeeFor` : crypto → `offers.crypto.tradeFee` de l'établissement, sinon `params.crypto.feeRate` ; PEA, PEA-PME, CTO → `offers.pea` ou `offers.cto`, sinon `defaultOrderFees(params)` (un palier unique à `broker.feeRate`, minimum `broker.minFee`). `orderFee` prend le premier palier dont `upTo` couvre l'ordre, puis applique minimum et maximum, arrondi au centime.
- **Création d'un établissement.** Le type pré-coche `DEFAULT_OFFER_KINDS` ; changer le type d'une fiche existante ne touche plus aux offres. Une fiche d'avant le réglage commun voit son ancien taux de plateforme de crowdlending converti en taux retenus (`InstitutionDialog`).
- **`system.info` et chemins du serveur.** Les champs `databasePath` et `backupsDir` ne contiennent aucun chemin : `databasePath` reçoit `displayPath` (« Base PostgreSQL de l'instance »), `backupsDir` une phrase ou `null`.
- **Liens directs.** `?onglet=<nom d'onglet>` ouvre l'onglet ; `?onglet=Établissements&nouveau=1` ouvre la création d'un établissement.

## Tests

- `packages/core/src/model/params.test.ts` : valeurs par défaut, baisse linéaire de la part d'actions, barème, contrôles, complétion de paramètres partiels, mode patrimoine, reprise des anciens réglages, modules.
- `packages/core/src/model/allocations.test.ts` : allocations personnalisées.
- `packages/core/src/model/institutions.test.ts` : établissements et frais.
- `packages/backend/src/backend.test.ts` : « valide les paramètres », « accepte des paramètres d'une interface plus ancienne ».
- `packages/ui/src/features/settings/lib/planDraft.test.ts` : `rebaseDraft`, `issueTabs`.
- `packages/ui/src/flows/reglages.flow.test.tsx` (environnement jsdom) : blocs « établissements », « paramètres › comptes », « paramètres › plan et répartition », « paramètres › actifs », « paramètres › application ».

## Limites connues

- Les champs `tax.avAllowanceCouple`, `tax.pfuIncomeTax`, `alerts.stressEquity` et `alerts.stressCrypto` sont dans `PlanParams` mais n'ont pas de champ dans la page Paramètres. `contributions.mode` se règle dans `packages/ui/src/features/journal/pages/Versements.tsx`.
- Le libellé `taxRegimeLabel` écrit « Flat tax 12,8 % » en dur, quelle que soit la valeur de `pfuIncomeTax`.
- `withDefaultParams` ne fusionne qu'un niveau : un champ ajouté plus profondément dans une section devra être repris à la main dans `migrateTargets` ou une fonction équivalente.
- La page `Parametres.tsx` ne sépare que les onglets ; `Etablissements.tsx` reste dans `pages/` à côté du dossier `Parametres/`, et l'onglet Cours vit dans `components/MarketSources.tsx`.
