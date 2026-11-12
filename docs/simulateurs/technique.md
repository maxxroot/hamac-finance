# Simulateurs : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/planning/pages/Simulateurs.tsx` | Page `/simulateurs` : réglages communs, comparateur (`Comparator`, lignes `ROWS`), fiche (`ResultPanel`), tableau annuel (`YearTable`). État local recopié dans le paramètre d'adresse `s`. |
| UI | `packages/ui/src/features/planning/components/SimForms.tsx` | `SimForm` : un formulaire par sorte de placement ; `DateInput` (date transmise seulement quand elle est complète et plausible, années 1950–2150). |
| UI | `packages/ui/src/features/planning/lib/simulateurs.ts` | Logique sans React : `SIM_KINDS`, valeurs par défaut, `newSim`, `encodeState` / `decodeState` (JSON en base64url), `taxContext`, `withHorizon`, `runSim`, `linesByYear`. |
| UI | `packages/ui/src/shared/lib/portfolio.ts` | `useEngineData` : seule source des `params` utilisés. |
| UI | `packages/ui/src/shared/nav.ts` | Entrée `/simulateurs`, `module: "simulateurs"`. |
| UI | `packages/ui/src/app/App.tsx` | Route `/simulateurs`. |
| Core | `packages/core/src/planning/simulation.ts` | Moteur commun : `SIM_RULES`, `SIM_SOURCES`, `socialRate`, `incomeTaxOn`, `incomeLine`, `simResult`, `reinvestToHorizon`, types `SimTax`, `SimLine`, `SimResult`. |
| Core | `packages/core/src/planning/simulators.ts` | Placements : `simulateBond`, `bondResalePrice`, `simulateEquity`, `simulateEuroFund`, `simulateLending`, `simulateSavings`, `bestRegime`. |
| Core | `packages/core/src/planning/projection.ts` | `annuity` (mensualités constantes du crowdlending). |
| Core | `packages/core/src/tax/fiscalRules.ts` | `socialRateFor` : 17,2 % ou taux des paramètres selon l'année et la nature du revenu. |
| Core | `packages/core/src/investments/` | `accruedFraction`, `remainingFlows`, `yieldToMaturity` (obligations). |
| Core | `packages/core/src/base/xirr.ts`, `packages/core/src/base/dates.ts` | `xirr` (base exact/365), `daysBetween`, `addMonths`. |
| Core | `packages/core/src/model/params.ts` | `PlanParams.tax` (taux), `profile.couple`. |

Pas de procédure, pas de table : la page ne lit que `params` et n'écrit rien.

## Données

