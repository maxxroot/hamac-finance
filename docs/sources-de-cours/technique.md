# Sources de cours : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| core | `packages/core/src/model/domain.ts` | `PRICE_PROVIDERS`, `PRICE_PROVIDER_LABELS`, champs de cours d'un `Asset` (`priceSource`, `priceProvider`, `priceUrl`, `pricePath`, `manualPrice`, `manualPriceDate`). |
| core | `packages/core/src/model/prices.ts` | `PriceBook` : dernier cours connu à une date, cours manuel prioritaire à date égale. |
| api | `packages/api/src/assets/procedures.ts` | `prices.setManual`, `prices.refresh`, `market.settings`, `market.configure`, `market.series`, `assets.search` ; types `PriceStatus`, `MarketSettings`. |
| api | `packages/api/src/assets/inputs.ts` | `ManualPriceInput`, `AssetInput`. |
| backend | `packages/backend/src/market/index.ts` | Chaîne de sources : `DEFAULT_PROVIDER_ORDER`, `supports`, `chainFor`, `instrumentKey`, `isPersonal`, `fetchFrom`, `fetchLongHistory`, `searchAssets`. |
| backend | `packages/backend/src/market/shared.ts` | `SharedMarket` : schéma `marche`, ordre des sources, actualisation commune, boucle de l'instance, historiques longs (`series`), IRL. |
| backend | `packages/backend/src/market/config.ts` | `normalizeOrder`, `twelveDataAssets`, `readSetting`/`writeSetting`, `MARKET_SECRETS_KEY`. |
| backend | `packages/backend/src/market/merge.ts` | `mergePrices`. |
| backend | `packages/backend/src/market/plausible.ts` | `assertPlausible`. |
| backend | `packages/backend/src/market/http.ts` | `Fetcher` injectable, `defaultFetcher` (délai 15 s), `MarketError`, `getJson`. |
| backend | `packages/backend/src/market/sources/` | Un fichier par source : `justetf`, `euronext`, `twelvedata`, `yahoo`, `coingecko`, `custom`, `openfigi` (recherche), `irl`. |
| backend | `packages/backend/src/prices/refresh.ts` | `refreshPrices` : actualisation d'un tenant, adresses personnalisées, `PriceStatus`. |
| backend | `packages/backend/src/repo/loadWorkspace.ts` | Lit les cours du tenant et de `marche`, appelle `mergePrices`. |
| backend | `packages/backend/src/handlers/assets.ts` | Handlers des procédures ci-dessus, `marketSettings`. |
| backend | `packages/backend/src/index.ts` | `startBackend` : file des appels, `prices.refresh` hors file, minuterie par tenant. |
| server | `apps/server/src/main.ts` | Lit `HAMAC_TWELVEDATA_KEY`, `HAMAC_TWELVEDATA_DAILY_LIMIT`, `HAMAC_REFRESH_MINUTES`, `HAMAC_PRICES`. |
| server | `apps/server/src/http/app.ts` | Ouvre `SharedMarket`, lance `market.start` si `autoRefreshPrices`, passe `isAdmin` à chaque backend. |
| ui | `packages/ui/src/features/settings/components/MarketSources.tsx` | Onglet Paramètres › Cours. |
| ui | `packages/ui/src/app/components/PriceStatus.tsx` | Bouton d'état des cours de la coquille. |
| ui | `packages/ui/src/features/investments/dialogs/PriceDialog.tsx` | Saisie d'un cours à la main. |
| ui | `packages/ui/src/features/settings/dialogs/AssetDialog.tsx` | Source, fournisseur, adresse et chemin du prix d'un titre. |

## Données

**Schéma `marche`** (créé par `SharedMarket.open`, aucun droit pour les rôles des tenants) :

| Table | Contenu |
|---|---|
| `marche.instruments` | Un titre de l'instance par `key` (`instrumentKey`) : `kind`, `isin`, `symbol`, `priceProvider`, dernière source (`provider`), `last_date`, `checked_at`, `message`, `failed`, `tried` (JSON des échecs). |
| `marche.quotes` | Cours par `(key, date)` : `price`, `source`. |
| `marche.config` | Clés `order` (ordre des sources), `usage` (compteur Twelve Data du jour), `irl`. |
| `marche.series`, `marche.series_points` | Historiques longs pour les comparaisons, à part des cours qui valorisent les positions. |
| `marche.compositions`, `marche.composition_links` | Compositions d'ETF (hors sujet ici). |

