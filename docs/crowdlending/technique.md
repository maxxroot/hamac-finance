# Crowdlending : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Route `/crowdlending`, module `crowdlending`. Aucune différence entre les formats `retraite` et `patrimoine`. Contrairement aux autres pages de placements, elle n'affiche pas l'écran d'accueil sans compte.

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI | `packages/ui/src/features/investments/pages/Crowdlending.tsx` | La page : comptage, chiffres, tableau des plateformes (TRI), tableau des projets. |
| UI | `packages/ui/src/features/investments/dialogs/CrowdProjectDialog.tsx` | Création et modification d'un projet (statut, date de statut, prolongation, montant espéré, allocation). « Capital déjà remboursé » accepte un calcul « =… » (`MoneyInput`, voir `packages/ui/src/shared/lib/expression.ts`). |
| UI | `packages/ui/src/features/investments/dialogs/DeclareInterestDialog.tsx` | Intérêts bruts du mois pour une plateforme, impôts retenus calculés, une ou deux lignes au journal. |
| UI | `packages/ui/src/features/investments/dialogs/BricksImportDialog.tsx` | Lecture du fichier, aperçu du plan, cases à cocher, application. |
| UI | `packages/ui/src/features/investments/lib/xlsx.ts` | Lecteur .xlsx minimal (zip + XML) sans dépendance, tailles plafonnées. |
| Core | `packages/core/src/investments/crowdlending.ts` | `CrowdProject`, `crowdProjectState`, `crowdSummary`, `crowdCountsLabel`, `crowdEndDate`, `crowdExtensionError`, `crowdInterestEntries`. |
| Core | `packages/core/src/imports/bricksImport.ts` | `parseBricksSheet`, `planBricksImport`. |
| Core | `packages/core/src/imports/csv.ts` | `parseDate` (dates françaises du fichier). |
| UI | `packages/ui/src/features/investments/components/DispenseStatus.tsx` | Ligne « Acompte de 12,8 % sur les intérêts en … » : dispensé ou retenu par plateforme pour l'année en cours, rappel pour l'année suivante. |
| Core | `packages/core/src/model/institutions.ts` | `crowdTaxOf` (retenue et taux de la plateforme pour une année), `crowdWithholding` (partage acompte / prélèvements sociaux). |
| Core | `packages/core/src/portfolio/engine.ts` | Espèces de la plateforme moins le capital prêté, valeur des projets, `accountIrr`. |
| Core | `packages/core/src/loans/loan.ts` | `loanState`, utilisé pour l'amortissement d'un projet à mensualités. |
| Core | `packages/core/src/analysis/concentration.ts` | Concentration par plateforme et projets en difficulté (autres pages). |
| API | `packages/api/src/investments/procedures.ts`, `packages/api/src/investments/inputs.ts` | `crowdProjects.upsert` (`CrowdProjectInput`), `crowdProjects.delete`, `crowdProjects.applyImport` (`CrowdImportInput`). |
| Backend | `packages/backend/src/handlers/investments.ts` | Handlers `crowdProjects.*`. |
| Backend | `packages/backend/src/db/schema/investments.ts` | Table `crowd_projects`. |
| Backend | `packages/backend/src/repo/mappers/investments.ts` | `mapCrowdProject`. |

## Données

- `crowd_projects` (`packages/backend/src/db/schema/investments.ts`) : `account_id` (`ON DELETE CASCADE`), `name`, `amount_cents`, `rate` (fraction, nullable), `start_date`, `term_months` (nullable), `repayment` (`in_fine`, `coupons`, `amortissable`), `status` (`en_cours`, `retard`, `defaut`, `rembourse`), `status_date`, `repaid_capital_cents` (null = calculé), `expected_recovery_cents`, `in_allocation`, `comment`, `external_id`, `extended_to`. Index unique `crowd_external_uq` sur `(account_id, external_id)`. Présente dans `TABLES` de `packages/backend/src/backup/dump.ts`.
- `accounts` de `kind = "crowdlending"`, rattachés à un établissement (`institutions.tax` : la plateforme retient-elle les impôts, à quels taux ; ancien `offers.crowdlending.taxRate`).
- `transactions` : versements, retraits, `interets` (avec `gross`, `withheld_income_tax`, `withheld_social` quand la plateforme retient), `impots`, `correction`, `external_id` pour les lignes importées.

Procédures :

