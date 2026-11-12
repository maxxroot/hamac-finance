# Exposition réelle : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, page | `packages/ui/src/features/analysis/pages/Exposition.tsx` | Appelle `exposure.load`, relit toutes les 4 s tant qu'une composition est attendue (30 fois au plus), calcule `portfolioExposure`, affiche chiffres, barres, plus grosses lignes et tableau des ETF. |
| UI, dialogue | `packages/ui/src/features/analysis/dialogs/EquivalentDialog.tsx` | Choix d'un ETF physique équivalent (`exposure.choose`), proposition, retrait du choix. |
| UI, logique testable | `packages/ui/src/features/entry/lib/exposure.ts` | `EXPOSURE_KEY`, libellés (pays, secteurs, devises, types), `withOthers`, `summariesByAsset`, `hasPending`, `compositionStatus`, `lookupPending`, `lookupMessage`. |
| UI, saisie d'un titre | `packages/ui/src/features/entry/components/CompositionNotice.tsx` | Message affiché dès qu'un ISIN d'ETF est saisi (`exposure.lookup`, relu toutes les 3 s, 20 fois au plus). |
| UI, administration | `packages/ui/src/features/settings/components/CompositionAdminCard.tsx` | Paramètres › Cours : échecs de téléchargement et liens communs (`exposure.admin`, `exposure.adminLink`). |
| UI, tableau de bord | `packages/ui/src/features/dashboard/pages/TableauDeBord.tsx` | Compte les échecs (`exposure.admin`) pour l'alerte de l'administrateur. |
| Core, règles | `packages/core/src/analysis/exposure.ts` | Harmonisation (`sectorFromLabel`, `countryCode`, `currencyCode`), `summarizeComposition`, `EQUIVALENT_REFERENCES`, `suggestEquivalent`, `usableComposition`, `resolveComposition`, `isinCountry`, `portfolioExposure`. |
| Core, alertes | `packages/core/src/alerts/alerts.ts` | Alerte `compositions-echecs`. |
| API | `packages/api/src/exposure/procedures.ts` | Procédures `exposure.*` et types `EtfExposure`, `ExposureData`, `CompositionLookup`, `CompositionAdmin`, `EquivalentSuggestion`. |
| Backend, handlers | `packages/backend/src/handlers/exposure.ts` | Branche les procédures sur `market/compositions/exposure.ts`. |
| Backend, service | `packages/backend/src/market/compositions/exposure.ts` | `loadExposure`, `lookupComposition`, `chooseEquivalent` (vérification, lien commun), `compositionAdmin`, `setAdminLink`, `assetSaved`. |
| Backend, stockage | `packages/backend/src/market/compositions/compositionStore.ts` | `CompositionStore` : tables `marche.compositions` et `marche.composition_links`, file de téléchargement, délais, ménage. |
| Backend, téléchargement | `packages/backend/src/market/compositions/composition.ts` | Lecture Amundi (API produit) et iShares (recherche, CSV des lignes, page produit), réplication, `findComposition`, `fetchComposition`. |
| Backend, boucle | `packages/backend/src/market/shared.ts` | `SharedMarket.compositions`, `collectCompositionIsins`, `refreshCompositions` dans la boucle de l'instance. |
| Backend, titres | `packages/backend/src/handlers/assets.ts` | Appelle `assetSaved` à l'enregistrement d'un titre. |
| Base du tenant | `packages/backend/src/db/schema/assets.ts` | Colonne `assets.composition_isin` (choix propre à l'utilisateur). |
| Serveur | `apps/server/src/http/app.ts` | Démarre la boucle de l'instance si `HAMAC_PRICES` ≠ `0`. |

## Données

- **Procédures** (`packages/api/src/exposure/procedures.ts`) :
  - `exposure.load` → `ExposureData` : pour chaque ETF non archivé avec ISIN, `own`, `choice`, `link`, `used`, `gap`, `suggestion`, et les résumés des compositions utilisées par ISIN. Lance en tâche de fond les téléchargements dus.
  - `exposure.lookup({ isin })` → `CompositionLookup` : état de la composition d'un ETF qu'on saisit, et du lien commun s'il existe. Lance aussi le téléchargement.
  - `exposure.choose({ assetId, proxyIsin })` : enregistre (ou retire, `null`) l'équivalent choisi, après vérification.
  - `exposure.admin` → `CompositionAdmin` : `canEdit`, liens communs avec noms, échecs. Vide pour un compte qui n'est pas administrateur.
  - `exposure.adminLink({ isin, proxyIsin })` : remplace ou supprime un lien commun ; refusé (`UNAUTHORIZED`) hors administrateur.
- **Champs du `Workspace` lus** : `accounts` (dont `share`), `assets`, `transactions`, `prices`, via `PortfolioState` (`usePortfolio`). Les compositions ne passent pas par le `Workspace` : elles ont leur propre requête (clé `EXPOSURE_KEY`), qui ne recharge pas l'espace de travail.
- **Tables** :
  - tenant : `assets` (`kind = 'etf'`, `isin`, `archived`, `composition_isin`) ; le choix est dans les sauvegardes ;
  - instance, schéma `marche` (inaccessible aux rôles des tenants) : `compositions` (`isin`, `issuer`, `issuer_id`, `fund_name`, `replication`, `as_of`, `lines` en JSON, `line_count`, `checked_at`, `fetched_at`, `message`, `failed`) et `composition_links` (`isin`, `proxy_isin`, `created_at`). Un lien ne dit pas qui l'a créé.

## Règles de calcul

**État d'une composition** (`toInfo`) : `ok` si `fetched_at` existe (même si la dernière mise à jour a échoué : `message` est alors rempli) ; `failed` si l'échec n'a jamais donné de composition ; `pending` si l'émetteur est connu mais rien n'est encore téléchargé, ou si l'ISIN n'a jamais été demandé ; `unknown` si aucun émetteur géré ne connaît l'ISIN.

**Composition utilisée** (`resolveComposition`), dans l'ordre :

1. le choix de l'utilisateur (`composition_isin`) : sert s'il est `ok`, sinon `equivalent-pending` ou `equivalent-failed` ;
2. la composition propre, si `usableComposition` (`ok` et pas `synthetique`) ;
3. le lien commun (`marche.composition_links`), mêmes règles que le choix ;
4. sinon un manque : `synthetic` (composition connue mais synthétique), `pending`, `unknown` ou `failed`.

**Équivalent proposé** (`suggestEquivalent`) : seulement si la composition propre ne sert pas. Première expression régulière de `EQUIVALENT_REFERENCES` qui correspond au nom chez l'émetteur, puis au nom saisi ; jamais l'ETF lui-même. Les références les plus précises passent d'abord (« MSCI World Small Cap » avant « MSCI World »). Le code indique une vérification de chaque référence le 12 novembre 2026.

**Vérification d'un équivalent** (`verifyEquivalent`) : différent de l'ETF, téléchargé tout de suite si besoin (`ensure`), état `ok`, réplication `physique` (ni synthétique, ni inconnue). Chaque refus a son message.

**Lien commun** (`chooseEquivalent`) : après un choix vérifié, `setLink(isin, proxy)` sans écrasement, et seulement si la composition propre de l'ETF ne sert pas telle quelle. Le premier lien est donc gardé ; seul l'administrateur peut le remplacer (`overwrite = true`) ou le supprimer.

**Résumé** (`summarizeComposition`) : poids divisés par leur somme ; répartitions par type, pays, secteur, devise (clé vide pour une ligne sans valeur) ; `top` = 30 plus grosses lignes d'actions et d'obligations de poids positif.

**Harmonisation** : pays (noms anglais relevés chez Amundi et iShares le 11 novembre 2026) → code ISO 3166-1 alpha-2, une zone ou un tiret → `null` ; secteurs GICS et secteurs d'obligations iShares → liste fixe `SECTORS`, inconnu → `autre` ; devise → code ISO 4217 à trois lettres ou `null`.

**Exposition du portefeuille** (`portfolioExposure(state, summaries, 15)`) :

- titres `etf` et `action` de tous les comptes, valeur × `account.share` ;
- un ETF avec résumé : sa valeur multipliée par chaque poids de chaque répartition ; ses lignes `top` ajoutées aux plus grosses lignes ;
- une action en direct : pays `isinCountry(isin)` (préfixe de l'ISIN, sauf `XS`, `EU`, `XA`, `XB`, `XC`, `XD`, `QS`, `QT`), secteur et devise vides, type `action`, ligne « en direct » ;
- un ETF sans résumé : compté dans `total` mais pas dans `covered` ;
- parts rapportées à `covered` ; lignes regroupées par ISIN, sinon par nom normalisé (minuscules, espaces réduits) ; 15 lignes gardées.

L'UI coupe les pays après 10 et les devises après 8 (`withOthers`).

**Téléchargement** (`composition.ts`) : Amundi d'abord, puis iShares ; `null` si aucun ne connaît l'ISIN, erreur seulement si aucun n'a pu répondre. On garde l'émetteur et son identifiant, jamais une adresse : les adresses sont reconstruites à partir d'hôtes fixes (l'identifiant iShares est contrôlé, 1 à 10 chiffres). Le code précise que ces adresses ne sont pas documentées et ont été vérifiées le 11 novembre 2026. Un fonds iShares sans page lisible est reconnu synthétique à sa ligne d'indice et à un total d'environ 200 % (`looksSynthetic`).

**Délais** (`compositionStore.ts`) :

| Constante | Valeur | Effet |
|---|---|---|
| `COMPOSITION_MAX_AGE_MS` | 92 jours | Remise à jour d'une composition connue. |
| `COMPOSITION_RETRY_MS` | 6 heures | Nouvel essai après un échec. |
| `COMPOSITION_UNKNOWN_RETRY_MS` | 30 jours | Nouvelle recherche d'un ISIN inconnu des émetteurs. |
| `MAX_QUEUE` | 100 | ETF en attente dans la file à la demande. |
| `spacingMs` | 1 s par défaut | Pause entre deux téléchargements. |

En cas d'échec, la dernière composition connue est gardée (`failed = TRUE`, `message`). Un ETF que l'émetteur ne publie plus est traité comme un échec.

**Boucle de l'instance** (`SharedMarket.start`) : à chaque tour, après les cours, `refreshCompositions` relève les ETF non archivés de chaque tenant et leur choix, ajoute les équivalents des liens communs, met à jour au plus 20 compositions dues, puis oublie celles que personne ne détient ni ne référence et qui ont plus d'un trimestre (`prune`). Avec `HAMAC_PRICES=0`, la boucle ne tourne pas : les compositions ne sont demandées qu'à l'ouverture de la page ou à la saisie d'un ISIN.

## Tests

- `packages/core/src/analysis/exposure.test.ts` : harmonisation des pays, secteurs et devises ; résumé ; équivalent proposé ; composition utilisée et raisons d'un manque.
- `packages/core/src/analysis/exposurePortfolio.test.ts` : répartition du portefeuille, comptes joints, actions en direct par l'ISIN, regroupement d'une ligne par ISIN, portefeuille sans composition.
- `packages/ui/src/features/entry/lib/exposure.test.ts` : libellés, regroupement « Autres », état de chaque ETF, message à la saisie d'un ETF.
- `packages/ui/src/features/analysis/exposition.flow.test.tsx` : page complète (ETF physique, synthétique, équivalent proposé, refus d'un équivalent synthétique, annonce à la saisie, carte de l'administrateur, rien pour un autre utilisateur).
- `packages/backend/src/market/compositions/composition.test.ts` : lecture des formats Amundi et iShares, réplication, téléchargement, adresse impossible à détourner.
- `packages/backend/src/market/compositions/compositionStore.test.ts` : téléchargement unique, échecs gardés et réessayés, ISIN inconnu, lien commun, boucle de l'instance.
- `packages/backend/src/market/compositions/exposure.test.ts` : de bout en bout par `dispatch` (faux émetteur `amundiFake` de `packages/backend/src/testkit.ts`), vérification de l'équivalent, lien commun partagé, droits de l'administrateur, sauvegarde du choix.
- `packages/core/src/alerts/alerts.test.ts` : alerte des compositions en échec.

## Limites connues

- Seuls Amundi et iShares sont lus, par des adresses non documentées.
- `exposure.load` ne renvoie que les ETF non archivés avec ISIN. Un ETF encore détenu mais sans entrée dans la réponse affiche « Sans ISIN : ajoutez-le… », y compris s'il a un ISIN mais est archivé (cas non vérifié en pratique).
- Les actions en direct n'ont ni secteur ni devise ; leur pays est déduit de l'ISIN.
- Les plus grosses lignes ne voient que les 30 premières lignes de chaque ETF : une entreprise présente sous ce rang dans plusieurs ETF peut être sous-estimée.
- Le regroupement par nom des lignes iShares est fragile (variantes d'écriture).
- La devise est celle de cotation, pas l'exposition de change d'une part couverte.
- La note de bas de page dit les compositions « mises à jour chaque trimestre » ; c'est vrai pour la boucle de l'instance, mais avec `HAMAC_PRICES=0` la remise à jour n'a lieu qu'à l'ouverture de la page.