**Tables du tenant** : `prices` (`asset_id`, `date`, `price`, `source`), qui contient les cours manuels (`source = 'manuel'`), les cours des adresses personnalisées et l'historique restauré d'une sauvegarde ; `assets` (colonnes de cours) ; `settings` clé `prices.status`.

**Procédures**

| Procédure | Rôle | Droits |
|---|---|---|
| `prices.setManual` | Écrit `assets.manual_price`/`manual_price_date` et une ligne `prices` `manuel` (upsert sur `(asset_id, date)`). | Tout tenant |
| `prices.refresh` | `refreshPrices` ; une seule à la fois par backend, hors de la file des appels. | Tout tenant |
| `market.settings` | `MarketSettings` : `canEdit`, `order`, état Twelve Data (jamais la clé). | Tout tenant |
| `market.configure` | Enregistre l'ordre normalisé. | Administrateur seul (`ctx.isAdmin`), sinon `RpcError("UNAUTHORIZED")` |
| `market.series` | Historique long d'un titre (`SharedMarket.series`). | Tout tenant |

**Réglages de l'instance** (`MarketConfig`, lus dans l'environnement par `apps/server/src/main.ts`) :

| Variable | Défaut | Effet |
|---|---|---|
| `HAMAC_TWELVEDATA_KEY` | vide | Clé Twelve Data, gardée en mémoire du serveur. |
| `HAMAC_TWELVEDATA_DAILY_LIMIT` | 800 | Quota journalier de l'offre (minimum 1). |
| `HAMAC_REFRESH_MINUTES` | 30 | Intervalle de base, 10 au minimum. |
| `HAMAC_PRICES` | 1 | `0` : ni boucle de l'instance ni minuterie par tenant. |

## Règles

- **Ordre par défaut** : `justetf`, `euronext`, `twelvedata`, `yahoo`, `coingecko`. `normalizeOrder` retire `url` et les doublons, et ajoute à la fin les fournisseurs absents de l'ordre enregistré.
- **Couverture** (`supports`) : justETF pour `etf`, `etc` et `fonds` avec ISIN ; Euronext hors crypto avec ISIN ; Twelve Data hors crypto avec symbole et clé ; Yahoo hors crypto avec symbole ; CoinGecko pour la crypto avec symbole ; `url` si `priceUrl` et `pricePath`.
- **Chaîne d'un titre** (`chainFor`) : vide pour un cours manuel ou calculé, une obligation, une SCPI sans `url`. Un `priceProvider` imposé donne une chaîne d'un seul élément. Sinon : `url` en tête si l'adresse est renseignée, puis les sources actives de l'ordre qui couvrent le titre. La raison d'une chaîne vide est renvoyée et affichée.
- **Identité commune** (`instrumentKey`) : `kind|ISIN|SYMBOLE|priceProvider`, ou `null` pour un titre hors base commune (non automatique, adresse personnalisée, `priceProvider = url`, obligation, SCPI, ni ISIN ni symbole).
- **Actualisation commune** (`SharedMarket.refresh`) : dédoublonne par clé, partage les téléchargements en cours (`inFlight`), saute un titre vérifié depuis moins de 10 minutes (`COOLDOWN_MS`). Premier chargement : 24 mois d'historique ; ensuite, depuis le dernier cours connu moins 3 jours. Écrit le compteur Twelve Data dans `marche.config` à la fin.
- **Boucle de l'instance** (`SharedMarket.start`) : collecte les titres automatiques non archivés de tous les tenants (lecture directe de `"t_<hex>".assets` par la connexion d'administration), actualise, puis met à jour les compositions d'ETF. Premier passage 3 s après le démarrage, puis à l'intervalle calculé.
- **Minuterie par tenant** (`startBackend`) : tant que le backend du tenant est ouvert dans le `BackendPool` (fermé après 15 minutes sans appel), `refreshPrices` tourne à la date `nextAt` du dernier statut, au moins 1 minute plus tard.
- **Adresses personnalisées** (`refreshPrices`) : un titre `isPersonal` est actualisé dans la table `prices` du tenant, sans clé Twelve Data. Upsert `WHERE prices.source <> 'manuel'` : un cours manuel n'est jamais écrasé. En mode web, `customQuote` exige `https`, résout le DNS et refuse toute adresse privée ou réservée (IPv4 et IPv6), revérifie la résolution au moment de la connexion (`guardedLookup`), ne suit pas les redirections, coupe à 2 Mo et 15 s.
- **Vraisemblance** (`assertPlausible`) : rejette le dernier cours reçu s'il s'écarte de plus de 25 % du dernier cours connu d'une autre source, à moins de 30 jours d'écart. Pas de contrôle pour la crypto ni quand la source est la même.
- **Fusion** (`mergePrices`, appelée par `loadWorkspace`) : par `(titre, date)`, rang `manuel` (2) > commun (1) > historique propre (0). Puis dernier point de chaque mois, sauf pour les titres de `daily` (la crypto), gardés jour par jour. `loadWorkspace` a déjà filtré `prices` et `marche.quotes` sur le dernier point du mois (crypto exceptée).
- **Lecture dans l'interface** (`PriceBook`) : le point le plus récent à la date demandée ; à date égale, le cours `manuel`. Le cours de la fiche (`manualPrice`) est ajouté s'il manque dans l'historique.
- **Twelve Data** (`sources/twelvedata.ts`) :
  - quota : jamais plus de 95 % de la limite journalière (`safeLimit`), 8 requêtes par minute (attente sinon) ; jour compté en UTC ; compteur en mémoire par clé, repris de `marche.config.usage` ;
  - réponse 429 : quota considéré épuisé pour la journée ; 401 : clé refusée ; 400, 403, 404 : symbole mis de côté 24 heures ;
  - cotation dans une autre devise que `EUR` refusée ; suffixe de place à la Yahoo (`.PA`, `.AS`…) converti en `mic_code` ;
  - intervalle : `refreshIntervalMinutes(n) = max(base, min(1440, ceil(1440 × n / safeLimit)))`, où `n` est le nombre de titres de `marche.instruments` dont la chaîne contient Twelve Data ;
  - exclu des historiques longs (`series`) et des adresses personnalisées.
