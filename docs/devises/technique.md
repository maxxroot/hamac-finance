# Devises : documentation technique

> Pour l'utilisateur : [guide](guide.md). Décision : [0010](../decisions/0010-devises-du-titre-et-taux-bce.md).

Un titre porte sa devise de cotation ; les comptes et les opérations restent en euros. Les taux de référence de la BCE sont communs à l'instance et livrés avec l'espace de travail.

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| Core | `packages/core/src/base/currencies.ts` | `EUR`, `ECB_CURRENCIES` (29 devises), `CURRENCIES`, `isCurrency`, `currencyOf` (null = euro), `isForeign`, `currencyName` (noms français par `Intl.DisplayNames`), `formatMoney`, `countryCurrency` (devise proposée pour la dette d'un État). |
| Core | `packages/core/src/model/fx.ts` | `FxRate` (unités de la devise pour 1 €, convention BCE), `FxBook` (dernier taux publié à une date), `toEur`. |
| Core | `packages/core/src/model/domain.ts` | `Asset.currency`, `Transaction.fxRate`. |
| Core | `packages/core/src/model/validation.ts` | `fxRate` seulement sur un titre en devise, et positif. |
| Core | `packages/core/src/portfolio/engine.ts` | `EngineData.fxRates`, `rateOf` (taux de l'opération, sinon BCE, sinon pair avec avertissement), `costFx` des positions et des lots, conversion dans `valuePosition`, remboursement au taux de l'échéance ; champs `currency`, `fxRate`, `costFx`, `valueFx`, `pruFx`, `fxGain` de `PositionState`. |
| Core | `packages/core/src/analysis/bonds/` | Flux, échelle, répartition en euros au taux du jour (`PositionState.fxRate`) ; `couponCheck` et `realizedBondYield` reçoivent un `FxBook`. |
| Core | `packages/core/src/tax/bondTax.ts` | Impôts à venir d'une obligation en devise : coût en euros, flux convertis au taux du jour. |
| API | `packages/api/src/assets/inputs.ts`, `packages/api/src/assets/procedures.ts` | `AssetInput.currency` (EUR par défaut), `FxRateInput`, procédure `market.fxRate`. |
| API | `packages/api/src/journal/inputs.ts` | `TransactionInput.fxRate`. |
| API | `packages/api/src/system/procedures.ts` | `Workspace.fxRates`. |
| Backend | `packages/backend/src/market/sources/ecb.ts` | API du portail de données de la BCE (série `EXR`, CSV `detail=dataonly`, sans clé) : `fetchEcbRates`, `parseEcbCsv`. |
| Backend | `packages/backend/src/market/fx/fxStore.ts` | `FxStore` : tables `marche.fx_rates` et `marche.fx_status`, `ensure`, `rates`, `rateOn`, `known`, `collect`. |
| Backend | `packages/backend/src/market/shared.ts` | `SharedMarket.fx`, tables créées à l'ouverture, devises des titres actualisées par la boucle de l'instance ; colonne `currency` de `marche.instruments`. |
| Backend | `packages/backend/src/market/index.ts` | `MarketAsset.currency`, `instrumentKey` (devise ajoutée à la clé hors euro), Euronext réservé à l'euro, devise passée aux sources. |
| Backend | `packages/backend/src/market/sources/yahoo.ts`, `packages/backend/src/market/sources/twelvedata.ts`, `packages/backend/src/market/sources/justetf.ts` | Cotation acceptée dans la devise du titre ; Yahoo convertit les sous-unités (`GBp`, `GBX`, `ZAc`, `ILA`). |
| Backend | `packages/backend/src/repo/loadWorkspace.ts` | `loadFxRates` : taux des devises des titres depuis la première opération concernée (au moins un mois). |
| Backend | `packages/backend/src/handlers/assets.ts` | `assets.upsert` : euro forcé pour un fonds euros ou une crypto, taux d'une nouvelle devise demandés ; `market.fxRate`. |
| Backend | `packages/backend/src/handlers/journal.ts` | `fx_rate` enregistré (saisie et import en lot). |
| Backend | `packages/backend/src/prices/refresh.ts` | Les taux des devises du tenant s'actualisent avec ses cours. |
| Backend | `packages/backend/src/testkit.ts` | `ecbFake` : fausse API de la BCE. |
| UI | `packages/ui/src/features/entry/lib/fxEntry.ts` | `FxDraft`, `ecbRateOn`, `rateInUse`, `rateToStore`, `fxDraftOf`. |
| UI | `packages/ui/src/features/entry/lib/useEcbRate.ts` | Taux BCE à la date de l'opération : `Workspace.fxRates`, sinon `market.fxRate`. |
| UI | `packages/ui/src/features/entry/dialogs/FxFields.tsx` | Taux de change et total dans la devise. |
| UI | `packages/ui/src/features/entry/dialogs/transactionDraft.ts` | Brouillon de la saisie (`Draft` avec `FxDraft`, `blank`, `fromTx`). |
| UI | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx`, `packages/ui/src/features/entry/dialogs/BondTradeFields.tsx`, `packages/ui/src/features/entry/lib/tradeAmounts.ts` | Prix unitaire et quantité dans la devise, montants en euros (`syncTradeAmounts`, paramètre `rate`). |
| UI | `packages/ui/src/features/entry/components/CurrencyField.tsx` | Choix de la devise (`NewAssetPanel`, `AssetDialog`). |
| UI | `packages/ui/src/shared/components/Amount.tsx`, `packages/ui/src/shared/components/ForeignAmount.tsx` | `Amount` accepte `currency` ; `ForeignValue` et `ForeignGain` sous la valeur et la plus-value. |
| Server | `apps/server/src/mcp/tools/assets.ts`, `apps/server/src/mcp/tools/journal.ts`, `apps/server/src/mcp/tools/accounts.ts` | `currency` (`save_asset`, `list_assets`), `fxRate` (`save_transaction`, `list_transactions`), valeur en devise et effet de change des positions. |

## Données

- `assets.currency` : texte, `EUR` par défaut, non nul (migration `0035_devises`).
- `transactions.fx_rate` : double, nullable. Unités de la devise pour 1 € ; null = taux BCE du jour.
- `marche.fx_rates (currency, date, rate)` et `marche.fx_status (currency, checked_at)`, dans le schéma commun : aucun droit SQL pour les tenants, rien dans les sauvegardes d'un tenant (`TABLES` de `packages/backend/src/backup/dump.ts` n'a pas à changer : les deux colonnes sont dans des tables déjà sauvegardées).
- `marche.instruments.currency` : devise de l'instrument (null = euro, instruments d'avant les devises).
- `Workspace.fxRates` : chaque taux publié des devises des titres, depuis la première opération sur un titre de cette devise (au plus tard depuis un mois), plus le dernier taux avant cette date.

## Règles

**Convention.** Un taux est un nombre d'unités de la devise pour 1 €, comme la BCE le publie : 1,0832 USD pour 1 €. Un montant en devise vaut `montant / taux` euros.

**Taux d'une date** (`FxBook.point`). C'est le dernier taux publié à cette date ou avant : la BCE ne publie ni le week-end ni les jours fériés TARGET. Avant le premier taux connu, le premier s'applique. L'euro vaut 1.

**Opération** (`rateOf` dans `computePortfolio`). On prend `tx.fxRate` s'il est saisi, sinon le taux BCE de la date. Si la devise n'a encore aucun taux (BCE pas encore interrogée), elle compte au pair, avec l'avertissement « Aucun taux de change connu pour … ».

**Achat.**
- `cost` est le montant en euros, comme avant les devises.
- `costFx` vaut `amount × taux`.
- Le prix pied de coupon d'une obligation est dans la devise : `clean = (amount − fee) × taux / nominal − coupon couru`. Un coupon couru saisi (en euros) est converti au même taux.
- Une vente réduit `cost` et `costFx` au prorata.
- Le support reçu par un arbitrage prend `costFx` au taux BCE du jour.

**Valeur** (`valuePosition`).
- Toute valeur se calcule d'abord dans la devise : cours × quantité, valeur amortie d'une obligation, ou cours saisi en % du nominal. Elle est ensuite divisée par le taux de `asOf`.
- Sans cours, la valeur est `costFx`.
- `fxGain = costFx / taux du jour − cost`. C'est la part de la plus-value latente due au change.
- `pruFx = costFx / quantité` se compare au cours.
- Le rendement actuariel d'un lot se calcule sur `costFx` : c'est un rendement dans la devise, hors change.

**Échéance.**
- Le nominal (dans la devise) est converti au taux BCE du jour de l'échéance, puis crédité en euros (`moveMoney`).
- Le `Disposal` de type `remboursement` reçoit ces euros comme prix de cession.

**Fiscalité.** Prix d'acquisition et de cession sont convertis en euros au taux de leur date. Le gain de change fait partie de la plus-value imposable : CGI, art. 150-0 D ; Conseil d'État, 13 septembre 2021, n° 443914. Les opérations étant en euros, le registre des cessions et le récapitulatif fiscal appliquent cette règle sans autre changement. Pour les impôts à venir (`bondTaxes`), les flux futurs en devise sont convertis au taux du jour, seule estimation disponible.

**Analyses d'obligations.**
- `upcomingBondFlows`, `valueTrajectory`, `maturityLadder` et `bondBreakdown`, ainsi que les tuiles « Nominal » et « Coupons annuels », convertissent au taux du jour : `p.bond.nominal / p.fxRate`.
- `couponCheck` attend un coupon en euros : au taux de l'opération rapprochée s'il est saisi, sinon au taux BCE du jour du coupon.
- `realizedBondYield` convertit le nominal au taux de l'échéance.

**Saisie** (`TransactionDialog`).
- Pour un titre en devise, le formulaire calcule avec le taux saisi, sinon avec le taux BCE de la date (`useEcbRate`).
- La quantité et le prix unitaire sont dans la devise ; frais, total et brut restent en euros.
- `syncTradeAmounts` calcule `total = quantité × prix / per / taux + couru + frais`.
- Le total se tape en euros ou dans la devise (`fxBasis`) ; le dernier champ tapé l'emporte.
- Le taux enregistré (`rateToStore`) dépend de ce qui a été tapé :
  - total tapé en devise : le taux effectif `total en devise / euros`, pour retrouver le montant de l'avis au centime ;
  - taux saisi : celui-ci ;
  - sinon : null.

**Titres.**
- Un fonds euros et une crypto sont toujours en euros (`assets.upsert`).
- Pour une obligation d'État, l'interface propose la devise du pays choisi (`countryCurrency`).
- Enregistrer un titre dans une nouvelle devise demande tout de suite ses taux à la BCE.

**Sources de cours.**
- `instrumentKey` ajoute la devise à la clé d'un titre hors euro. Les clés en euros ne changent pas.
- Yahoo et Twelve Data refusent une cotation dans une autre devise que celle du titre. Le message propose d'indiquer la devise sur la fiche.
- justETF est interrogé dans la devise du titre.
- Euronext ne sert que pour les titres en euros.

**Actualisation des taux** (`FxStore.ensure`).
- Au premier passage, l'historique complet depuis le 4 janvier 1999, puis les sept derniers jours connus.
- Une même devise n'est pas réinterrogée avant 6 heures, ni avant 15 minutes après un échec.
- Les taux d'une devise sont demandés à chacun de ces moments :
  - enregistrement d'un titre ;
  - actualisation des cours d'un tenant ;
  - boucle de l'instance, pour les devises des titres non archivés de tous les tenants ;
  - chargement d'un espace de travail dont une devise n'a encore aucun taux.

## Tests

- `packages/core/src/portfolio/currencies.test.ts` :
  - `FxBook` ;
  - obligation en dollars : prix pied de coupon d'après le taux saisi, valeur au taux du jour, effet de change, remboursement au taux de l'échéance, avertissement sans taux, flux, échelle et impôts en euros, coupon rapproché ;
  - action cotée en dollars ;
  - validation de `fxRate`.
- `packages/backend/src/market/fx/fxStore.test.ts` :
  - lecture du CSV de la BCE ;
  - historique complet puis rien tant que la devise est à jour, l'euro jamais demandé ;
  - devise et taux livrés avec l'espace de travail ;
  - devise inconnue refusée, euro forcé pour un fonds euros et une crypto, taux refusé sur un titre en euros.
- `packages/ui/src/features/entry/lib/fxEntry.test.ts` : taux pré-rempli, taux saisi, taux effectif d'un total tapé en devise.
- `packages/ui/src/features/entry/lib/tradeAmounts.test.ts` : prix en dollars, total en euros.
- `packages/ui/src/flows/placements.flow.test.tsx`, « obligation en dollars » : la devise suit le pays, le taux BCE est demandé au serveur, le total est tapé en dollars, le montant et le taux sont enregistrés, le nominal s'affiche en dollars.

## Limites connues

- Pas d'espèces en devise dans un compte : un courtier qui garde un solde en dollars (IBKR, Saxo) ne se décrit pas encore.
- Changer la devise d'un titre ne convertit ni ses cours saisis, ni les quantités : à faire avant les premières opérations.
- Le remboursement automatique d'une obligation suppose le taux BCE de l'échéance. Le taux réellement appliqué par l'établissement se rattrape par une correction.
- Le coupon couru saisi à la main est stocké en euros. Affiché dans la devise, il peut différer d'un centime de l'avis d'opéré.
- La comparaison de titres (`market.series`, `comparePrices`) et l'exposition réelle ne tiennent pas compte de la devise.
- `PositionState.pru` reste en euros ; les tableaux affichent `pruFx` pour un titre en devise.