- `crowdProjects.upsert` : refuse un compte qui n'est pas `crowdlending` et une prolongation invalide (`crowdExtensionError`) ; met `status_date` à null pour `en_cours` et `expected_recovery` à null hors `defaut`.
- `crowdProjects.delete`.
- `crowdProjects.applyImport` : tout dans une transaction SQL ; insertions en `ON CONFLICT DO NOTHING` ; `retire` ne supprime que des lignes qui ont un `external_id`. Les projets créés ont `repayment = 'in_fine'`, sans taux ni durée.
- `transactions.bulkCreate` pour la déclaration des intérêts.

Champs du `Workspace` : `crowdProjects`, `accounts`, `transactions`, `institutions`, `params` (`tax.pfuIncomeTax`, `tax.socialGeneral`).

## Règles de calcul

**État d'un projet** (`crowdProjectState(project, asOf)`).

- `endDate = extendedTo ?? addMonths(startDate, termMonths)` (null sans durée ni prolongation).
- Statut : `en_cours` tant que `statusDate > asOf`, sinon `status` (« le défaut ne réécrit pas le passé »).
- Première échéance : `startDate + 1 mois`. En retard, l'amortissement est compté jusqu'à `statusDate`.
- `repaid` = `amount` si `rembourse` ; sinon `repaidCapital` s'il est saisi ; sinon 0 en défaut ; sinon, pour `amortissable` avec taux et durée, `amount − loanState(…, until).balance` ; sinon 0. Plafonné à `amount`.
- `outstanding = amount − repaid`. `value` = 0 si remboursé, `min(outstanding, expectedRecovery ?? 0)` en défaut, sinon `outstanding`.
- `nextDate` (en cours ou en retard) : `endDate` si in fine et à venir ; sinon le premier `firstPayment + i mois > asOf` avec `i < monthsBetween(startDate, endDate)`.
- `overdue = status === "en_cours" && endDate < asOf`.

**Résumé** (`crowdSummary`) : `active` = Σ `outstanding` en cours et en retard ; `atRisk` = Σ `outstanding` en retard et en défaut ; `averageRate` = moyenne des taux renseignés pondérée par `outstanding` des projets actifs.

**Dans le moteur.** Projets de la plateforme avec `startDate ≤ asOf`. `cash = espèces du journal + versements programmés − Σ (amount − repaid)`. `value = cash + Σ value des projets`. Allocation : `project.inAllocation ?? account.inAllocation ?? classEnabled("crowdlending")` (hors allocation par défaut dans `defaultParams`).

**Rendement réel** (`accountIrr`) : XIRR des apports, versements, retraits et transferts du compte, avec la valeur du jour ; `null` avant un an d'historique (`irrOf`).

**Prolongation** (`crowdExtensionError`) : après `startDate`, et sur un mois strictement postérieur à celui de l'échéance initiale. Saisie au mois, stockée au dernier jour du mois (`dayOfMonth(mois, 31)`).

**Impôts de la plateforme** (`crowdTaxOf`). Sans établissement : non retenus, taux `pfuIncomeTax + socialGeneral`. Avec : `withheld = institutionWithholds(inst)` ; taux = `withheldIncomeTax ?? pfuIncomeTax` + `withheldSocial ?? socialGeneral` si l'un est réglé sur la fiche, sinon `offers.crowdlending.taxRate` (acompte au plus le PFU, le reste en prélèvements sociaux), sinon PFU + prélèvements sociaux. Le résultat donne `incomeTax`, `social` et `rate`. Année et établissement cochés dans `tax.withholdingDispenses` (dispense de l'acompte, CGI art. 125 A) : `incomeTax` = 0, seuls les prélèvements sociaux restent ; la déclaration mensuelle prend l'année du mois déclaré.

**Retenue** (`crowdWithholding(gross, { incomeTax, social }, total = gross × (incomeTax + social))`) : `incomeTax = total × incomeTax / (incomeTax + social)`, `social = total − incomeTax`. Un total saisi à la main est réparti dans les mêmes proportions.

**Lignes du journal** (`crowdInterestEntries`). Date = dernier jour du mois, ou aujourd'hui si ce jour est futur. Sans retenue : une ligne `interets`, `amount = gross`, `gross` null. Avec retenue : `interets` avec `amount = gross`, `gross`, retenues ; puis `impots` du total retenu. C'est l'exception documentée dans `docs/architecture/modele-de-donnees.md` (Conventions).

**Import Bricks** (`parseBricksSheet`, `planBricksImport`). Colonnes exigées : `id`, `date`, `type`, `statut`, `propriété`, `type de contrat`, `montant (€)`. Seules les lignes `statut = "Validée"` comptent.

