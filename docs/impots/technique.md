# Impôts : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/impots`, module `impots` (`packages/ui/src/shared/nav.ts`). Le module commande aussi `/compteurs` et `/declaration`. Aucun bloc n'est réservé à un format, sauf la durée de détention de `netYields` (voir plus bas).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/tax/pages/Impots.tsx` | Page : blocs 1 à 4 (`NextDeclaration`, `WithdrawalTable`, rendements nets, impôts de chaque année), détail dépliable d'un compte (`AccountTaxPanel`). |
| UI | `packages/ui/src/features/tax/components/YearEndCard.tsx` | Liste de fin d'année, repliée en bas de la page (documentée dans [Compteurs et plafonds](../compteurs-et-plafonds/technique.md)). |
| UI | `packages/ui/src/features/tax/index.ts` | Façade du domaine : exporte `Impots`, `Compteurs`, `Declaration`. |
| UI | `packages/ui/src/shared/lib/portfolio.ts` | `usePortfolio` : `EngineData`, `computePortfolio` et `cryptoTax` calculés une fois par workspace et par jour. |
| Core | `packages/core/src/tax/taxes.ts` | `withdrawalTaxes` (si tout était retiré), `netYields` (rendements nets), `yearlyTaxes` (impôts de chaque année). |
| Core | `packages/core/src/tax/accountTaxes.ts` | `accountTaxDetails` (détail compte par compte, prochaine déclaration), `nextDeclarationYear`, `declarationSettled`, `TAX_NOTICE_DAY`. |
| Core | `packages/core/src/tax/cryptoTax.ts` | `cryptoTax` : plus-values sur actifs numériques (CGI, art. 150 VH bis). |
| Core | `packages/core/src/tax/fiscalRules.ts` | `socialRateFor` : taux des prélèvements sociaux selon l'année et la nature du revenu. |
| Core | `packages/core/src/tax/taxReport.ts` | `resolveIncome` (brut et retenues d'un revenu), `accountWithholds`, `securityDisposals` (exclut les SCPI), partagés avec l'aide à la déclaration. |
| Core | `packages/core/src/portfolio/securitiesGains.ts` | Compensation des plus et moins-values du compte-titres et report des moins-values. |
| Core | `packages/core/src/model/params.ts` | Taux par défaut (`defaultParams().tax`, `crypto.exemptionThreshold`), `incomeTaxRate`, `taxRegimeLabel`, `isRetirementPlan`. |
| Core | `packages/core/src/model/institutions.ts` | `institutionWithholds`, `crowdTaxOf`, `grossFromNet` : retenues d'un établissement. |
| UI (réglages) | `packages/ui/src/features/settings/pages/Parametres/PlanTab.tsx` | Section « Fiscalité » de Paramètres › Plan, où se règlent les taux. |
| UI (réglages) | `packages/ui/src/features/settings/dialogs/InstitutionDialog.tsx` | Section « Fiscalité » d'un établissement (prélève ou non, taux qui diffèrent). |
| Core (alertes) | `packages/core/src/alerts/alerts.ts` | En novembre et décembre, alerte « Liste de fin d'année » qui renvoie vers `/impots`. |

## Données

La page ne fait aucun appel propre : tout vient de `workspace.load`, calculé côté UI.

- Champs du `Workspace` lus : `params` (section `tax`, `crypto.exemptionThreshold`, `returns`, `profile.couple`, `profile.startMonth`, `profile.goal`), `accounts` (`kind`, `openedOn`, `institutionId`, `livretType`, `rate`, `archived`), `transactions` (dont `gross`, `withheldIncomeTax`, `withheldSocial`, `withheldForeign` sur les dividendes et intérêts), `assets` (`kind` pour exclure les SCPI), `institutions` (`tax`, `offers.crowdlending`), `prices` (valeur du portefeuille crypto à chaque cession).
- Tables : aucune spécifique. Les retenues d'un établissement sont dans la colonne JSON `institutions.tax` (`packages/backend/src/db/schema/accounts.ts`).
- Procédures : `workspace.load` ; `settings.get` / `settings.set` avec la clé `taxes.yearEnd` pour les cases de la liste de fin d'année (`SettingKey` dans `packages/api/src/system/procedures.ts`).

## Règles de calcul

### Taux

- `incomeTaxRate(p) = min(p.tax.tmi, p.tax.pfuIncomeTax)` : « barème si plus avantageux, sinon PFU » (`model/params.ts`).
- Valeurs par défaut (`defaultParams`, section « Taux 2026, à vérifier chaque année » de `PlanTab.tsx`) : `pfuIncomeTax` 12,8 %, `socialGeneral` 18,6 %, `socialAv` 17,2 %, `avBefore8` 12,8 %, `avAfter8` 7,5 %, `avAllowanceSingle` 4 600 €, `avAllowanceCouple` 9 200 €, `peaBefore5` 12,8 %, `crypto.exemptionThreshold` 305 €, `tmi` 11 %.
- `socialRateFor(year, nature, params)` (`tax/fiscalRules.ts`) : 17,2 % avant la hausse, `params.tax.socialGeneral` ensuite. Hausse de la CSG de 9,2 % à 10,6 % à compter des revenus 2025 pour les revenus du patrimoine (`"patrimoine"`), du 1.1.2026 pour les produits de placement (`"placement"`). Source citée : LFSS 2026, art. 12. Les plus-values et ce qui passe par la déclaration utilisent `"patrimoine"` ; les retenues à la source utilisent `"placement"`.

### Retenues sur un revenu (`resolveIncome`, `tax/taxReport.ts`)

1. `gross` saisi : il prime, avec les retenues saisies. Statut `a_verifier` si brut − retenues ≠ montant reçu (tolérance 0,02 €), sauf si le montant reçu est le brut (crowdlending dont les impôts sont débités à part).
2. Crowdlending : `crowdTaxOf` donne `withheld` et le taux total ; brut = net / (1 − taux), acompte = brut × min(taux, PFU), le reste en prélèvements sociaux.
3. Établissement qui ne prélève pas (`institutionWithholds` faux) : le montant reçu est le brut.
4. Sinon : `grossFromNet(net, effectiveWithholding(...))`, brut = net / (1 − acompte − prélèvements sociaux). Acompte = taux de l'établissement, sinon `pfuIncomeTax` (0 si `withholdingDispense`). Prélèvements sociaux = taux de l'établissement, sinon `socialRateFor(année, "placement")`.

`accountWithholds` : sans établissement, on suppose une retenue, sauf pour le crowdlending et la crypto.

### Bloc 1 et détail d'un compte (`accountTaxDetails`)

Par compte (archivés à valeur nulle exclus), par année :

- Fonds euros (intérêts d'assurance-vie) : si l'assureur prélève, PS = net × `socialAv` / (1 − `socialAv`), comptés à la source ; sinon intérêts bruts et PS = brut × `socialAv` à la déclaration.
- Compte-titres : à la source = PS retenus + acompte ; à la déclaration = PS non retenus (brut × `socialRateFor(année, "patrimoine")`) + brut × `incomeTaxRate` − acompte. Plus-values : `securitiesGains` sur les cessions des comptes-titres hors SCPI, puis `taxableGain × (incomeTaxRate + socialRateFor(année, "patrimoine"))`, réparti au prorata des résultats positifs de chaque compte.
- Crowdlending : retenues de la plateforme à la source ; sinon brut × (taux d'impôt + PS) à la déclaration.
- Crypto : `cryptoTax().years[].total` réparti entre comptes au prorata de leur plus-value de l'année.
- Opérations « Impôts » du Journal : ajoutées au retenu à la source, sauf sur les comptes où Hamac calcule déjà les retenues (`WITHHOLDING_COMPUTED` : assurance-vie, compte-titres, crowdlending, quand l'établissement prélève). Elles servent alors de contrôle, et pour le crowdlending un écart ≥ 1 € avec les retenues notées donne une remarque.

Échéance : `declarationSettled(year, asOf)` est vrai à partir du `${year + 1}-08-01` (`TAX_NOTICE_DAY`). Source citée : impots.gouv.fr, calendrier de la déclaration des revenus (avis en ligne entre fin juillet et début août). `nextDeclarationYear(asOf)` = année en cours si l'avis de l'an dernier est sorti, sinon l'an dernier. Le bloc 1 affiche les `years[].atDeclaration` non nuls de cette année.

Repères (`kindFacts`) : 8 ans d'une assurance-vie (96 mois), 5 ans d'un PEA (60 mois), abattement, gains des unités de compte, moins-values reportables (`carryOut`), retenues étrangères, économie d'impôt PER estimée (versé net × TMI)…

### Bloc 2 : si tout était retiré (`withdrawalTaxes`)

| `kind` | Impôt |
|---|---|
| `livret` | 0 |
| `assurance_vie` | 8 ans atteints (`addMonths(openedOn, 96) <= asOf`) : max(0, gain − abattement) × min(TMI, `avAfter8`) + PS ; sinon gain × min(TMI, `avBefore8`) + PS. PS = somme des gains positifs des positions (unités de compte) × `socialAv`. Sans date d'ouverture : traité comme moins de 8 ans. |
| `pea`, `pea_pme` | 5 ans atteints : gain × `socialGeneral` ; sinon gain × (`socialGeneral` + `peaBefore5`). Sans date : moins de 5 ans. |
| `cto` | Plus-value latente des positions × (`socialGeneral` + `incomeTaxRate`). |
| `per` | min(valeur, versé net) × TMI + max(0, gain) × (`pfuIncomeTax` + `socialGeneral`). |
| `crowdlending` | 0 (intérêts imposés chaque année). |
| `epargne_salariale` | gain × `socialGeneral`. |
| `crypto` | Latent global = valeur crypto totale − `remainingAcquisition`, réparti au prorata de la valeur du compte ; 0 si valeur totale + ventes de l'année ≤ `exemptionThreshold` ; sinon latent × (`incomeTaxRate` + `socialGeneral`). |

### Bloc 3 : rendements nets (`netYields`)

- LEP, LDDS / Livret A : taux du livret actif du type (`LEP`, puis `LDDS`, sinon `LIVRET_A`), exonéré.
- Fonds euros : `returns.fondsEuros × (1 − socialAv)`.
- Obligations : `returns.obligations × (1 − socialGeneral − incomeTaxRate)`.
- ETF en PEA : `(1 + ((1 + r)^n − 1) × (1 − socialGeneral))^(1/n) − 1`, avec `r = returns.actions` et `n` = max(5, année de retraite − année en cours) en format retraite (`isRetirementPlan`), 10 en format patrimoine.
- Crypto : pas de rendement, fiscalité seulement.

### Bloc 4 : impôts de chaque année (`yearlyTaxes`)

De min(`profile.startMonth`, première opération) à l'année en cours :

- `avSocial` = intérêts nets des assurances-vie × `socialAv` / (1 − `socialAv`).
- Coupons et dividendes des comptes-titres : `resolveIncome` ; `couponsSocial` = PS retenus, sinon brut × `socialRateFor(année, "patrimoine")` ; `couponsIncomeTax` = brut × `incomeTaxRate` ; `regularisation` = `couponsIncomeTax` − acompte.
- Crypto : `cryptoTax().years`.
- `securitiesGain` = `taxableGain` de `securitiesGains` (hors SCPI) ; impôt et PS au taux de l'année.
- Crowdlending : retenues de la plateforme, sinon brut × (taux d'impôt + PS de l'année).
- `total` = PS fonds euros + PS coupons + impôt définitif des coupons + crypto + plus-values + crowdlending.

### Crypto (`cryptoTax`, CGI art. 150 VH bis)

- Portefeuille global, toutes plateformes. Opérations retenues : achats, ventes, et arbitrages crypto → crypto.
- Un arbitrage crypto → crypto (stablecoins compris) n'est pas une cession : les quantités changent, le prix total d'acquisition (PTA) ne bouge pas (CGI, art. 150 VH bis, II).
- Cession : prix brut = montant + frais ; valeur globale V = titre vendu au prix de la cession + autres cryptos au dernier cours connu (sinon au coût moyen). Prix imputé = PTA × prix brut / V ; gain = montant net − prix imputé ; PTA −= prix imputé.
- `estimatedValue` : un autre actif n'a pas de cours dans les 7 jours qui précèdent la cession.
- Par année : base = 0 si ventes brutes ≤ `params.crypto.exemptionThreshold`, sinon max(0, gain net). Impôt = base × `incomeTaxRate` ; PS = base × `socialRateFor(année, "patrimoine")`.

## Tests

| Fichier | Ce qu'il couvre |
|---|---|
| `packages/core/src/portfolio/engine.test.ts` | `withdrawalTaxes` (PEA avant et après 5 ans, PER, épargne salariale, PEA-PME, crowdlending), `cryptoTax` (formule 150 VH bis sur deux cryptos, seuil de 305 €, deux plateformes), `yearlyTaxes` (coupons : brut, acompte, régularisation ; crowdlending). |
| `packages/core/src/portfolio/arbitrage.test.ts` | Arbitrage crypto → crypto sans cession imposable. |
| `packages/core/src/portfolio/euroFunds.test.ts` | `withdrawalTaxes` sur des contrats avec fonds euros. |
| `packages/core/src/portfolio/securitiesGains.test.ts` | Compensation, imputation des moins-values antérieures, durée de 10 ans. |
| `packages/core/src/tax/accountTaxes.test.ts` | Retenues d'un établissement, avis au 1er août, crowdlending, compte-titres, assurance-vie, crypto au prorata, somme des comptes = total de l'année. |
| `packages/core/src/tax/taxReport.test.ts` | `resolveIncome` ; « impôts de chaque année, mêmes calculs que le récapitulatif ». |
| `packages/core/src/tax/fiscalRules.test.ts` | `socialRateFor` selon l'année et la nature. |
| `packages/ui/src/flows/suivi.flow.test.tsx` | Page Impôts : sans compte, rien à déclarer, à payer, rendements nets, tri et détail de chaque type de compte. |
| `packages/ui/src/app/compte.flow.test.tsx` | Le module `impots` désactivé retire les trois pages du menu. |

## Limites connues

- `incomeTaxRate` applique le plus bas des deux taux revenu par revenu ; l'option globale pour le barème (case 2OP) n'est pas simulée.
- Assurance-vie après 8 ans : `avAfter8` s'applique à tout le gain imposable, sans distinguer les versements au-delà de 150 000 € (seule l'aide du champ le mentionne).
- PER : versements supposés déduits ; capital imposé à la TMI.
- `yearlyTaxes` calcule les PS du fonds euros comme si l'assureur prélevait toujours, alors que `accountTaxDetails` traite l'assureur qui ne prélève rien. Les deux peuvent alors diverger.
- `yearlyTaxes` ignore les opérations « Impôts » du Journal ; `accountTaxDetails` les compte (hors comptes à retenues calculées).
- Crypto : `Workspace.prices` ne garde que le dernier cours de chaque mois. Une cession en cours de mois a donc souvent un autre actif sans cours dans les 7 jours, ce qui la marque `estimatedValue`. Les intérêts sur une plateforme crypto ne sont pas imposés.
- Crédit d'impôt sur les retenues étrangères : noté (`foreign`), non déduit.
- Livret non réglementé (`livretType = "AUTRE"`) : intérêts non calculés.
