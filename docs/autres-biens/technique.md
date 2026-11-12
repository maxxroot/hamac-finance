# Autres biens : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/autres-biens`, module `autresBiens`. Aucune différence entre les formats `retraite` et `patrimoine`. La page n'affiche pas l'écran d'accueil sans compte.

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/other-assets/pages/AutresBiens.tsx` | La page : trois chiffres, tableau, ligne dépliée `Detail` (impôt par régime, estimations), sources citées. |
| UI | `packages/ui/src/features/other-assets/dialogs/OtherAssetDialog.tsx` | Fiche d'un bien : `DEFAULTS` par type, échéancier d'un prêt, démembrement, classe et allocation, archivage. |
| UI | `packages/ui/src/features/other-assets/index.ts` | Façade du domaine. |
| UI | `packages/ui/src/shared/components/DismembermentFields.tsx` | Champs « Droit détenu », naissance de l'usufruitier, fin de l'usufruit. |
| Core | `packages/core/src/other-assets/otherAssets.ts` | Types, valeur à une date, valeur détenue, vente rapide, impôt à la vente, échéancier d'un prêt. |
| Core | `packages/core/src/model/ownership.ts` | `dismembermentRatio`, `usufructRate`, `lifeUsufructRate`, `fixedUsufructPeriods`, `heldShareLabel`, `FULL_OWNERSHIP` (barème de l'art. 669 du CGI). |
| Core | `packages/core/src/loans/loan.ts` | `loanState` : capital restant d'un prêt avec échéancier. |
| Core | `packages/core/src/portfolio/engine.ts` | `netWorth.otherAssets` et allocation (seulement avec une classe personnalisée). |
| Core | `packages/core/src/portfolio/history.ts` | Valeur des autres biens à chaque point de l'historique. |
| API | `packages/api/src/other-assets/procedures.ts`, `packages/api/src/other-assets/inputs.ts` | `otherAssets.upsert` (`OtherAssetInput`), `otherAssets.delete`, `otherAssetValues.add` (`OtherAssetValueInput`), `otherAssetValues.delete`. |
| Backend | `packages/backend/src/handlers/other-assets.ts` | Handlers, `keepPastOtherValue`. |
| Backend | `packages/backend/src/db/schema/other-assets.ts` | Tables `other_assets` et `other_asset_values`. |
| Backend | `packages/backend/src/repo/mappers/other-assets.ts` | `mapOtherAsset`, `mapOtherAssetValue`. |

## Données

- `other_assets` : `kind` (`metal`, `objet`, `vehicule`, `societe`, `compte_courant`, `pret`, `autre`), `name`, `value_cents` et `value_date` (estimation la plus récente, du bien entier), `purchase_price_cents`, `purchase_date`, `share`, `dismemberment` (`pleine`, `usufruit`, `nue_propriete`), `usufruct_birth_date`, `usufruct_end`, `depreciation`, `quick_sale_discount`, `sale_delay_months`, `loan_principal_cents`, `loan_rate`, `loan_term_months`, `loan_first_payment`, `class_id`, `in_allocation`, `comment`, `archived`.
- `other_asset_values` : estimations passées, `asset_id` (`ON DELETE CASCADE`), `date`, `value_cents` ; unique sur `(asset_id, date)`.
- Les deux tables sont dans `TABLES` de `packages/backend/src/backup/dump.ts`.

Procédures :

- `otherAssets.upsert` : hors `societe`, force `dismemberment = "pleine"` ; sans démembrement, efface les dates d'usufruit ; garde l'échéancier seulement pour `pret`. En modification, si `value_date` change, l'ancienne valeur passe dans `other_asset_values`. `OtherAssetInput` exige, pour des parts démembrées, une date de naissance ou une date de fin d'usufruit ; `share` dans ]0 ; 1], `depreciation` ≤ 0,9.
- `otherAssetValues.add` : une estimation plus ancienne que `value_date` va dans l'historique ; une autre devient la valeur du bien et l'ancienne passe dans l'historique (écrasement à date égale).
- `otherAssets.delete`, `otherAssetValues.delete`.

Champs du `Workspace` : `otherAssets`, `otherAssetValues`, `params.customClasses`.

## Règles de calcul

**Valeur du bien entier** (`otherAssetValueAt(a, estimates, date)`).

1. `date < purchaseDate` → 0.
2. Prêt avec échéancier complet (`otherAssetLoan` : principal, durée et première échéance) → `principal` avant la première échéance, puis `loanState(loan, date).balance` (taux 0 si absent).
3. Sinon, points = estimations passées + (`valueDate`, `value`). Dernier point ≤ `date`. Sans point à cette date : `value` s'il n'y a aucun point du tout, sinon `purchasePrice ?? premier point` (sans baisse de valeur).
4. Baisse annuelle : `base × (1 − depreciation)^(mois écoulés / 12)` depuis la date du point retenu.

**Valeur détenue** (`otherAssetHeldValueAt`) : 0 si archivé (à toutes les dates) ; sinon `valeur × share × ratio`, `ratio = dismembermentRatio(a, date)` pour `societe`, 1 sinon.

**Démembrement** (`ownership.ts`, CGI art. 669, BOI-ENR-DMTG-10-40-10-50, vérifié le 2026-11-11 d'après le code) :

- `lifeUsufructRate(age)` : 0,9 avant 21 ans, 0,1 à partir de 91 ans, sinon `0,9 − floor((age − 11) / 10) × 0,1` (âge révolu à la date) ;
- usufruit à durée fixe : `min(1, 0,23 × périodes de dix ans commencées)`, plafonné par l'usufruit viager si la naissance est connue ; 0 une fois la fin passée ;
- nue-propriété = `1 − usufruit` ; usufruitier inconnu → ratio 1.

**Vente rapide** : `held × (1 − quickSaleDiscount)`. **Délai affiché** : `loanMonthsLeft` (mois avant la dernière échéance) pour un prêt avec échéancier, sinon `saleDelayMonths`.

**Impôt à la vente** (`otherAssetSaleTax`). Prix = `valeur du bien entier × share` (sans le ratio de démembrement) ; coût = `purchasePrice × share`. Règles « vérifiées le 11 novembre 2026 » (`SALE_TAX_VERIFIED_ON = "2026-11-11"`), sources affichées : BOFiP BOI-RPPM-PVBMC-20-20 et questions-réponses 2025 de la douane.

| Type | Calcul |
|---|---|
| `metal` | Taxe forfaitaire `prix × 11,5 %` (11 % + 0,5 % de CRDS ; CGI art. 150 VI à 150 VM) ; option plus-values si prix et date d'achat (CGI art. 150 VL) ; le moins cher est retenu. |
| `objet` | Exonéré si prix ≤ 5 000 € ; sinon `prix × 6,5 %` (6 % + CRDS) ou option plus-values. |
| `vehicule` | Exonéré (CGI art. 150 UA, II). |
| `autre` | Exonéré si prix ≤ 5 000 € ; sinon plus-values si prix et date d'achat, sinon non estimé. |
| `societe` | Non estimé. |
| `compte_courant`, `pret` | Exonéré (remboursement du capital). |

Régime des plus-values (`gainOption`) : `gain = prix − coût` ; `années = yearsBetween(purchaseDate, date)` (années révolues) ; abattement `movableGainAllowance` = 1 à partir de 22 ans, sinon `max(0, années − 2) × 5 %` (CGI art. 150 VC) ; impôt = `gain × (1 − abattement) × (19 % + 17,2 %)` (art. 200 B ; CSS art. L136-7 et L136-8, 17,2 % marqué « à confirmer » dans le code) ; 0 si `gain ≤ 0`.

**Dans le patrimoine.** `computePortfolio` : `netWorth.otherAssets = Σ otherAssetHeldValueAt(…, asOf)`, ajouté à `netWorth.net`. Allocation seulement si `classId` désigne une classe personnalisée existante et `inAllocation ?? classEnabled(classe)`. Le chiffre « Valeur détenue » de la page lit `netWorth.otherAssets` ; les autres totaux sont recalculés dans la page sur les biens non archivés.

## Tests

- `packages/core/src/other-assets/otherAssets.test.ts` : dernière estimation connue, baisse annuelle d'un véhicule, somme due d'un prêt avec échéancier, part détenue et droit détenu, rien pour un bien archivé ; abattement de 5 % par an au-delà de la deuxième année et exonération après 22 ans ; or à 11,5 % ou plus-values ; objets exonérés à 5 000 € puis 6,5 % ; voitures exonérées, parts non estimées ; patrimoine net et répartition avec une classe.
- `packages/core/src/model/ownership.test.ts` : barème de l'usufruit viager, âge révolu, usufruit à durée fixe, plafond, nue-propriété.
- `packages/backend/src/backend.test.ts` : « enregistre un autre bien, garde ses estimations passées et ne garde l'échéancier que pour un prêt ».
- `packages/ui/src/flows/placements.flow.test.tsx`, bloc « Autres biens » : tableau vide et sources, détail par régime, prêt à échéancier, bien archivé, suppression, nouveau bien (or), réglages par type, classe d'actifs, modification et archivage, annulation.

## Limites connues

- L'archivage remet la valeur à 0 à toutes les dates : le bien disparaît aussi de l'historique passé (c'est voulu d'après le libellé de la case, « historique compris »).
- Le total « Impôt si tout était vendu » compte 0 pour les biens non estimés (`tax == null`), sans le signaler.
- L'impôt se calcule sur `valeur × share` sans le ratio de démembrement ; seul `societe` peut être démembré, et il n'est pas estimé, donc sans effet aujourd'hui.
- Pas de distinction pour les véhicules de collection ni les meubles meublants (cités dans le commentaire du code).
- Les intérêts d'un `pret` ou d'un `compte_courant` ne sont pas suivis ici.
- Sans point d'estimation à la date mais avec des estimations plus tardives, la base est `purchasePrice` (ou la première estimation) sans baisse de valeur.
