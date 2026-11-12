# Crypto : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/crypto`, module `crypto`. Aucune différence entre les formats `retraite` et `patrimoine`.

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/investments/pages/Crypto.tsx` | La page : chiffres, positions (`CryptoPositions`), impôt si tout était vendu, baisse, tableau des ventes, impôt par année, mouvements. |
| UI | `packages/ui/src/features/investments/dialogs/PriceDialog.tsx` | Saisie d'un cours à la main. |
| UI | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio` renvoie `crypto: cryptoTax(data, today)`, calculé une fois par espace de travail et par jour. |
| UI | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx` | Achat, vente, et arbitrage (« Échanger une crypto »). |
| Core | `packages/core/src/tax/cryptoTax.ts` | `cryptoTax` : plus-value de chaque cession (art. 150 VH bis), impôt par année, prix total d'acquisition restant. |
| Core | `packages/core/src/tax/fiscalRules.ts` | `socialRateFor` (prélèvements sociaux par année et nature), cases 3AN et 3BN, `cryptoExemptionThreshold`. |
| Core | `packages/core/src/tax/taxes.ts` | `withdrawalTaxes` : impôt si tout retiré, avec la plus-value crypto sur le portefeuille global (page Impôts). |
| Core | `packages/core/src/portfolio/engine.ts` | Positions, PRU et valeur par plateforme, arbitrage sans espèces. |
| Core | `packages/core/src/model/params.ts` | `incomeTaxRate` (= `min(tmi, pfuIncomeTax)`), `crypto.exemptionThreshold`, `crypto.feeRate`, `alerts.stressCrypto`. |
| Core | `packages/core/src/model/institutions.ts` | `tradeFeeFor` : `offers.crypto.tradeFee` de l'établissement, sinon `params.crypto.feeRate`. |
| Core | `packages/core/src/model/validation.ts` | `ALLOWED_ASSETS.crypto = ["crypto"]`, `ALLOWED_TYPES.crypto` (pas de dividende), règles de l'arbitrage. |
| Backend | `packages/backend/src/market/sources/coingecko.ts` | Cours et recherche CoinGecko (identifiant dans `assets.symbol`, ex. `bitcoin`). |
| Backend | `packages/backend/src/market/index.ts` | `supports("coingecko")` : seulement les titres `crypto` avec un symbole ; les autres sources excluent la crypto. |
| Backend | `packages/backend/src/repo/loadWorkspace.ts`, `packages/backend/src/market/merge.ts` | Cours quotidiens pour la crypto (les autres titres n'ont que le dernier cours du mois). |
| Backend | `packages/backend/src/handlers/assets.ts` | `prices.setManual`, `assets.upsert`. |

## Données

Pas de table propre. La page lit :

- `accounts` de `kind = "crypto"` ;
- `assets` de `kind = "crypto"` (`symbol` = identifiant CoinGecko) ;
- `transactions` : `achat`, `vente` (`amount` = net reçu, `fee`), `arbitrage` (`asset_id`, `quantity` cédés ; `counter_asset_id`, `counter_quantity` reçus ; `amount` = valeur de l'échange), versements et retraits d'euros ;
- `prices`, tous les jours pour la crypto (`mergePrices(…, daily)` et la requête de `loadWorkspace`).

Champs du `Workspace` : `accounts`, `assets`, `transactions`, `prices`, `institutions`, `params` (`tax.tmi`, `tax.pfuIncomeTax`, `tax.socialGeneral`, `crypto.exemptionThreshold` défaut 305 €, `alerts.stressCrypto` défaut `[0.5, 0.8]`).

Procédures : `prices.setManual`, `assets.upsert`, `assets.search`, et celles du journal.

## Règles de calcul

**Positions** (moteur, par plateforme). Même mécanique que les actions : coût moyen pondéré, `pru = cost / qty`, valeur au dernier cours connu (`PriceBook`), prix de revient à défaut (`priceUsed = "cout"`). Un arbitrage sort la quantité cédée au coût moyen (`takeOut`, qui compte `amount − coût sorti` en gain réalisé de la plateforme) et donne à la crypto reçue un prix de revient égal à `amount` (valeur de l'échange) ; il ne crée pas de `Disposal`.

**Plus-value de cession** (`cryptoTax`, CGI art. 150 VH bis, cité dans le code).

- Opérations retenues : date ≤ `asOf`, compte `crypto`, titre `crypto`, type `achat`, `vente`, ou `arbitrage` vers un titre `crypto`. Toutes plateformes ensemble. À date égale, les achats passent avant.
- Achat : `PTA += amount` (frais compris).
- Arbitrage crypto → crypto : les quantités changent, `PTA` inchangé (CGI, art. 150 VH bis, II, cité dans le code ; stablecoins compris).
- Vente : `gross = amount + fee` ; `V` = valeur globale du portefeuille : la crypto vendue au prix unitaire de la cession (`gross / quantity`), les autres au dernier cours ≤ date (`PriceBook.at`), sinon à leur coût moyen. `estimatedValue = true` si un cours manque ou a plus de 7 jours.
- `attributed = PTA × gross / V` ; `gain = amount − attributed` (prix net − PTA × prix brut / V) ; puis `PTA −= attributed`.

**Impôt par année.**

- `grossSales = Σ gross` ; `netGain = Σ gain` (plus et moins-values compensées dans l'année).
- `exempt = grossSales ≤ params.crypto.exemptionThreshold`.
- `base = exempt ? 0 : max(0, netGain)`.
- `incomeTax = base × incomeTaxRate(params)` = `base × min(tmi, pfuIncomeTax)` (12,8 % par défaut, ou la TMI si elle est plus basse).
- `social = base × socialRateFor(year, "patrimoine", params)` : 17,2 % avant les revenus 2025, puis `params.tax.socialGeneral` (18,6 % par défaut). Source citée dans `fiscalRules.ts` : CSG portée de 9,2 % à 10,6 % à compter des revenus 2025 pour les revenus du patrimoine (LFSS 2026, art. 12 ; CSS, art. L136-8), table vérifiée le 2026-11-09 sur la Brochure pratique IR 2026.

**Si tout était vendu** (calcul dans la page, pas dans `core`).

- `latent = Σ value des positions crypto − crypto.remainingAcquisition`.
- `taxIfSold = 0` si `latent ≤ 0` ou si `Σ value + ventes brutes de l'année ≤ seuil` ; sinon `latent × (incomeTaxRate + params.tax.socialGeneral)`.
- Valeur nette = valeur totale (euros compris) − `taxIfSold`.

