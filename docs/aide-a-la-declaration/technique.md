# Aide à la déclaration : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/declaration`, module `impots` (`packages/ui/src/shared/nav.ts`). Pas de différence entre les formats « retraite » et « patrimoine ». Le modèle est résumé dans `docs/architecture/modele-de-donnees.md`, section « Récapitulatif fiscal ».

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/tax/pages/Declaration/Declaration.tsx` | Page : choix de l'année et du document, boutons CSV et impression, `DocumentHeader` (année de validité, `TAX_DISCLAIMER`), `Controls` (alertes, cohérence). |
| UI | `packages/ui/src/features/tax/pages/Declaration/CompleteView.tsx` | Récapitulatif complet : cases, répartition par établissement, plus-values, crypto, autres comptes, rappels. |
| UI | `packages/ui/src/features/tax/pages/Declaration/SheetView.tsx` | Fiche d'un établissement, et `StatementCheck` (comparaison avec le document de l'établissement). |
| UI | `packages/ui/src/features/tax/pages/Declaration/_parts.tsx` | `Status`, `Block`, `BoxCell` (mention « indicative »), `Notes`, `Row`. |
| UI | `packages/ui/src/features/tax/pages/Declaration/index.ts` | Façade de la page. |
| UI | `packages/ui/src/styles.css` | `@media print` : classe `.no-print`, couleurs claires, montants visibles même en mode discret (`.privacy .amount { filter: none }`). |
| UI (réglages) | `packages/ui/src/features/settings/dialogs/InstitutionDialog.tsx` | Section « Fiscalité » de l'établissement : « L'établissement prélève les impôts… », taux qui diffèrent, « Hamac rédige le récapitulatif fiscal de cet établissement ». |
| UI (aide) | `packages/ui/src/features/help/pages/Notice/FurtherPart.tsx` | Section « Impôts et déclaration » de la Notice. |
| Core | `packages/core/src/tax/taxReport.ts` | `buildTaxReport`, `resolveIncome`, `effectiveWithholding`, `institutionWithholding`, `accountWithholds`, `securityDisposals`, `taxReportAlerts`, `compareWithStatement`, `reportTotalsMismatches`, `taxReportYears`, `rulesValidityLabel`, `taxReportCsvRows`, `TAX_DISCLAIMER`, `STATUS_LABELS`, `MODE_LABELS`. |
| Core | `packages/core/src/tax/fiscalRules.ts` | `RULES` par année de revenus, `BOXES_2025`, `fiscalRulesFor`, `LAST_VERIFIED_INCOME_YEAR`, `socialRateFor`. |
| Core | `packages/core/src/tax/cryptoTax.ts` | Cessions crypto et résultat annuel (CGI, art. 150 VH bis). |
| Core | `packages/core/src/portfolio/securitiesGains.ts` | Compensation et report des moins-values (3VG, 3VH). |
| Core | `packages/core/src/model/institutions.ts` | `InstitutionTax` (`report`, `withholds`, `withheldIncomeTax`, `withheldSocial`), `NO_INSTITUTION_TAX`, `institutionWithholds`, `grossFromNet`, `crowdTaxOf`. |
| API | `packages/api/src/accounts/procedures.ts` | `taxStatements.save`, `institutions.upsert`. |
| API | `packages/api/src/system/procedures.ts` | Champ `taxStatements: TaxStatementAmount[]` du `Workspace`. |
| Backend | `packages/backend/src/handlers/accounts.ts` | Handler `taxStatements.save` (remplace, en transaction, les montants d'un établissement pour une année). |
| Backend | `packages/backend/src/db/schema/accounts.ts` | Tables `tax_statement_amounts` et `institutions` (colonne JSON `tax`). |
| Backend | `packages/backend/src/repo/loadWorkspace.ts` | Charge `taxStatements` (centimes → euros). |
| Backend | `packages/backend/src/repo/mappers/accounts.ts` | `mapInstitution` (lit `tax`). |
| Backend | `packages/backend/src/backup/dump.ts` | `tax_statement_amounts` dans `TABLES`, après `institutions`. |

## Données

- **Table `tax_statement_amounts`** : `institution_id` (FK `institutions.id`, suppression en cascade), `year`, `box`, `amount_cents`, horodatage. Clé primaire (`institution_id`, `year`, `box`).
- **Colonne `institutions.tax`** : JSON validé par `InstitutionTax` (`report` par défaut `false`, `withholds` `null` pour une fiche ancienne, taux `null` = taux par défaut, 0 = rien retenu).
- **Procédure `taxStatements.save`** : entrée `{ institutionId, year (2000–2100), amounts: [{ box (1 à 8 caractères), amount }] (40 au plus) }`, sortie `ok`. Supprime les montants existants de l'établissement pour l'année puis insère les nouveaux.
- **Autres procédures** : `workspace.load`, `institutions.upsert` (case « Hamac rédige… »).
- **Champs du `Workspace`** : `taxStatements`, `institutions`, `accounts`, `transactions` (`gross`, `withheldIncomeTax`, `withheldSocial`, `withheldForeign`), `assets` (`kind` : `etf`, `fonds`, `obligation`, `scpi`, `crypto`), `prices`, `statements` (contrôle des relevés), `params`.

## Règles de calcul

### Règles par année (`fiscalRules.ts`)

`FiscalYearRules` : `incomeYear`, `declarationYear` (= revenus + 1), `covered`, `verifiedOn`, `source`, `boxes`, `cryptoExemptionThreshold`, `lossCarryYears`.

Table actuelle : revenus 2025, déclaration 2026, `verifiedOn: "2026-11-09"`, source « Brochure pratique IR 2026 (impots.gouv.fr) », `cryptoExemptionThreshold: 305`, `lossCarryYears: 10`. L'en-tête du fichier précise : chapitres « Revenus des valeurs et capitaux mobiliers » et « Plus-values » de la brochure, et « Principales nouveautés revenus 2025 » pour les taux (LFSS 2026, art. 12 ; CSS, art. L136-8).

| Clé | Case | Formulaire | Libellé |
|---|---|---|---|
| `dividendes` | 2DC | 2042 | Revenus des actions et parts (dividendes bruts) |
| `interets` | 2TR | 2042 | Produits de placement à revenu fixe (intérêts bruts) |
| `crowdlending` | 2TT | 2042 | Intérêts des prêts participatifs et des minibons |
| `psDejaPreleves` | 2BH | 2042 | Revenus déjà soumis aux prélèvements sociaux |
| `acompte` | 2CK | 2042 | Prélèvement forfaitaire non libératoire déjà versé |
| `creditImpot` | 2AB | 2042 | Crédits d'impôt sur valeurs étrangères |
| `plusValue` | 3VG | 2042 C | Plus-value de cession de valeurs mobilières |
| `moinsValue` | 3VH | 2042 C | Moins-value de cession de valeurs mobilières |
| `cryptoPlusValue` | 3AN | 2042 C | Plus-value de cession d'actifs numériques (report de la 2086) |
| `cryptoMoinsValue` | 3BN | 2042 C | Moins-value de cession d'actifs numériques (report de la 2086) |

`fiscalRulesFor(year)` : la ligne exacte si elle existe ; sinon les cases de `LAST_VERIFIED_INCOME_YEAR` avec `covered: false`, `verifiedOn: null`, `source: null`. `rulesValidityLabel` produit le texte affiché sur chaque document ; `BoxCell` ajoute « indicative » ; `taxReportAlerts` ajoute une alerte « cases non vérifiées ».

### Procédure annuelle (nouvelle campagne)

Chaque printemps, quand la brochure officielle de l'année paraît :

1. Vérifier les cases et les taux sur la brochure pratique de l'impôt sur le revenu (impots.gouv.fr) : les dix clés de `TAX_BOX_KEYS`, le seuil d'exonération crypto, la durée de report des moins-values, et les taux de `socialRateFor`.
2. Ajouter l'année de revenus dans `RULES` de `packages/core/src/tax/fiscalRules.ts`, avec `covered: true`, sa `source` et sa date de vérification `verifiedOn` (AAAA-MM-JJ). Si une case change, créer une nouvelle table `BOXES_<année>` plutôt que modifier `BOXES_2025`.
3. Mettre à jour le test `packages/core/src/tax/fiscalRules.test.ts` pour la nouvelle année.
4. `LAST_VERIFIED_INCOME_YEAR` se recalcule seul.

Avant cela, l'année est affichée comme non vérifiée : c'est voulu. On ne réutilise jamais en silence les règles d'une autre année.

Les taux par défaut de Paramètres › Plan (`defaultParams` dans `packages/core/src/model/params.ts`, « Taux 2026, à vérifier chaque année ») et les règles des compteurs (`COUNTERS_VERIFIED_ON` dans `packages/core/src/portfolio/counters.ts`) se vérifient à part.

### Construction du récapitulatif (`buildTaxReport`)

- Comptes couverts (`COVERED_KINDS`) : `cto`, `crowdlending`, `crypto`. Regroupés par établissement ; sans établissement connu : groupe `sans-etablissement`, « Comptes sans établissement ».
- Une fiche est gardée si `institution.tax.report` est vrai, ou si elle a des revenus, des cessions ou des cessions crypto dans l'année.
- `mode` : `a_saisir` si `tax.report`, sinon `a_controler`. Fiches `a_saisir` d'abord, puis par nom.
- Revenus : dividendes et intérêts de l'année, hors comptes crypto, passés par `resolveIncome` (voir [Impôts](../impots/technique.md#retenues-sur-un-revenu-resolveincome-taxtaxreportts)).
- Lignes d'une fiche :
  - `dividendes` = somme des bruts ; forcée `a_verifier` avec une note si un dividende vient d'un actif `etf` ou `fonds` ;
  - `interets` = bruts des intérêts hors crowdlending ;
  - `crowdlending` = bruts des intérêts des comptes de crowdlending dont l'établissement a `tax.crowdInstrument = "prets"` (défaut) ; avec `"obligations"`, ces intérêts vont dans `interets` (case 2TR), avec une remarque ;
  - `psDejaPreleves` = bruts des revenus avec `social > 0` ;
  - `acompte` = somme des `incomeTax` (0 pour les intérêts d'un établissement dispensé l'année de la fiche : `effectiveWithholding` et `crowdTaxOf` lisent `withholdingDispensed(params, année, établissement)`, voir [Impôts](../impots/technique.md#dispense-de-lacompte-sur-les-intérêts)) ;
  - remarque de dispense sur les cases `interets` et `crowdlending` quand l'établissement est dispensé pour l'année et qu'aucun de ses intérêts n'a d'acompte (saisi ou calculé) ;
  - `creditImpot` = somme des `foreign`, toujours `a_verifier`.
- Cessions : `securityDisposals` (hors SCPI) des comptes-titres de la fiche. Statut : `manquant` si `oversold` ou si le prix de revient est nul pour un produit positif ; `a_verifier` pour une obligation (coupon couru, ou prime d'un remboursement).
- Cessions crypto : `manquant` si la valeur globale est nulle, `a_verifier` si `estimatedValue`.
- Lignes consolidées : pour les clés additives, `toEnter` = somme des fiches `a_saisir`, `toCheck` = somme des fiches `a_controler`, `total` = les deux. Statut : le pire (`worstStatus` : `manquant` > `a_verifier` > `calcule`).
- Lignes globales (`toEnter = toCheck = null`) : `plusValue` = `taxableGain` et `moinsValue` = `yearLoss` de `securitiesGains(..., rules.lossCarryYears)` ; `cryptoPlusValue` = max(0, gain net) sauf si exonéré, `cryptoMoinsValue` = max(0, −gain net).
- `others` : comptes non couverts et non archivés, avec une raison par type.
- `reminders` : 2074 si une fiche `a_saisir` a des cessions ; 2086 (exonéré sous `rules.cryptoExemptionThreshold` ou non) ; 2047 si une fiche `a_saisir` a des revenus ; 3916 / 3916-bis toujours ; options 2OP et 3CN toujours.
- `taxReportYears` : de la première opération d'un compte couvert à l'année en cours. L'UI choisit par défaut l'an dernier.

### Contrôles (`taxReportAlerts`)

Niveau `erreur` : somme des fiches ≠ récapitulatif (`reportTotalsMismatches`) ; cession sans achat ou sans prix de revient ; cession crypto sans valeur globale.
Niveau `attention` : année non couverte ; revenu dont brut − retenues ≠ reçu ; cessions d'obligations ; cession crypto à valeur estimée ; comptes sans établissement ; écart ≥ 1 € avec le document de l'établissement ; cession de SCPI sur un compte-titres ; titre acheté sur plusieurs comptes-titres ; retrait de l'année sur un PEA, PEA-PME, une assurance-vie ou un PER ; intérêts sur un compte crypto ; relevé de l'année qui s'écarte de la valeur calculée de plus de max(10 €, 1 %).

### Comparaison avec le document (`compareWithStatement`)

Cases comparées selon les comptes de la fiche : compte-titres → 2DC, 2TR, 2BH, 2CK, 2AB, 3VG, 3VH ; crowdlending → 2TT, 2BH, 2CK, ou 2TR, 2BH, 2CK quand la plateforme fait souscrire des obligations (`TaxSheet.crowdInstrument`). Pour 3VG / 3VH, Hamac compare le résultat de la fiche avant compensation (`securities.net`). `gap = hamac − document`. L'UI ne propose la comparaison que sur une fiche `a_saisir` (les seules qu'on peut ouvrir) liée à un établissement.

### Export et impression

- CSV : `taxReportCsvRows`, une ligne par revenu, cession et cession crypto (colonnes : établissement, traitement, compte, date, nature, titre, reçu ou prix de cession, brut, acompte, prélèvements sociaux, retenue étrangère, prix de revient, gain, statut, remarque). Fichier `recapitulatif-fiscal-<année>.csv`.
- PDF : `window.print()`. `.no-print` masque l'en-tête de page, les choix et le bouton d'enregistrement ; le bloc de comparaison n'est imprimé que s'il contient au moins un montant.

## Assistants (MCP)

Les mêmes calculs sont servis aux assistants par `get_tax_report`, `prepare_tax_statement` et `apply_tax_statement` (`apps/server/src/mcp/tools/tax/`) : voir [Assistants (MCP)](../assistants-mcp/technique.md).

## Tests

| Fichier | Ce qu'il couvre |
|---|---|
| `packages/core/src/tax/taxReport.test.ts` | `resolveIncome` (brut saisi, taux de l'établissement, 17,2 % pour les revenus 2025 sans fiche) ; une fiche par établissement, à saisir d'abord ; récapitulatif = somme des fiches ; à saisir / à contrôler ; compensation entre établissements ; crypto global et seuil de 305 € ; vente sans achat et SCPI ; fiche cochée sans revenu ; année de validité ; CSV ; autres comptes ; années proposées ; pire statut ; contrôles de cohérence ; comparaison case par case. |
| `packages/core/src/tax/fiscalRules.test.ts` | Revenus 2025 vérifiés et datés ; année hors table jamais présentée comme vérifiée ; `socialRateFor`. |
| `packages/core/src/portfolio/securitiesGains.test.ts` | 3VG / 3VH : compensation, imputation, report de 10 ans. |
| `packages/backend/src/backend.test.ts` | Case « récapitulatif fiscal » d'un établissement et détail fiscal d'un dividende conservés ; montants du document gardés, remplacés et inclus dans la sauvegarde ; récapitulatif produit depuis un vrai espace de travail. |
| `packages/ui/src/flows/flows.test.tsx` | Une fiche pour l'établissement coché, l'année de validité et les cases ; la case de l'établissement est enregistrée. |

## Limites connues

- Seuls les comptes-titres, le crowdlending et la crypto sont calculés. PEA, assurance-vie, PER : retraits seulement signalés.
- SCPI : exclues (plus-values immobilières).
- Obligations : coupon couru et prime de remboursement non traités, statut `a_verifier`.
- Prix de revient calculé compte par compte, même si un titre est sur plusieurs comptes-titres.
- Crédit d'impôt étranger : montant brut des retenues en 2AB, sans application de la convention.
- Le seuil d'exonération crypto est en double : `params.crypto.exemptionThreshold` (réglable, utilisé pour le calcul dans `cryptoTax`) et `FiscalYearRules.cryptoExemptionThreshold` (utilisé seulement dans le texte du rappel). S'ils diffèrent, le rappel et le calcul ne disent pas la même chose.
- La comparaison avec le document n'est accessible que sur les fiches `a_saisir`, alors que `taxReportAlerts` la ferait aussi pour une fiche `a_controler` liée à un établissement, et que c'est pour ces établissements qu'un IFU existe.
- Crypto : `Workspace.prices` ne garde que le dernier cours de chaque mois, ce qui rend fréquent le statut `a_verifier` (cours de plus de 7 jours).
- Une seule année vérifiée dans `RULES` (revenus 2025) à la date de cette documentation.
