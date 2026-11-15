# Actions & ETF : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/actions`, module `actions` (`MODULES` dans `packages/core/src/model/params.ts`). Le même module commande la page Exposition réelle (`/exposition`). Aucune différence entre les formats `retraite` et `patrimoine`.

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/investments/pages/Actions/Actions.tsx` | La page, tous comptes confondus : choix des comptes, chiffres d'ensemble, cartes baisse, achat conseillé, parts cibles, mouvements. |
| UI | `packages/ui/src/features/investments/pages/Actions/_PositionsTable.tsx` | Le tableau : une ligne par titre et par compte (clé `accountId:assetId`), part sur l'ensemble, saisie du cours, évolution dépliée. |
| UI | `packages/ui/src/features/investments/pages/Actions/_AccountStrip.tsx` | Le bandeau des comptes concernés, chacun lié à sa page (`AccountLink`). |
| UI | `packages/ui/src/features/investments/pages/Actions/_TargetsCard.tsx` | Carte « Parts cibles » : part réelle par titre, toutes lignes additionnées. |
| UI | `packages/ui/src/features/investments/pages/Actions/_listed.ts` | `listed` (classes `croissance` et `matieres_premieres`), types de titres et de comptes proposés à l'achat. |
| UI | `packages/ui/src/features/entry/components/AdvisedPurchaseCard.tsx` | Carte « Achat conseillé ce mois-ci », partagée avec la page du compte. |
| UI | `packages/ui/src/shared/components/AccountLink.tsx` | Nom d'un compte cliquable vers `/comptes/:id` (voir [Mes comptes](../comptes/technique.md)). |
| UI | `packages/ui/src/features/investments/dialogs/PriceDialog.tsx` | Saisie d'un cours à la main (`prices.setManual`), partagée avec la page Crypto. |
| UI | `packages/ui/src/features/investments/index.ts` | Façade du domaine (`Actions`, `Obligations`, `Crypto`, `Crowdlending`). |
| UI | `packages/ui/src/shared/nav.ts` | Entrée de menu, description, module. |
| UI | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio` : `computePortfolio` mémoïsé par espace de travail et par jour. |
| UI | `packages/ui/src/shared/components/AccountEvolution.tsx` | `AccountEvolution`, `PositionEvolution`, `EvolutionToggle` (courbes tirées de `buildHistory`). |
| UI | `packages/ui/src/features/entry/components/Movements.tsx` | Mouvements du compte, repris du journal, filtrables par type de titre. |
| UI | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx`, `packages/ui/src/features/entry/dialogs/NewAssetPanel.tsx` | Saisie d'un achat et création du titre au moment de l'achat. |
| UI | `packages/ui/src/features/entry/dialogs/AccountDialog.tsx` | Champ `monthsToInvest`, proposé seulement pour `kind === "pea"` (12 par défaut). |
| UI | `packages/ui/src/features/settings/dialogs/AssetDialog.tsx` | Fiche d'un titre : source du cours, part cible (`targetWeight`), frais annuels (`ter`). |
| Core | `packages/core/src/portfolio/engine.ts` | `computePortfolio` (positions, PRU, valeur), `advisedMonthlyPurchase`, `splitByTarget`, `monthsElapsed`, `fiscalAnniversary`. |
| Core | `packages/core/src/model/prices.ts` | `PriceBook` : règle unique du dernier cours connu. |
| Core | `packages/core/src/model/institutions.ts` | `tradeFeeFor`, `describeOrderFees`, `suggestTradeFee` : grille de courtage. |
| Core | `packages/core/src/model/domain.ts` | `ASSET_BUCKET` : `etf`, `action`, `fonds` → classe `croissance`. |
| Core | `packages/core/src/model/validation.ts` | `ALLOWED_ASSETS` : titres permis par type de compte. |
| Core | `packages/core/src/planning/contributions.ts` | `proposeContributions` (page Versements) : la classe `croissance` vise les comptes `pea` et `pea_pme`. Pas utilisé par cette page. |
| API | `packages/api/src/assets/procedures.ts`, `packages/api/src/assets/inputs.ts` | `assets.upsert`, `prices.setManual` (`ManualPriceInput`), `prices.refresh`, `assets.search`. |
| Backend | `packages/backend/src/handlers/assets.ts` | Handlers des titres et des cours. |
| Backend | `packages/backend/src/prices/refresh.ts` | Actualisation des cours d'un tenant. |
| Backend | `packages/backend/src/market/index.ts` | `chainFor`, `supports`, `DEFAULT_PROVIDER_ORDER` (justetf, euronext, twelvedata, yahoo, coingecko). |
| Backend | `packages/backend/src/market/merge.ts` | `mergePrices` : manuel > commun > historique propre, dernier cours du mois. |
| Backend | `packages/backend/src/repo/loadWorkspace.ts` | Chargement de `Workspace.prices` allégé. |

## Données

Tables (schéma du tenant) :

- `accounts` (`packages/backend/src/db/schema/accounts.ts`) : `kind` (`pea`, `pea_pme`, `cto`, `assurance_vie`, `per`, `epargne_salariale`), `opened_on`, `institution_id`, `months_to_invest`.
- `assets` (`packages/backend/src/db/schema/assets.ts`) : `kind`, `isin`, `symbol`, `price_source`, `price_provider`, `manual_price`, `manual_price_date`, `target_weight`, `ter`.
- `prices` (même fichier) : un cours par titre et par jour, `source = "manuel"` pour un cours saisi.
- `transactions` (`packages/backend/src/db/schema/journal.ts`) : achats, ventes, dividendes, versements.

Les cours cotés communs à l'instance sont dans `marche`, lus par `SharedMarket` (`packages/backend/src/market/shared.ts`) et fusionnés au chargement.

Procédures utilisées : `prices.setManual` (met à jour `assets.manual_price` et écrit une ligne `prices` en `manuel`, avec écrasement à date égale), `transactions.*` via les fenêtres de saisie, `accounts.upsert`, `assets.upsert`.

Champs du `Workspace` (`packages/api/src/system/procedures.ts`) : `accounts`, `assets`, `transactions`, `plans`, `skips`, `prices`, `institutions`, `params` (`alerts.peaCashThreshold`, `alerts.stressEquity`, `broker`, `profile.startMonth`). `Workspace.prices` ne garde que le dernier cours de chaque mois pour ces titres.

## Règles de calcul

**Comptes affichés.** Non archivés ; PEA, PEA-PME et CTO toujours ; assurance-vie, PER et épargne salariale seulement s'ils ont une position `listed` (classe `croissance` ou `matieres_premieres`). Un CTO sans position `listed` a une carte « aucune action » avec un bouton d'achat.

**Lignes.** Toutes les positions `listed` de ces comptes, une par couple (compte, titre) : rien n'est additionné entre comptes dans le tableau.

**Positions** (`computePortfolio`). Les événements sont triés par date puis par rang (`RANK`) : versements avant ventes, ventes avant achats. Achat : `qty += quantity`, `cost += amount` (montant frais compris). Vente ou arbitrage sortant (`takeOut`) : le prix de revient sort au prorata de la quantité, `realized += proceeds − costOut`. Une vente supérieure à la quantité détenue ajoute un avertissement. `pru = cost / qty`.

**Valorisation** (`valuePosition`, hors obligation et fonds euros). `PriceBook.at(assetId, asOf)` donne le dernier point à date ≤ `asOf`. À date égale, le point `manuel` est trié en dernier, donc retenu. Le cours manuel de la fiche (`manualPrice`, daté `manualPriceDate`, ou `1900-01-01` sans date) est ajouté s'il n'est pas déjà dans l'historique. `priceUsed` : `manuel`, `marche`, ou `cout` sans cours (valeur = prix de revient). `gain = value − cost`, `gainPct = gain / cost`.

**Compte.** `value = espèces + positions`, `netContrib = apports + versements + versements programmés payés − retraits ± transferts`, `gain = value − netContrib`. `fees` additionne les opérations `frais`, les frais inclus des achats et ventes, et ceux des arbitrages.

**Part** (tableau) : `p.value / Σ value de toutes les lignes`. **Parts cibles** (carte) : pour chaque titre de `targetWeight > 0` ou détenu, `Σ value de ses lignes / Σ value de toutes les lignes` ; **écart** = part réelle − `targetWeight`. La cible étant globale, la comparaison se fait sur l'ensemble des comptes.

**Achat conseillé.**

- `monthsElapsed(params, asOf)` = `monthsBetween(startMonth-01, asOf) + 1` (0 avant le début). Commentaire du code : Paramètres!B12 du sheet d'origine.
- `advisedMonthlyPurchase(cash, monthsToInvest, elapsed)` : 0 si `cash ≤ 0` ; `n = monthsToInvest ?? 1` ; si `elapsed ≥ n`, tout `cash` ; sinon `cash / max(1, n − elapsed)`. Commentaire du code : Actions!B17.
- `splitByTarget(amount, positions)` : seulement les titres de cible > 0 ; `totalAfter = Σ value + amount` ; écart `gap = max(0, target × totalAfter − value)` ; chaque titre reçoit `amount × gap / Σ gap` (à parts égales si tous les écarts sont nuls).
- Les titres passés à `splitByTarget` sont **tous** les titres actifs `etf`, `etc`, `action` ou `fonds` qui ont une `targetWeight`, avec la valeur qu'ils ont dans ce PEA (0 s'il ne les détient pas). Une carte par PEA ou PEA-PME.

**Baisse simulée.** `−d × Σ value des lignes`, pour `d` dans `params.alerts.stressEquity` (défaut `[0.3, 0.5]`). Part rapportée à `state.totals.value` (somme des comptes, sans immobilier ni autres biens).

**Frais.** TER annuel : `Σ value × ter`. Courtage payé : `Σ positionTotals[].fees` des titres `etf`, `etc`, `action`, `fonds` de ces comptes (titres vendus compris). La grille de courtage (`tradeFeeFor`) est sur la page du compte.

**Espèces à investir.** `Σ cash` des PEA, PEA-PME et CTO. Ton `warning` si les espèces des PEA seules atteignent `params.alerts.peaCashThreshold` (défaut 50 €), `negative` si le total est `< −0,01`.

**Mouvements.** `Movements` sur tous ces comptes, `assetKinds` = `etf`, `etc`, `action`, `fonds`, `withCash = false`, 20 lignes.

**Cours.** `chainFor` : rien pour un titre `price_source ≠ auto` ; sinon l'adresse personnalisée, puis les sources activées de l'instance qui couvrent le titre (justETF pour ETF et fonds avec ISIN, Euronext avec ISIN, Twelve Data avec symbole et clé, Yahoo avec symbole). Actualisation automatique au démarrage puis selon le quota des sources (`autoRefreshPrices`, coupée par `HAMAC_PRICES=0`), ou à la demande (`prices.refresh`, une seule à la fois).

Aucune règle fiscale n'est calculée sur cette page (la plus-value du compte-titres est dans `packages/core/src/portfolio/securitiesGains.ts`, utilisée par la page Impôts).

## Tests

- `packages/core/src/portfolio/engine.test.ts` : valeur et gain d'un PEA, frais de courtage, règle des 5 ans, « achat conseillé : espèces étalées sur les mois restants », « répartition d'un achat selon les parts cibles », vente supérieure à la quantité détenue, registre des cessions au coût moyen.
- `packages/core/src/portfolio/arbitrage.test.ts` : arbitrage entre supports (pas dans un PEA).
- `packages/ui/src/flows/placements.flow.test.tsx`, bloc « Actions & ETF » : bandeau des comptes, positions, parts cibles, achat conseillé, cours manquant puis saisi ; PEA et CTO qui détiennent le même ETF (deux lignes, cible sur l'ensemble, lien vers la page du compte) ; tri et dépliage ; compte-titres sans action ; assurance-vie investie en ETF. Bloc « Nouveau titre à l'achat » et « Fiche d'un titre ».
- `packages/backend/src/backend.test.ts` : « espace de travail : cours quotidiens pour la crypto, dernier du mois pour le reste ».
- `packages/backend/src/market/merge.test.ts` : fusion des cours.

## Limites connues

- Les parts cibles sont globales, pas par compte : l'achat conseillé d'un PEA se répartit aussi vers des titres qu'il ne détient pas, et vers des titres qui ne peuvent pas être dans un PEA s'ils ont une cible.
- `monthsToInvest` n'est saisissable que pour `pea` ; un `pea_pme` prend `?? 1`, donc toutes ses espèces sont conseillées d'un coup.
- Le décompte des mois part de `profile.startMonth`, pas de la date d'ouverture du compte.
- `stressEquity` n'a pas de réglage dans l'interface.
- La part « du patrimoine » est celle de `state.totals.value` (comptes financiers seulement), pas de `netWorth.net`.
- Le tableau ne regroupe pas un titre détenu dans plusieurs comptes (choix de l'utilisateur, 2026-11-15) : la carte « Parts cibles » fait l'addition.