**Baisse.** `−d × Σ value des positions`, `d` dans `alerts.stressCrypto`.

**Cases de déclaration** (`fiscalRules.ts`, revenus 2025, vérifiées le 2026-11-09) : 3AN (plus-value, report de la 2086) et 3BN (moins-value), formulaire 2042 C. La page cite aussi les formulaires 2086 et 3916-bis.

## Tests

- `packages/core/src/portfolio/engine.test.ts` : « crypto : formule 150 VH bis sur un portefeuille de deux cryptos », « crypto : ventes annuelles sous 305 € exonérées », « crypto sur deux plateformes : le prix d'acquisition global n'est déduit qu'une fois », valeur et plus-value latente, impôt si tout retiré.
- `packages/core/src/portfolio/arbitrage.test.ts` : « échanger une crypto contre une autre n'est pas une cession : prix total d'acquisition inchangé ».
- `packages/core/src/tax/taxReport.test.ts` : plus-value sur le portefeuille global, exonération sous 305 € avec rappel de la 2086.
- `packages/core/src/tax/accountTaxes.test.ts` : impôt de l'année réparti entre plateformes au prorata de leur plus-value.
- `packages/backend/src/backend.test.ts` : « espace de travail : cours quotidiens pour la crypto, dernier du mois pour le reste ».
- `packages/ui/src/flows/placements.flow.test.tsx`, bloc « Crypto » : page vide, achats, vente contre euros, impôt estimé, cours manquant puis saisi, solde en euros négatif, seuil.

## Limites connues

- `cryptoTax` lit le seuil dans `params.crypto.exemptionThreshold`, pas dans `fiscalRulesFor(year).cryptoExemptionThreshold` : les deux valent 305 € aujourd'hui, mais ne sont pas reliés.
- « Si tout était vendu » applique `params.tax.socialGeneral` directement, au lieu de `socialRateFor` : même résultat pour les années ≥ 2025.
- Ce même calcul ignore les plus et moins-values déjà réalisées dans l'année ; il ne compare que le total des ventes au seuil.
- `estimatedValue` est calculé mais n'est affiché nulle part sur la page.
- Les opérations `interets` sur une plateforme crypto créditent des euros mais n'entrent pas dans `cryptoTax`.
- Pas de transfert de crypto entre comptes : `transfert` ne déplace que des euros (ou un fonds euros).
- Le prix de revient unitaire affiché (moteur, par plateforme) et le prix total d'acquisition (impôt, global) sont deux calculs distincts : la plus-value latente du tableau n'est pas celle de l'impôt.
- Le barème s'applique d'office dès que la TMI est plus basse que 12,8 % (`min(tmi, pfuIncomeTax)`) : la page ne demande pas si l'option est exercée.
- Après un arbitrage, le prix de revient du tableau (moteur) repart de la valeur de l'échange, alors que le prix total d'acquisition fiscal ne bouge pas.
- `stressCrypto` n'a pas de réglage dans l'interface.