- **Aucune table, aucune procédure.** L'état complet (`SimState` : `amount`, `horizon`, `reinvestPct`, `regime`, `tmi`, `couple`, `sims`, `selected`) est encodé en JSON puis en base64url dans `?s=`. La page tient l'état en mémoire et réécrit l'adresse à chaque modification (`replace: true`) ; elle ne relit l'adresse que si elle change de l'extérieur (retour arrière, lien ouvert).
- **`decodeState`** est défensif : 8 simulations au plus, nom tronqué à 60 caractères, chaque champ repris seulement s'il a le type de la valeur par défaut (chaînes de 40 caractères au plus), `amount > 0`, `horizon` entier de 1 à 50, `reinvestPct` de 0 à 20, `tmi` parmi les tranches connues. Une liste vidée volontairement reste vide ; une adresse illisible reprend l'exemple par défaut (une obligation).
- **Champs du `Workspace` lus** : `params.tax` (`tmi`, `pfuIncomeTax`, `socialGeneral`, `socialAv`, `avAfter8`, `avAllowanceSingle`, `avAllowanceCouple`) et `params.profile.couple`, via `taxContext` (la TMI et le couple de la page priment s'ils sont renseignés).
- **Valeurs par défaut** (`defaultInput`) : obligation à 90 %, coupon 3 %, annuel, échéance à 5 ans ; ETF en PEA à 7 %, frais 0,2 %, 10 ans ; fonds euros à 2,5 %, 8 ans ; prêt à 9 %, 36 mois, amortissable, 3 % de défaut ; Livret A à 1,7 %, 5 ans. Montant 10 000 €, taux de réinvestissement `DEFAULT_REINVEST = 1,7`.

## Règles de calcul

### Moteur commun (`simulation.ts`)

Chaque placement produit des `SimLine` datées et deux séries de flux : `grossFlows` (sans aucun impôt) et `netFlows` (encaissé après impôts). `simResult` en tire `grossRate = xirr(grossFlows)`, `netRate = xirr(netFlows)`, les gains (somme des flux), l'impôt et les prélèvements (somme des lignes), la durée en années de 365,25 jours. Les taux saisis sont en pourcentage (3 pour 3 %).

- **Impôt** (`incomeTaxOn`) : PFU = `base × params.tax.pfuIncomeTax`. Barème = `max(0, base × (1 − 0,4 si dividende) − base × 0,068 si CSG déductible) × tmi`. La CSG déductible est comptée la même année (elle se déduit en réalité l'année suivante, dit le commentaire).
- **Prélèvements sociaux** (`socialRate`) : `exonere` 0 ; `assuranceVie` = `params.tax.socialAv` ; `placement` et `pea` = `socialRateFor(année, "placement")` ; `patrimoine` = `socialRateFor(année, "patrimoine")`. `socialRateFor` renvoie 0,172 avant 2026 (placement) ou avant 2025 (patrimoine), puis `params.tax.socialGeneral`.
- **`bestRegime`** : calcule au PFU, puis au barème si `baremeEligible` ; garde le barème si son gain net dépasse celui du PFU de plus d'un demi-centime.
- **`reinvestToHorizon`** : chaque flux après le premier est capitalisé jusqu'à la date commune à `(1 + taux)^(jours / 365)` ; les flux bruts et nets deviennent deux flux (versement, valeur finale). Une ligne « Sommes replacées jusqu'à la fin » est ajoutée s'il y avait des encaissements avant la fin.

Règles et sources citées dans le code (`SIM_RULES`, `SIM_SOURCES`, commentaires) :

| Règle | Valeur dans le code | Source citée |
|---|---|---|
| Abattement sur dividendes, au barème | 40 % | CGI, art. 158, 3, 2° |
| CSG déductible | 6,8 % | CGI, art. 154 quinquies |
| PEA sans impôt sur le revenu | après 5 ans | CGI, art. 157, 5° bis ; BOI-RPPM-RCM-40-50-40 |
| Assurance-vie, abattement et taux réduit | après 8 ans | CGI, art. 125-0 A ; BOI-RPPM-RCM-20-15 ; BOI-RPPM-RCM-20-10-20-50 |
| Report des pertes de prêts participatifs | année de la perte + 5 suivantes | CGI, art. 125-00 A |
| Plafond annuel des pertes imputables | 8 000 € | BOI-RPPM-RCM-20-10-20-30, § 106 |
| Prélèvements sociaux à 18,6 % | revenus du patrimoine dès 2025, produits de placement dès 2026 | LFSS 2026 (loi n° 2025-1403), art. 12 |
| Produits restés à 17,2 % (assurance-vie) | 17,2 % | CSS, art. L136-8 |
| Prime de remboursement | imposée comme intérêt au remboursement | BOI-RPPM-RCM-20-10-20-20, § 200 et 340 à 380 |
| Coupon couru compris dans le prix de cession | — | BOI-RPPM-PVBMI-20-10-10-10, § 20 |
| PFU, barème, abattement de 40 % | — | impots.gouv.fr, « Les revenus mobiliers » |
| Plus-values mobilières | — | impots.gouv.fr, « Les cessions mobilières » |
| Livret A exonéré | — | service-public.gouv.fr, F2365 |

Taux par défaut dans `defaultParams` (`packages/core/src/model/params.ts`, « valeurs par défaut : fiscalité 2026 ») : `pfuIncomeTax` 0,128, `socialGeneral` 0,186, `socialAv` 0,172, `avAfter8` 0,075, `avAllowanceSingle` 4 600, `avAllowanceCouple` 9 200. Ni `SIM_RULES` ni `socialRateFor` ne portent de date de vérification ; la table `RULES` de `fiscalRules.ts` (vérifiée le 2026-11-09, brochure IR 2026) sert à la déclaration, pas aux simulateurs.

### Par placement (`simulators.ts`)

- **Obligation** (`simulateBond`) : nominal = `(montant − frais fixes) / ((prix + coupon couru) × (1 + frais %))`. Coupons : intérêts, `placement`, imposés en entier même avec coupon couru payé à l'achat. À l'échéance : prime `nominal × (1 − prix)` imposée comme intérêt si positive, perte non déductible sinon. Revente (si `holdYears` donne une date avant l'échéance) : prix saisi, ou `bondResalePrice` (prix qui garde le rendement à l'achat) ; gain = reçu net de frais (coupon couru compris) − montant investi, imposé en plus-value `patrimoine` ; mêmes frais qu'à l'achat. `baremeEligible: true`.
- **ETF et actions** (`simulateEquity`) : valeur `× (1 + r − d − frais)` chaque année ; dividendes (compte-titres seulement) imposés chaque année en `dividende` / `placement` ; frais fixes annuels payés à côté en compte-titres, prélevés dans l'enveloppe sinon ; frais de vente sauf assurance-vie. Sortie : compte-titres → plus-value `patrimoine` ; PEA → prélèvements `pea` sur le gain, impôt seulement si ancienneté + durée < 5 (`baremeEligible` faux après 5 ans) ; assurance-vie → `lifeInsuranceExit`.
- **`lifeInsuranceExit`** : gain = valeur − primes ; prélèvements `assuranceVie` si demandés ; après 8 ans, base = gain − abattement (couple ou seul), puis `avAfter8` au PFU ou `incomeTaxOn` au barème ; avant 8 ans, `incomeTaxOn` (donc `pfuIncomeTax` au PFU).
- **Fonds euros** (`simulateEuroFund`) : chaque année, intérêts sur le net, prélèvements `assuranceVie` retenus dans le contrat (lignes `kept`) ; rachat par `lifeInsuranceExit` sans prélèvements et sans CSG déductible. Le flux brut capitalise `montant × (1 − frais) × (1 + r)^n`.
- **Crowdlending** (`simulateLending`) : taux mensuel = taux / 12 ; amortissable par `annuity`, in fine capital au dernier mois. La part en défaut ne produit rien. Avec une durée commune plus courte, arrêt au mois `horizon × 12`, capital restant dû compté au pair, sans imposition. Si le prêt va à son terme : perte imputée sur les intérêts de cette simulation des années `[fin, fin + 5]`, dans la limite de 8 000 €, crédit d'impôt sur le revenu seulement (`incomeTaxOn(..., false)`).
- **Livret** (`simulateSavings`) : réglementé → exonéré, `baremeEligible: false` ; fiscalisé → intérêts imposés chaque année (`placement`), capitalisés nets.

### Interface (`lib/simulateurs.ts`)

- `withHorizon` : obligation → `holdYears = durée commune` ; ETF, fonds euros, livret → `years = durée commune` ; prêt inchangé (l'arrêt passe par `horizonMonths`).
- `runSim` : applique la durée commune, puis `reinvestToHorizon` à `addMonths(départ, 12 × durée)` ; renvoie `null` si le calcul lève une erreur ou s'il n'y a qu'une ligne (échéance passée). Le choix « auto » prend `best`, « barème » prend le barème s'il existe, sinon le PFU.
- `linesByYear` : regroupe par année civile ; les lignes `kept` comptent dans l'impôt mais pas dans l'argent reçu ni le net.

## Tests

| Fichier | Ce qui est couvert |
|---|---|
| `packages/core/src/planning/simulators.test.ts` | Obligation sous le pair (PFU, barème), au-dessus du pair, frais fixes, coupon couru ; revente avant l'échéance (prix estimé, plus-value, moins-value, durée au-delà de l'échéance) ; durée commune (sans et avec réinvestissement, prêt arrêté) ; PEA avant et après 5 ans ; compte-titres avec dividendes ; frais fixes ; assurance-vie après 8 ans ; fonds euros avant et après 8 ans ; crowdlending in fine, défaut, plafond de 8 000 € ; livrets réglementé et fiscalisé. |
| `packages/ui/src/features/planning/lib/simulateurs.test.ts` | Aller-retour de l'état dans l'adresse (accents compris), liste vide, adresse abîmée ; choix du plus avantageux ; échéance passée ; année par année ; durée commune (arrêt au même jour, obligation remboursée puis argent replacé, obligation revendue). |
| `packages/ui/src/features/planning/simulateurs.flow.test.tsx` | Obligation par défaut, ajout d'un ETF, comparaison ; saisie au clavier (focus, dates, nom) avec et sans le routeur ; modifier, renommer, supprimer, annuler, durée commune depuis le comparateur. |
| `packages/ui/src/flows/suivi.flow.test.tsx`, bloc `describe("simulateurs")` | Dupliquer, supprimer, annuler, couple, ouverture par clic dans le tableau ; formulaires du prêt, du livret, des actions en compte-titres et en assurance-vie. |

## Limites connues

- Plusieurs textes affichent un taux fixe alors que le calcul lit les paramètres : « Prélèvement forfaitaire (12,8 %) » (`REGIME_LABELS`), « gains imposés à 12,8 % » (notes assurance-vie et fonds euros), « 18,6 % à partir de 2026 » (note PEA). Si l'utilisateur change `socialGeneral`, la note PEA ne suit pas. `pfuIncomeTax` n'est pas modifiable dans Paramètres, donc le 12,8 % reste juste en pratique.
- `params.tax.avBefore8` et `params.tax.peaBefore5`, modifiables dans Paramètres › Plan › Fiscalité, ne sont pas lus par les simulateurs : avant 8 ans (assurance-vie) et avant 5 ans (PEA), le calcul applique `pfuIncomeTax`.
- Prélèvements sociaux du PEA : un seul taux selon l'année de sortie ; les taux historiques par période ne sont pas appliqués.
- Assurance-vie : seuil de 150 000 € de versements et abattement déjà consommé ignorés (notes affichées).
- Fonds euros au barème : la CSG payée chaque année dans le contrat n'est pas déduite (`lifeInsuranceExit(..., social = false)` désactive aussi la CSG déductible).
- Crowdlending : la perte est datée à la fin prévue du prêt, donc seule l'année de fin (et les suivantes, sans intérêts) peut l'absorber dans la simulation ; avec une durée commune plus courte, la perte n'est pas comptée.
- `bestRegime` compare un placement isolé, alors que l'option pour le barème est globale pour l'année (rappelé à l'écran).
- `DEFAULT_REINVEST = 1,7` est une constante, présentée comme le taux du Livret A, sans date ni source.
- Avec une durée commune, la durée propre du prêt reste modifiable ; s'il est plus court que la durée commune, ses encaissements sont replacés au taux de réinvestissement.
