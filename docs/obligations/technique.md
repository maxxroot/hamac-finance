# Obligations : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/obligations`, module `obligations`. Aucune différence entre les formats `retraite` et `patrimoine` (le texte de la note sur l'âge de sécurisation est le même dans les deux).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/investments/pages/Obligations.tsx` | La page : chiffres du haut, échelle (détenues, prévues, échues), formulaire « Prévoir un achat », `NextCouponLine`. |
| UI | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx`, `packages/ui/src/features/entry/dialogs/BondTradeFields.tsx` | Achat ou vente d'obligation : nominal, prix en %, coupon couru calculé ou saisi, frais, total. |
| UI | `packages/ui/src/features/entry/dialogs/NewAssetPanel.tsx` | Création d'une obligation à l'achat : nom automatique, jour d'échéance, doublon (`findSameBond`), `priceSource: "modele"`. |
| UI | `packages/ui/src/features/settings/dialogs/AssetDialog.tsx` | Fiche du titre : coupon, échéance, émetteur, fréquence, prochain coupon, source `modele` ou `manuel`. |
| UI | `packages/ui/src/shared/components/AccountEvolution.tsx` | `PositionEvolution` dans la ligne dépliée. |
| UI | `packages/ui/src/features/entry/components/Movements.tsx` | Mouvements des comptes-titres, filtrés sur les obligations. |
| Core | `packages/core/src/investments/bonds.ts` | Calendrier des coupons, coupon couru, flux restants, rendement actuariel, valeur détenue jusqu'à l'échéance. |
| Core | `packages/core/src/investments/bondnames.ts` | `maturityLabel`, `OAT_MATURITY_DAY`, `maturityFromMonth`, `bondName`, `findSameBond`. |
| Core | `packages/core/src/portfolio/engine.ts` | `bondTerms`, lots d'achat, remboursement à l'échéance, `valuePosition` (branche obligation), `BondInfo`, `maturedBonds`. |
| Core | `packages/core/src/model/domain.ts` | `BondPlan`, `BondKind`, `BOND_KIND_LABELS`. |
| API | `packages/api/src/investments/procedures.ts`, `packages/api/src/investments/inputs.ts` | `bondPlans.upsert` (`BondPlanInput`), `bondPlans.delete`. |
| Backend | `packages/backend/src/handlers/investments.ts` | Handlers `bondPlans.*`. |
| Backend | `packages/backend/src/handlers/assets.ts` | `assets.upsert` : `priceSource` forcé à `modele` pour une obligation en `auto`, coupon et échéance exigés, prochain coupon avant l'échéance. |
| Backend | `packages/backend/src/db/schema/investments.ts` | Table `bond_plans`. |
| Backend | `packages/backend/src/repo/mappers/investments.ts` | `mapBondPlan`. |
| Backend | `packages/backend/src/market/index.ts` | `chainFor` : aucune source de cours pour une obligation (« valeur calculée »). |

## Données

- `assets` (`packages/backend/src/db/schema/assets.ts`) : `kind = "obligation"`, `coupon_rate` (fraction), `maturity_date`, `coupon_frequency` (1 par défaut), `next_coupon_date` (ancre facultative), `issuer`, `bond_kind` (`etat` ou `entreprise`), `price_source` (`modele` ou `manuel`).
- `transactions` : achat et vente avec `quantity` = nominal en euros, `amount` = total frais et coupon couru compris (net reçu pour une vente), `fee`, `accrued_cents` (coupon couru saisi à la main ; null = calculé par `accruedFraction`). Coupons : opérations `interets` avec `asset_id` de l'obligation. Le remboursement n'est pas une opération : il est calculé.
- `bond_plans` (`packages/backend/src/db/schema/investments.ts`) : `account_id` (nullable, `ON DELETE SET NULL`), `label`, `target_year`, `nominal_cents`, `comment`. Présente dans `TABLES` de `packages/backend/src/backup/dump.ts`.

Procédures : `bondPlans.upsert`, `bondPlans.delete`, et pour les titres et opérations `assets.upsert`, `prices.setManual`, les procédures du journal.

Champs du `Workspace` : `bondPlans`, `accounts`, `assets`, `transactions`, `prices` (cours manuels), `params` (`alerts.ctoCashThreshold`, défaut 1 000 € ; `profile.birthYear`).

## Règles de calcul

Convention : les prix sont des fractions du nominal (0,9684 = 96,84 %). Quantité = nominal en euros (`docs/architecture/modele-de-donnees.md`, Conventions).

**Calendrier des coupons** (`periodAround`). Pas de `12 / frequency` mois. Sans ancre (ou ancre après l'échéance), le calendrier remonte depuis l'échéance. Avec ancre, multiples de la date connue (pas de dérive d'un 31 sur un mois de 30 jours). Le coupon du mois de l'échéance est remplacé par l'échéance elle-même. Une période qui s'arrête avant sa fin normale donne un dernier coupon réduit au prorata des jours (`couponOf`).

**Coupon couru** (`accruedFraction`) : `(couponRate / frequency) × jours écoulés depuis le dernier coupon / jours de la période`, base exact/exact de la période ; 0 à partir de l'échéance.

**Prochain coupon** (`nextCoupon`) : strictement après la date ; `null` une fois remboursé. Montant affiché = fraction × nominal. Le haut de page additionne les coupons de toutes les lignes qui tombent à la première date.

**Lots** (`computePortfolio`, achat). Pour chaque achat : `clean = (amount − fee) / quantity − couru`, où `couru` = `accrued / quantity` s'il est saisi, sinon `accruedFraction(date d'achat)`, stocké avec `qty`, `cost = amount`, `date`. Une vente réduit tous les lots au prorata (`takeOut`).

**Valeur** (`valuePosition`).

- Source `manuel` avec un cours à la date : `qty × (prix / 100 + couru du jour)`, `priceUsed = "manuel"`. Le cours saisi est donc pied de coupon, en % du nominal.
- Sinon : `Σ lots qty × heldToMaturityValue(terms, date d'achat, clean, asOf)`, `priceUsed = "modele"`. `heldToMaturityValue` = `clean + (1 − clean) × min(1, jours écoulés / jours jusqu'à l'échéance) + couru` ; 1 à partir de l'échéance. Le prix affiché est `(valeur / qty − couru) × 100`.

**Rendement à l'échéance** (`yieldToMaturity`). Racine de `Σ flux / (1 + r)^(jours / 365) − prix payé = 0` par dichotomie sur `[−0,5 ; 1]`, 200 itérations ; `null` si pas de changement de signe. Prix payé par lot = `cost / qty` (frais et couru compris). `BondInfo.ytm` = moyenne des lots pondérée par `cost`. La moyenne de la page est `Σ ytm × cost / Σ cost` des lignes détenues. `approxYtm` (formule approchée du sheet, OAT!L) n'est gardée que pour comparaison.

**Autres champs de `BondInfo`** : `nominal = qty`, `annualCoupon = nominal × couponRate`, `accrued = nominal × couru`, `yearsLeft = jours jusqu'à l'échéance / 365,25`, `ageAtMaturity = année d'échéance − birthYear` (`ageInYear`), `matured`.

**Échéance** (événement `maturity`, rang 10 ce jour-là). Pour chaque couple compte-titre ayant une opération ≤ `asOf` sur une obligation échue : `moveMoney(nominal)` (espèces, ou fonds euros par défaut pour un contrat qui en a un), `realized += qty − cost`, un `Disposal` de type `remboursement`, puis la position passe dans `maturedBonds`. Le gain affiché sur une ligne échue est ce `realizedGain` : coupons exclus.

**Noms et doublons** (`bondnames.ts`). `bondName` : « OAT » si l'émetteur est vide ou la République française, sinon l'émetteur ; puis coupon et « mois année ». `maturityFromMonth` : le 25 pour une OAT (convention de l'Agence France Trésor citée dans le code), sinon le jour donné, sinon le 1er. `findSameBond` : même ISIN, sinon même coupon, même échéance et même émetteur (une OAT reconnaît aussi une autre OAT).

**Page.** `holders` = comptes avec une obligation détenue, une obligation échue, ou de type `cto`. Espèces en attente = espèces des CTO non archivés. Âge d'une ligne prévue = `targetYear − birthYear`. Une ligne prévue est créée avec `accountId` du premier CTO (ou `null`).

Aucune règle fiscale sur cette page. Le registre des cessions (`disposals`) alimente les plus-values du compte-titres (`packages/core/src/portfolio/securitiesGains.ts`).

## Tests

- `packages/core/src/investments/bonds.test.ts` : encadrement entre deux coupons, coupon couru, flux restants, date de coupon indiquée (semestriel, dernier coupon réduit, jour d'échéance différent), rendement au pair et sous le pair, valeur détenue qui rejoint 100 %.
- `packages/core/src/investments/bondnames.test.ts` : noms, jour d'échéance, doublons.
- `packages/core/src/portfolio/engine.test.ts` : « obligation : valorisation amortie, puis remboursement du nominal à l'échéance », « date le remboursement d'une obligation à son échéance », « le coupon couru saisi à la main remplace le calcul pour le prix d'achat ».
- `packages/core/src/model/validation.test.ts` : coupon couru saisi, seulement sur l'achat ou la vente d'une obligation.
- `packages/backend/src/handlers/bonds.test.ts` : date de coupon facultative, refusée après l'échéance, ignorée hors obligation.
- `packages/backend/src/backend.test.ts` : « crée l'obligation et l'achat ensemble » (coupon couru saisi gardé au centime).
- `packages/ui/src/flows/suivi.flow.test.tsx` : « obligation : coupon couru calculé, ou saisi à la main d'après l'avis d'opéré ».
- `packages/ui/src/flows/placements.flow.test.tsx`, blocs « Obligations », « Nouveau titre à l'achat (NewAssetPanel) » et « Fiche d'un titre (AssetDialog) ».

## Limites connues

- Valeur amortie linéairement, pas actuariellement ; elle ne suit pas les taux du marché. Les frais ne sont pas dans la valeur : la plus-value démarre à −frais.
- Les coupons ne sont pas générés : seul le remboursement du nominal est automatique.
- La page n'ouvre pas `PriceDialog` : un cours manuel se saisit depuis la fiche du titre, et il n'est lu que si `priceSource === "manuel"`.
- « Espèces en attente », le bouton d'achat et les mouvements ne portent que sur les comptes `cto`, alors que les obligations détenues dans une assurance-vie apparaissent dans l'échelle.
- `holders` ne filtre pas les comptes archivés.
- Une ligne prévue n'est pas reliée à l'achat réel : rien ne la supprime ni ne la marque comme réalisée.
- La note « avant l'âge de sécurisation… » n'est pas adaptée au format `patrimoine`, où `securisationAge` n'est pas proposé dans Paramètres.
