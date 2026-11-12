# Compteurs et plafonds : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/compteurs`, module `impots` (`packages/ui/src/shared/nav.ts`). Pas de différence entre les formats « retraite » et « patrimoine ». La liste de fin d'année, qui s'appuie sur ces compteurs, est rendue en bas de la page Impôts (`/impots`) ; elle est documentée ici.

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/tax/pages/Compteurs.tsx` | Page : cartes Ancienneté, Plafonds, Assurance-vie, Donations (`GiftsCard`, `GiftDialog`), sources. |
| UI | `packages/ui/src/features/tax/components/YearEndCard.tsx` | Liste de fin d'année repliée (`<details>`), cases cochées par année. Rendue par `packages/ui/src/features/tax/pages/Impots.tsx`. |
| UI | `packages/ui/src/shared/lib/queries.ts` | `useSetting` / `useSetSetting` (clé `taxes.yearEnd`). |
| Core | `packages/core/src/portfolio/counters.ts` | `seniorityCounters`, `grossContributions`, `ceilingCounters`, `lifeInsuranceCounters`, `giftCounters`, constantes des plafonds et abattements, `COUNTERS_VERIFIED_ON`, `COUNTER_SOURCES`. |
| Core | `packages/core/src/tax/yearEnd.ts` | `yearEndChecklist`, `yearEndSeason`, `YEAR_END_KEYS`. |
| Core | `packages/core/src/model/domain.ts` | `LIVRET_LEGAL_CEILINGS`. |
| Core | `packages/core/src/portfolio/securitiesGains.ts` | Plus-values imposables de l'année (geste « moins-values »). |
| Core | `packages/core/src/alerts/alerts.ts` | Alerte « Liste de fin d'année » (id `fin-annee`, lien `/impots`) en novembre et décembre. |
| API | `packages/api/src/planning/inputs.ts` | `GiftInput`. |
| API | `packages/api/src/planning/procedures.ts` | `gifts.upsert`, `gifts.delete`. |
| API | `packages/api/src/system/procedures.ts` | `SettingKey` (dont `taxes.yearEnd`), `settings.get`, `settings.set`, champ `gifts` du `Workspace`. |
| Backend | `packages/backend/src/handlers/planning.ts` | Handlers `gifts.upsert`, `gifts.delete`. |
| Backend | `packages/backend/src/handlers/system.ts` | Handlers `settings.get`, `settings.set`. |
| Backend | `packages/backend/src/db/schema/planning.ts` | Table `gifts`. |
| Backend | `packages/backend/src/repo/mappers/planning.ts` | `mapGift`. |
| Backend | `packages/backend/src/repo/loadWorkspace.ts` | Charge `gifts` (triées par date décroissante). |
| Backend | `packages/backend/src/backup/dump.ts` | `gifts` et `settings` dans `TABLES`. |

## Données

- **Table `gifts`** : `id`, `date`, `direction` (`faite` / `recue`), `kind` (`donation` / `don_argent` / `present_usage`), `person`, `relation`, `amount_cents`, `comment`, horodatage.
- **Table `settings`**, clé `taxes.yearEnd` : JSON `Record<année, YearEndKey[]>`, les gestes cochés par année.
- **Procédures** : `gifts.upsert` (entrée `GiftInput` : `person` non vide, `amount` positif, `kind` par défaut `donation`), `gifts.delete`, `settings.get`, `settings.set`, `workspace.load`.
- **Champs du `Workspace`** : `gifts`, `accounts` (`kind`, `openedOn`, `livretType`, `depositCeiling`, `archived`), `transactions` (versements, retraits, transferts), `params` (`profile.couple`, `profile.birthYear`, `tax.perDeductionCeiling`, `tax.tmi`, `tax.avAfter8`, `tax.avAllowanceSingle`, `tax.avAllowanceCouple`, `tax.socialGeneral`, `tax.pfuIncomeTax`).

## Règles de calcul

Source commune (en-tête de `portfolio/counters.ts`), « règles vérifiées le 11 novembre 2026 » (`COUNTERS_VERIFIED_ON = "2026-11-11"`) :

- PEA : 150 000 € de versements ; PEA et PEA-PME ensemble : 225 000 € (CMF, art. L221-30 et L221-32-1) ; fiscalité allégée après 5 ans ; assurance-vie : après 8 ans (CGI, art. 125-0 A) ;
- abattement annuel sur les gains retirés d'une assurance-vie de plus de 8 ans : 4 600 €, 9 200 € pour un couple ;
- donations : abattement par donateur et par bénéficiaire selon le lien de parenté, renouvelé tous les 15 ans (CGI, art. 779, 784, 790 B à 790 F) ; don familial de sommes d'argent : 31 865 € de plus, donateur de moins de 80 ans, bénéficiaire majeur (CGI, art. 790 G) ; présents d'usage non comptés (service-public.gouv.fr, F14203).

Liens affichés (`COUNTER_SOURCES`) : service-public.gouv.fr F14203 et la fiche AMF sur le PEA.

### Ancienneté (`seniorityCounters`)

Comptes non archivés `pea`, `pea_pme` (5 ans) et `assurance_vie` (8 ans). `date = addMonths(openedOn, années × 12)`, `reached = date <= asOf`, `monthsLeft = monthsBetween(asOf, date)`.

### Plafonds (`ceilingCounters`)

- `grossContributions` = versé net + retraits + transferts sortants jusqu'à `asOf`.
- `pea` : somme des `grossContributions` des PEA face à `PEA_CEILING` (150 000).
- `pea_pme` : PEA + PEA-PME face à `PEA_TOTAL_CEILING` (225 000).
- `livret-<id>` : livrets réglementés (`livretType` ≠ `AUTRE`) ; valeur (solde) face à `depositCeiling`, sinon `LIVRET_LEGAL_CEILINGS` (LEP 10 000, LDDS 12 000, Livret A 22 950). Aucune source n'est citée dans le code pour ces trois montants.
- `per` : si `perDeductionCeiling > 0`, versements bruts de l'année = `grossContributions` à `asOf` − `grossContributions` au 31 décembre précédent (`computePortfolio` à cette date).
- `remaining = max(0, plafond − utilisé)`.

### Assurance-vie (`lifeInsuranceCounters`)

- `allowance` = `avAllowanceCouple` si `profile.couple`, sinon `avAllowanceSingle`.
- Pour chaque `retrait` de l'année sur un contrat de 8 ans à la date du retrait : part de gain = montant × max(0, 1 − versé net / valeur), état calculé la veille (`computePortfolio(addDays(date, -1))`).
- `allowanceLeft = max(0, allowance − gainsWithdrawn)`.
- `seventyOn = ${birthYear + 70}-01-01` ; `before70` = versements bruts à la veille de cette date (ou aujourd'hui si elle n'est pas atteinte), `after70` = total − `before70`.

### Donations (`giftCounters`)

- Fenêtre : `addMonths(asOf, -180) < date <= asOf` (`GIFT_RENEWAL_YEARS = 15`), présents d'usage exclus.
- Regroupement par `direction | person (trim, minuscules fr-FR) | relation`.
- `GIFT_ALLOWANCES` : enfant 100 000, petit-enfant 31 865, arrière-petit-enfant 5 310, conjoint 80 724, ascendant 100 000, frère ou sœur 15 932, neveu ou nièce 7 967, autre 0.
- Don familial (`FAMILY_CASH_GIFT = 31 865`) : pour `kind = don_argent` et une relation de `FAMILY_GIFT_RELATIONS` (enfant, petit-enfant, arrière-petit-enfant, neveu ou nièce), imputé d'abord sur ce montant, le reste sur l'abattement.
- `taxable = max(0, reste − abattement)` ; `renewsOn` = date de la plus ancienne donation comptée + 15 ans.

### Liste de fin d'année (`yearEndChecklist`)

Clés `YEAR_END_KEYS` : `moins_values`, `assurance_vie`, `per`, `plafonds`, `declaration`.

1. `moins_values` : si `securitiesGains(state.disposals, accounts, année)` donne un `taxableGain > 0` et qu'une position de compte-titres non archivé a un gain négatif. `usable = min(taxableGain, somme des pertes)`, `saving = usable × (incomeTaxRate + socialGeneral)`. Lien `/actions`.
2. `assurance_vie` : si `allowanceLeft > 0` et un contrat non archivé de 8 ans, de valeur positive, avec une part de gain `1 − versé net / valeur > 0`. `saving = allowanceLeft × min(tmi, avAfter8)`. Retrait proposé par contrat = `min(valeur, allowanceLeft / part)`. Lien `/compteurs`.
3. `per` : si le compteur `per` a un `remaining > 0`. `saving = remaining × tmi`. Lien `/compteurs`.
4. `plafonds` : autres compteurs avec `remaining > 0`, sans économie chiffrée. Lien `/compteurs`.
5. `declaration` : toujours présent, lien `/declaration`.

`yearEndSeason(asOf)` est vrai à partir de novembre (mois ≥ 11). L'alerte du tableau de bord ne retient que les gestes avec `saving > 0`.

## Tests

| Fichier | Ce qu'il couvre |
|---|---|
| `packages/core/src/portfolio/counters.test.ts` | Dates des 5 et 8 ans ; versements bruts du PEA et plafond commun PEA-PME ; versements PER de l'année ; part de gain des retraits imputée sur l'abattement après 8 ans ; versements avant et après 70 ans ; donations sur 15 ans, don familial imputé d'abord, présents d'usage et dépassement. |
| `packages/core/src/tax/yearEnd.test.ts` | Moins-values, abattement et PER chiffrés ; pas de moins-values sans plus-value imposable ; alerte seulement en novembre et décembre. |
| `packages/backend/src/backend.test.ts` | « enregistre, modifie et supprime une donation » (dont la validation d'une personne vide). |
| `packages/ui/src/flows/suivi.flow.test.tsx` | Page avec le jeu de démonstration ; cartes vides ; noter, corriger, supprimer une donation ; fermer sans enregistrer. |
| `packages/ui/src/flows/reglages.flow.test.tsx` | `YearEndCard` : gestes chiffrés, cochés par année et gardés dans les réglages, liens « Voir le détail ». |

## Limites connues

- Conditions du don familial (âge du donateur, majorité, absence de descendant pour neveu ou nièce) : rappelées dans le texte, non contrôlées.
- 70 ans comptés au 1er janvier de l'année de naissance + 70.
- `LIVRET_LEGAL_CEILINGS` n'a pas de source citée dans `model/domain.ts`.
- `yearEndChecklist` passe `state.disposals` à `securitiesGains` sans `securityDisposals` : une vente de parts de SCPI sur un compte-titres compte dans les plus-values imposables, alors que `yearlyTaxes`, `accountTaxDetails` et `buildTaxReport` l'excluent. Il utilise aussi la durée de report par défaut (10 ans) et non `FiscalYearRules.lossCarryYears`.
- La liste de fin d'année vit sur la page Impôts, alors que ses liens « Voir le détail » mènent surtout à `/compteurs`.
- `lifeInsuranceCounters` appelle `computePortfolio` une fois par retrait de l'année, et `ceilingCounters` une fois de plus pour le PER : coût en calcul à surveiller si les retraits se multiplient.
