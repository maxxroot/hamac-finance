# Obligations : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/obligations`, module `obligations`. Le format `patrimoine` (`isRetirementPlan` faux) masque la colonne « Âge à l'échéance », l'âge des lignes prévues, l'âge et le repère « Retraite » de l'échelle des échéances, et la seconde phrase du rappel (âge de sécurisation).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/investments/pages/Obligations/Obligations.tsx` | La page : assemble chiffres, tableau, graphiques, formulaire et rappel. |
| UI | `packages/ui/src/features/investments/pages/Obligations/_useBondData.ts` | `useBondData` : tous les calculs de la page en un `useMemo` (lignes, flux, échelle, répartition, coupons, impôts, rendements réalisés). |
| UI | `packages/ui/src/features/investments/pages/Obligations/_BondStats.tsx` | Les huit tuiles ; `TaxDetail`, le détail des impôts au survol. |
| UI | `packages/ui/src/features/investments/pages/Obligations/_BondTable.tsx` | Le tableau (détenues, prévues, échues), une seule ligne par cellule (pas de type, d'ISIN ni de prochain coupon sous les valeurs), colonne Compte (`AccountLink`), colonne d'âge conditionnelle. |
| UI | `packages/ui/src/shared/components/AccountStrip.tsx` | Bandeau des comptes concernés (`useBondData().accounts` : détenteurs non archivés, sinon comptes-titres ouverts). |
| UI | `packages/ui/src/features/investments/pages/Obligations/_BondDetail.tsx` | Ligne dépliée : coupons sur l'année (`annualCoupon`, nombre de versements = `frequency`), prix d'achat, coupon couru, coupons reçus, gain total, rendement après impôts, puis `PositionEvolution`. |
| UI | `packages/ui/src/features/investments/pages/Obligations/_PlanForm.tsx` | Formulaire « Prévoir un achat ». |
| UI | `packages/ui/src/features/investments/components/DispenseStatus.tsx` | État de l'acompte de 12,8 % pour l'année en cours par établissement (`withholdingDispensed`), comptes hors assurance-vie et PER (`taxAccounts` de `useBondData`) ; rappel pour l'année suivante pendant `dispenseReminderSeason`. Partagé avec la page Crowdlending. |
| UI | `packages/ui/src/features/investments/components/BondCharts/` | Les six graphiques : `LadderChart` (« Échéancier des remboursements »), `FlowsChart` (« Échéancier des flux »), `TrajectoryChart` (« Évolution de l'encours »), `CouponsChart` (« Coupons perçus et échus »), `IssuersChart` (« Répartition par émetteur »), `YieldChart` (« Rendement actuariel par maturité ») ; couleurs et libellés communs dans `_bits.ts`. |
| UI | `packages/ui/src/shared/components/Stat.tsx` | `Stat` accepte `detail` : explication affichée au survol ou au focus clavier de la tuile. |
| UI | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx`, `packages/ui/src/features/entry/dialogs/BondTradeFields.tsx` | Achat ou vente d'obligation : nominal, prix en %, coupon couru calculé ou saisi, frais, total. |
| UI | `packages/ui/src/features/entry/dialogs/NewAssetPanel.tsx` | Création d'une obligation à l'achat : nom automatique, jour d'échéance, pays de l'État (choisi, ou lu dans l'ISIN saisi), doublon (`findSameBond`), `priceSource: "modele"`. |
| UI | `packages/ui/src/features/entry/components/BondFields.tsx` | `SovereignField` (pays de l'État émetteur) et `BondMaturityField` (mois et année pour une OAT ou une entreprise, date exacte pour un autre État), partagés par `NewAssetPanel` et `AssetDialog`. |
| UI | `packages/ui/src/shared/components/CountryPicker.tsx`, `packages/ui/src/shared/components/Flag.tsx`, `packages/ui/src/shared/lib/countrySearch.ts` | Liste de pays avec recherche (accents et majuscules ignorés, noms qui commencent par la recherche d'abord), clavier (flèches, Entrée, Échap qui ne ferme pas la fenêtre) et drapeaux. Les drapeaux viennent du paquet `flag-icons` (MIT) : un fichier SVG par pays, servi par l'application (`?url&no-inline`), chargé seulement quand il s'affiche. |
| UI | `packages/ui/src/features/settings/dialogs/AssetDialog.tsx` | Fiche du titre : coupon, échéance, pays de l'État ou émetteur, fréquence, prochain coupon, source `modele` ou `manuel`. |
| UI | `packages/ui/src/shared/components/AccountEvolution.tsx` | `PositionEvolution` dans la ligne dépliée. |
| UI | `packages/ui/src/features/entry/components/Movements.tsx` | Mouvements des comptes-titres, filtrés sur les obligations. |
| Core | `packages/core/src/investments/bonds.ts` | Calendrier des coupons, coupon couru, flux restants, rendement actuariel, valeur détenue jusqu'à l'échéance. |
| Core | `packages/core/src/investments/bondnames.ts` | `maturityLabel`, `OAT_MATURITY_DAY`, `maturityFromMonth`, `bondName`, `findSameBond`. |
| Core | `packages/core/src/investments/bondIssuers.ts` | `SOVEREIGN_COUNTRIES` (193 États de l'ONU), `countryName`, `countryFromIsin`, `bondKindOf`, `sovereignCountry`, `isOat`, `sovereignDebtName`, `sovereignLabel`. |
| Core | `packages/core/src/portfolio/engine.ts` | `bondTerms`, lots d'achat, remboursement à l'échéance, `valuePosition` (branche obligation), `BondInfo`, `maturedBonds`. |
| Core | `packages/core/src/model/domain.ts` | `BondPlan`, `BondKind`, `BOND_KIND_LABELS`. |
| Core | `packages/core/src/analysis/bonds/` | Statistiques de la page : `upcomingBondFlows`, `flowsWithin`, `flowsByYear`, `valueTrajectory`, `trajectoryByYear` (`_flows.ts`) ; `maturityLadder`, `bondBreakdown` (`_ladder.ts`) ; `couponCheck` (`_coupons.ts`) ; `realizedBondYield` (`_realized.ts`) ; `bondGain` (`_summary.ts`). |
| Core | `packages/core/src/tax/bondTax.ts` | `bondTaxes` : rendement après impôts et impôts à venir, coupons et remboursements séparés. |
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

**Autres champs de `BondInfo`** : `lots` (date, nominal, coût, prix pied de coupon de chaque achat encore détenu), `nominal = qty`, `annualCoupon = nominal × couponRate`, `accrued = nominal × couru`, `yearsLeft = jours jusqu'à l'échéance / 365,25`, `ageAtMaturity = année d'échéance − birthYear` (`ageInYear`), `matured`.

**Échéance** (événement `maturity`, rang 10 ce jour-là). Pour chaque couple compte-titre ayant une opération ≤ `asOf` sur une obligation échue : `moveMoney(nominal)` (espèces, ou fonds euros par défaut pour un contrat qui en a un), `realized += qty − cost`, un `Disposal` de type `remboursement`, puis la position passe dans `maturedBonds`. Le gain affiché sur une ligne échue est ce `realizedGain` : coupons exclus.

**Pays de l'État émetteur** (`bondIssuers.ts`). Une obligation `bondKind = etat` porte `issuerCountry` (ISO 3166-1 alpha-2, l'un des 193 États de l'ONU, contrôlé par `AssetInput`). `sovereignCountry` : celui de la fiche ; `FR` pour une fiche d'État sans pays (`DEFAULT_SOVEREIGN`, avant la migration 0034 seule la France existait) ; `null` pour une entreprise. `countryFromIsin` : les deux premières lettres de l'ISIN si elles désignent un État (la dette d'un État porte le code de son pays ; `XS`, `EU`… n'en sont pas). `assets.upsert` enregistre pour une obligation d'État le pays donné, sinon celui de l'ISIN, sinon `FR`, et vide `issuer`, qui pourrait contredire le pays ; pour une entreprise, `issuerCountry` est vidé. La recherche OpenFIGI (`sovereignOf` dans `market/sources/openfigi.ts`) reconnaît la dette d'un État au secteur `Govt` et donne son pays par l'ISIN, sinon par le préfixe du ticker (`FRTR`, `BGB`, `DBR`…). Noms des pays : `Intl.DisplayNames` en français.

**Noms et doublons** (`bondnames.ts`). `bondName` : pour un État, le nom d'usage de sa dette (`sovereignDebtName` : OAT, OLO, Bund, BTP, Bono ; ailleurs le nom du pays), sinon l'émetteur ; puis coupon et « mois année ». `maturityFromMonth(mois, oat)` : le 25 pour une OAT (`isOat` : État français ; convention de l'Agence France Trésor citée dans le code), sinon le jour donné, sinon le 1er. Pour un autre État, l'échéance se saisit à la date exacte. `findSameBond` : même ISIN, sinon même coupon, même échéance et même émetteur ; pour un État, le même pays.

**Flux à venir** (`upcomingBondFlows`). Pour chaque ligne détenue, `remainingFlows(terms, aujourd'hui)` × nominal, le remboursement (100 %) séparé du dernier coupon. « À recevoir sur 12 mois » (`flowsWithin`) : flux après aujourd'hui et jusqu'au même jour dans 12 mois inclus. `flowsByYear` : par année civile, sans trou.

**Évolution de l'encours** (`valueTrajectory`). Un point par mois d'aujourd'hui à la dernière échéance, plus chaque 31 décembre et chaque date d'échéance. Valeur = `Σ lots qty × heldToMaturityValue(terms, date d'achat, clean, date)` des lignes pas encore échues (la valeur du jour pour le premier point, cours saisi compris) ; remboursé et coupons = cumul des flux à venir jusqu'à la date. `trajectoryByYear` en garde le premier point (aujourd'hui) puis le dernier point de chaque année civile, la dernière année s'arrêtant à la dernière échéance. Le graphique empile deux barres : « Encours » (`value`) et « Flux encaissés » (`coupons + redeemed`, détaillés dans l'info-bulle).

**Échelle** (`maturityLadder`). Nominal détenu par année d'échéance et par type, plus le nominal des lignes prévues (`targetYear`), de l'année en cours (ou de la plus ancienne) à la dernière ; les années vides restent. Type (`bondKindOf`, `bondIssuers.ts`) : celui de la fiche ; sans type, `etat` si l'émetteur est vide ou la République française.

**Répartition** (`bondBreakdown`). Sur le nominal détenu : part de l'État et des entreprises ; par émetteur, un État par pays (`sovereignLabel` : « État · Belgique », `IssuerShare.country`), sinon l'émetteur de la fiche, sinon le nom du titre. Le graphique regroupe au-delà de 8 émetteurs.

**Coupons attendus et saisis** (`couponCheck`). Pour chaque couple compte-titre d'obligation : calendrier `remainingFlows` depuis le premier achat, jusqu'à aujourd'hui. Coupon attendu = part coupon × nominal détenu la veille (achats − ventes − arbitrages sortants + arbitrages entrants, date strictement antérieure). Rapprochement : la première opération `interets` sur ce titre et ce compte, non encore utilisée, datée de 15 jours avant à 45 jours après. Montant reçu = `gross` s'il est saisi, sinon `amount` (le net). Un coupon dû depuis moins de `COUPON_GRACE_DAYS` (10 jours) n'est compté que s'il est déjà saisi. Les coupons saisis non rapprochés comptent dans les reçus de leur année. Lignes échues comprises.

**Performance cumulée** (`bondGain`). Plus-value latente des lignes détenues + gains réalisés (remboursements et ventes, lignes détenues et échues) + coupons saisis (bruts si connus).

**Rendement réalisé d'une ligne échue** (`realizedBondYield`). `xirr` sur les achats (−montant), ventes (+), coupons saisis (+ brut si connu) et le nominal restant à l'échéance. Les arbitrages en assurance-vie n'y sont pas.

**Impôts et rendement après impôts** (`bondTaxes`). Par lot : `xirr` de −coût à la date d'achat, puis chaque coupon × (1 − taux coupon à sa date), et à l'échéance nominal − gain × taux gain, avec gain = max(0, nominal − coût du lot). Moyenne pondérée par le coût, comme le rendement brut. Taux :
- compte-titres et autres comptes : IR = `incomeTaxRate` (PFU 12,8 %, CGI art. 200 A, ou la tranche si plus basse) ; coupons + `socialRateFor(année, "placement")`, gain + `socialRateFor(année, "patrimoine")` (CSS art. L136-6, L136-7, L136-8 ; LFSS 2026 art. 12). Le gain au remboursement est traité en plus-value de cession (CGI art. 150-0 A), comme le registre des cessions (`Disposal` de type `remboursement`) ;
- assurance-vie : `min(tmi, avBefore8 | avAfter8)` selon l'âge du contrat à la date du flux (CGI art. 125-0 A) + `socialAv`, sur les coupons comme sur le gain.
Impôts à venir (détail au survol) : coupons à venir depuis aujourd'hui × taux coupon, et gain des lots × taux gain à l'échéance ; le taux affiché est l'impôt divisé par sa base.

**Page.** `holders` = comptes avec une obligation détenue ou échue : un compte-titres peut aussi détenir des actions, il n'est pas rattaché d'office. `ctos` = CTO non archivés parmi `holders`, sinon tous les CTO non archivés (où s'achètera la première obligation). Espèces en attente = espèces de `ctos`. Mouvements : seulement ceux qui portent sur une obligation (`Movements` avec `withCash={false}`). Âge d'une ligne prévue = `targetYear − birthYear`. Une ligne prévue est créée avec `accountId` du premier de `ctos` (ou `null`).

Aucune règle fiscale sur cette page. Le registre des cessions (`disposals`) alimente les plus-values du compte-titres (`packages/core/src/portfolio/securitiesGains.ts`).

## Tests

- `packages/core/src/investments/bonds.test.ts` : encadrement entre deux coupons, coupon couru, flux restants, date de coupon indiquée (semestriel, dernier coupon réduit, jour d'échéance différent), rendement au pair et sous le pair, valeur détenue qui rejoint 100 %.
- `packages/core/src/investments/bondnames.test.ts` : noms (OAT, OLO, autre État), jour d'échéance, doublons (deux États au même coupon et à la même échéance ne se confondent pas).
- `packages/core/src/investments/bondIssuers.test.ts` : liste des États, noms en français, pays lu dans l'ISIN, pays par défaut des fiches anciennes, OAT seulement pour la France.
- `packages/backend/src/market/market.test.ts` : `sovereignOf` (pays par l'ISIN ou le ticker, rien pour une entreprise).
- `packages/core/src/analysis/bonds/bonds.test.ts` : flux à venir (12 mois, par année), trajectoire, échelle avec trous et ligne prévue, répartition, coupons attendus et saisis (brut, manquants, délai de 10 jours, droit au coupon la veille), rendement obtenu calculé à la main, gain total.
- `packages/core/src/tax/bondTax.test.ts` : compte-titres (31,4 % sur coupons et gain, rendement net calculé à la main), assurance-vie de plus de 8 ans, achat au-dessus du pair.
- `packages/core/src/portfolio/engine.test.ts` : « obligation : valorisation amortie, puis remboursement du nominal à l'échéance », « date le remboursement d'une obligation à son échéance », « le coupon couru saisi à la main remplace le calcul pour le prix d'achat ».
- `packages/core/src/model/validation.test.ts` : coupon couru saisi, seulement sur l'achat ou la vente d'une obligation.
- `packages/backend/src/handlers/bonds.test.ts` : date de coupon facultative, refusée après l'échéance, ignorée hors obligation ; pays de l'État (donné, lu dans l'ISIN, ou France ; code refusé s'il n'est pas un État) et migration 0034 (pays lu dans l'ISIN, nom « OAT » corrigé pour la Belgique, l'Allemagne, l'Italie et l'Espagne, émetteur retiré).
- `packages/backend/src/backend.test.ts` : « crée l'obligation et l'achat ensemble » (coupon couru saisi gardé au centime).
- `packages/ui/src/flows/suivi.flow.test.tsx` : « obligation : coupon couru calculé, ou saisi à la main d'après l'avis d'opéré ».
- `packages/ui/src/flows/placements.flow.test.tsx`, bloc « Obligations » (dont « obligation d'un autre État » : pays cherché dans la liste, OLO, échéance exacte, Échap ; tuiles, détail des impôts, coupons non saisis, six graphiques, âge sur l'échelle en plan retraite, rien de tout cela en gestion de patrimoine), blocs, « Nouveau titre à l'achat (NewAssetPanel) » et « Fiche d'un titre (AssetDialog) ».

## Limites connues

- Valeur amortie linéairement, pas actuariellement ; elle ne suit pas les taux du marché. Les frais ne sont pas dans la valeur : la plus-value démarre à −frais.
- Les coupons ne sont pas générés : seul le remboursement du nominal est automatique.
- La page n'ouvre pas `PriceDialog` : un cours manuel se saisit depuis la fiche du titre, et il n'est lu que si `priceSource === "manuel"`.
- « Espèces en attente », le bouton d'achat et les mouvements ne portent que sur les comptes `cto`, alors que les obligations détenues dans une assurance-vie apparaissent dans l'échelle.
- `holders` ne filtre pas les comptes archivés.
- Une ligne prévue n'est pas reliée à l'achat réel : rien ne la supprime ni ne la marque comme réalisée.
- Impôts : l'abattement annuel de l'assurance-vie et le seuil de 150 000 € de versements ne sont pas comptés ; chaque flux d'une assurance-vie est imposé comme s'il était retiré le jour où il arrive. Une perte au remboursement ne réduit aucun impôt (elle s'impute ailleurs). Le gain est calculé par lot et non au prix moyen pondéré ; le coupon couru payé à l'achat réduit ce gain puisqu'il est dans le coût.
- Rapprochement des coupons : un coupon saisi hors de la fenêtre (−15 / +45 jours) n'est pas rapproché et le coupon échu reste « non saisi ». Saisi au net sans brut, le perçu paraît plus bas que l'échu.
- La migration 0034 ne corrige pas le jour d'échéance d'une obligation d'un autre État saisie comme OAT (elle avait reçu le 25) : à reprendre dans la fiche. Le nom n'est corrigé que pour la Belgique, l'Allemagne, l'Italie et l'Espagne.
- Les émetteurs supranationaux (Union européenne, BEI) ne sont pas des États : ils se saisissent en obligation d'entreprise.
- La trajectoire suppose qu'aucune ligne n'est vendue et ne compte pas le réinvestissement des coupons et remboursements.

## Vocabulaire

Libellés de la page : vocabulaire financier français d'usage (teneurs de compte, Agence France Trésor), sans anglicisme : encours, flux encaissés, coupons perçus et échus, prime de remboursement, rendement actuariel brut et net de fiscalité, performance cumulée, émetteur souverain, détachement du coupon, prix pied de coupon.