- **La clé ne sort jamais du serveur.** Elle vient de `MarketConfig`, jamais de la base. `SharedMarket.open` supprime une ancienne clé `twelveDataKey` de `marche.config`. `MarketSettings` n'en expose que `configured`. `exportDump` retire la clé `market.secrets` des réglages, `importDump` la supprime après restauration.
- **Pas de réseau depuis l'interface.** Tout passe par `packages/backend/src/market/` et le `Fetcher` injectable.

## Tests

- `packages/backend/src/market/market.test.ts` : chaîne de sources, source désactivée ou imposée, Euronext, Yahoo, quota et intervalle Twelve Data, cours incohérent, adresse personnalisée (chemin, nombres à la française, réseau interne, DNS revérifié, réponse trop volumineuse), repli, clé qui ne sort pas du serveur, ancienne clé effacée, recherche, historiques longs, actualisation qui n'écrase pas un cours manuel ; bloc « base de cours commune » (un téléchargement pour tous les tenants, restauration sans effet sur les autres, réglage réservé à l'administrateur, adresse personnelle).
- `packages/backend/src/market/merge.test.ts` : priorités, mois comblés par l'historique restauré, dernier cours du mois.
- `packages/backend/src/backend.test.ts` : « espace de travail : cours quotidiens pour la crypto, dernier du mois pour le reste ».
- `packages/backend/src/market/live.test.ts` : vraies sources, avec `HAMAC_LIVE=1 pnpm test`.
- `packages/ui/src/flows/reglages.flow.test.tsx` : blocs « paramètres › cours », « état de l'actualisation des cours », « saisie d'un cours à la main ».
- `testMarket(fetcher?, config?)` de `packages/backend/src/testkit.ts` : base commune sans réseau, sauf `Fetcher` factice.

## Limites connues

- `marche.instruments` et `marche.quotes` ne sont jamais purgés. Un titre que plus personne ne détient reste compté dans `twelveDataCount`, ce qui peut ralentir l'intervalle d'actualisation (à vérifier en pratique).
- L'interface affiche « utilisées / limite » avec la limite déclarée, alors que les appels s'arrêtent à 95 % de cette limite.
- Le message de `assertPlausible` affiche les montants en euros, même pour une cotation dans une autre devise.
- `mergePrices` ne départage qu'à date égale : après réduction au dernier point du mois, un cours manuel antérieur dans le mois cède la place à un cours automatique plus récent.
- Les adresses personnalisées et le `PriceStatus` d'un tenant ne sont actualisés automatiquement que pendant que son backend est ouvert.
- Le compteur par minute de Twelve Data est en mémoire du processus : il repart de zéro à chaque redémarrage (le compteur du jour, lui, est repris de `marche.config`).