| Type Bricks | Devient |
|---|---|
| `Crédit par carte` | `versement`, `externalId = bricks:<id>` |
| `Prime de parrainage en tant que parrain`, `Solde boosté` | `correction` (montant signé) |
| `Revenus reversés`, `Prélèvement à la source` | une ligne `interets` par mois, montant net (somme), datée de la dernière ligne du mois, `externalId = bricks:interets:<AAAA-MM>` ; ignorée si le net est ≤ 0 |
| `Achat de bricks` | projet par `propriété` : montants additionnés, date la plus ancienne, `externalId = bricks:<propriété>`, commentaire « Prêt » ou « Obligation » d'après le type de contrat |
| `Remboursement de capital` | capital rendu du projet ; rendu en totalité → `rembourse` à la date du dernier remboursement |
| autre | listé dans `unknownTypes`, non importé |

Rapprochement : même `externalId` → inchangé ou `modifie` ; sinon, pour les intérêts, une saisie manuelle du même mois donne un `conflit` (non coché par défaut, devient `nouveau` si on l'accepte) ; pour les autres types, une saisie manuelle de même type, date et montant compte comme déjà à jour. Une ligne `bricks:` absente du fichier devient `retire`. Un projet existant est retrouvé par `externalId`, sinon par nom ; un statut posé à la main (retard, défaut) n'est remplacé que par un remboursement complet. `withheldRate = Σ prélèvements / Σ revenus` sert aux avertissements de la fenêtre.

Source fiscale : aucune n'est citée dans ces fichiers ; les taux viennent de `params.tax` et des fiches d'établissement. Les cases de déclaration (2TT pour les intérêts de prêts participatifs et minibons, 2TR pour les obligations et titres de créance) sont dans `packages/core/src/tax/fiscalRules.ts`, vérifiées le 2026-11-09. Le choix se règle par plateforme : `InstitutionTax.crowdInstrument` (`"prets"` par défaut, ou `"obligations"`), champ « Ce que vous souscrivez » de la fiche d'établissement ; l'IFU de la plateforme fait foi (Bricks remplit la case 2TR).

## Tests

- `packages/core/src/investments/crowdlending.test.ts` : comptage, in fine, échéance dépassée, remboursé, défaut (0 € puis montant espéré), « le défaut ne réécrit pas le passé », mensualités, prolongation, retard, résumé, retenue, lignes du mois.
- `packages/core/src/imports/bricksImport.test.ts` : lecture, refus d'un autre fichier, premier import, réimport sans changement, nouveautés, opération annulée retirée, saisies manuelles et conflit, type inconnu.
- `packages/ui/src/features/investments/lib/xlsx.test.ts` (avec `packages/ui/src/features/investments/lib/xlsx.fixture.ts`) : lecture d'un classeur, refus d'un fichier qui n'en est pas un.
- `packages/core/src/portfolio/engine.test.ts` : « crowdlending : impôts prélevés par la plateforme ou restant à payer », « crowdlending : intérêts bruts puis impôts débités à part ».
- `packages/backend/src/backend.test.ts` : « crowdlending : un projet exige une plateforme, qui ne se supprime plus ensuite », prolongation enregistrée ou refusée.
- `packages/ui/src/flows/flows.test.tsx` : nouveau projet, capital remboursé saisi par un calcul « = », puis défaut à 0 €, case « prélève les impôts », intérêts déclarés, impôts saisis à la main, import Bricks en deux passages, prolongation.
- `packages/ui/src/flows/reglages.flow.test.tsx`, bloc « import Bricks : cas particuliers ».

## Limites connues

- `crowdProjects.applyImport` écrit en SQL brut, sans passer par `validateTransaction`.
- L'import crée des intérêts nets sans `gross` ni retenues, et pas de ligne `impots` : c'est différent de la déclaration manuelle (brut + ligne `impots`). D'après `docs/architecture/modele-de-donnees.md` (« Brut d'un revenu : celui saisi, sinon les taux de retenue »), le récapitulatif fiscal reconstitue alors le brut d'après les taux de l'établissement (non vérifié en détail ici), d'où l'avertissement de la fenêtre si la case « prélève les impôts » n'est pas cochée.
- Une saisie manuelle reconnue comme déjà à jour n'est pas rattachée à son `externalId` : elle sera de nouveau rapprochée par type, date et montant au prochain import.
- Pour `coupons` (intérêts mensuels), le capital rendu n'est jamais calculé : seul `repaidCapital` ou le statut `rembourse` le change.
- `atRisk` additionne `outstanding` des projets en défaut, pas leur `value` : le chiffre reste le capital dû, montant espéré non déduit.
- Le type `XlsxSheet` est défini deux fois (dans `bricksImport.ts` et dans `xlsx.ts`).
- Seul le format d'export Bricks est reconnu.
