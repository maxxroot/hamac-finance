# Crédits : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Périmètre : la page `/credits`, le domaine `loans` de `@hamac/core` (le prêt, son échéancier, son coût, le remboursement anticipé) et la vue d'endettement `analysis/debt.ts` (poids des crédits, taux d'effort). Le rattachement à un bien et le solde à la vente sont décrits dans la [documentation technique de l'immobilier](../immobilier/technique.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| core | `packages/core/src/loans/loan.ts` | Types `Loan`, `LoanPrepayment`, libellés ; `loanHasProperty`, `loanPayment`, échéancier (`loanSchedule`, interne `loanSteps`), `loanYears`, `loanState`, `loanHeldBalanceAt`. |
| core | `packages/core/src/loans/debt.ts` | `loanCost` (taux assurance comprise, intérêts et assurance restants), `maxPrepaymentFee`, `comparePrepayment`, `placementPresets`, `DEBT_SOURCES`. |
| core | `packages/core/src/loans/index.ts` | Façade du domaine. |
| core | `packages/core/src/analysis/debt.ts` | `debtOverview`, `MAX_EFFORT_RATE`. |
| core | `packages/core/src/portfolio/engine.ts` | `netWorth.loans` (crédits non archivés, `loanState`), `netWorth.debts`, `netWorth.monthlyLoans`, `netWorth.net`. |
| core | `packages/core/src/portfolio/history.ts` | Capital restant dû passé (`loanHeldBalanceAt`). |
| core | `packages/core/src/model/ownership.ts` | `withCompanyShares` : la part de SCI s'applique aux crédits des biens de la société. |
| core | `packages/core/src/alerts/alerts.ts` | Alerte « taux-effort » dans `computeAlerts`. |
| core | `packages/core/src/model/params.ts` | `profile.netMonthlyIncome`, `returns`, `tax` (lus par le taux d'effort et les placements de comparaison). |
| api | `packages/api/src/loans/inputs.ts` | `LoanInput`, `LoanPrepaymentInput`. |
| api | `packages/api/src/loans/procedures.ts` | `loansProcedures`. |
| backend | `packages/backend/src/handlers/loans.ts` | Handlers des crédits et des remboursements anticipés. |
| backend | `packages/backend/src/db/schema/loans.ts` | Tables `loans`, `loan_prepayments`. |
| backend | `packages/backend/src/repo/mappers/loans.ts` | `mapLoan`, `mapLoanPrepayment`. |
| backend | `packages/backend/src/repo/loadWorkspace.ts` | Charge les crédits avec leurs remboursements anticipés. |
| backend | `packages/backend/src/handlers/realestate/properties.ts` | `properties.sell` et `properties.cancelSale` soldent et rétablissent les crédits du bien. |
| ui | `packages/ui/src/features/loans/pages/Credits.tsx` | Page `/credits` : chiffres, tableau, détail, crédits archivés. |
| ui | `packages/ui/src/features/loans/components/LoanYearsChart.tsx` | Graphique et tableau du coût par année. |
| ui | `packages/ui/src/features/loans/components/LoanPrepayments.tsx` | Liste et formulaire des remboursements anticipés. |
| ui | `packages/ui/src/features/loans/components/DebtCards.tsx` | `DebtWeightCard` (poids des crédits), `PrepaymentCard` (rembourser ou placer). |
| ui | `packages/ui/src/features/loans/dialogs/LoanDialog.tsx` | Formulaire d'un crédit, avec aperçu. |
| ui | `packages/ui/src/features/loans/index.ts` | Façade (exporte `Credits`). |
| ui | `packages/ui/src/features/settings/pages/Parametres/PlanTab.tsx` | Saisie de « Revenus nets par mois ». |
| ui | `packages/ui/src/app/App.tsx`, `packages/ui/src/shared/nav.ts` | Route et entrée du menu (module `credits`, groupe « Emprunts »). |

## Données

### Tables (schéma du tenant)

| Table | Colonnes | Remarques |
|---|---|---|
| `loans` | `kind`, `name`, `property_id`, `share`, `principal_cents`, `rate`, `term_months`, `first_payment`, `insurance_mode`, `insurance_cents`, `insurance_rate`, `manual_payment_cents`, `manual_balance_cents`, `manual_balance_date`, `archived`, `closed_on`, `deferred_months`, `deferred_kind`. | `property_id` → `properties.id`, `ON DELETE SET NULL`. Taux en fraction (`0.03`). |
| `loan_prepayments` | `loan_id`, `date`, `amount_cents`, `fee_cents`, `mode`. | Cascade sur le crédit ; index sur `loan_id`. |

Les deux tables figurent dans `TABLES` (`packages/backend/src/backup/dump.ts`), `loans` avant `loan_prepayments`.

### Procédures du contrat

| Procédure | Règles |
|---|---|
| `loans.upsert` | zod : nom requis (120 caractères), `share` dans ]0 ; 1], `principal` > 0, `rate` dans [0 ; 1], `termMonths` de 1 à 600, `deferredMonths` de 0 à 240 et inférieur à la durée, capital relevé et sa date ensemble. Handler : `property_id` gardé seulement pour `immobilier` et `travaux` ; en mode `montant`, `insurance_rate` vaut 0, sinon `insurance_cents` vaut 0 ; un crédit non archivé perd son `closed_on`. Renvoie le crédit avec ses remboursements anticipés. |
| `loans.delete` | Cascade sur `loan_prepayments`. |
| `loanPrepayments.upsert` | Crédit inconnu : `NOT_FOUND`. `amount` > 0, `fee` ≥ 0, `mode` `duree` (par défaut) ou `mensualite`. |
| `loanPrepayments.delete` | — |

Le solde à la vente passe par `properties.sell` (`archived = true`, `closed_on = saleDate` pour les crédits non archivés du bien) et `properties.cancelSale` (rétablit ceux dont `closed_on` vaut la date de vente).

### Champs du `Workspace` utilisés

`loans` (avec `prepayments` imbriqués), `properties` (nom et valeur des biens rattachés), `companies` (via `withCompanyShares`), `params.profile.netMonthlyIncome`, `params.returns`, `params.tax`. La page lit l'état calculé `pf.state.netWorth` (après parts de SCI) pour les crédits en cours, et `pf.idx.ws.loans` (tel que saisi) pour les crédits archivés et le formulaire.

## Règles de calcul

### Échéance (`loanPayment`)

```
r        = taux annuel ÷ 12
échéance = capital × r ÷ (1 − (1 + r)^−n)      (capital ÷ n si r = 0 ; 0 si capital ≤ 0 ou n ≤ 0)
```

`manualPayment`, s'il est saisi, remplace l'échéance calculée (hors assurance).

### Assurance (`insuranceFor`)

Source citée : CCSF, glossaire et recommandation du 12 octobre 2021 sur l'assurance emprunteur (banque-france.fr).

- `montant` : `insurance` par mois ;
- `capital_initial` : `principal × insuranceRate ÷ 12` ;
- `capital_restant` : `capital restant dû avant l'échéance × insuranceRate ÷ 12`.

### Échéancier (`loanSteps`)

Pour k de 0 à `termMonths − 1`, échéance au `firstPayment + k mois` :

1. **Relevé.** À l'échéance d'indice `paymentsDue(manualBalanceDate)` (la première après la date du relevé), le capital devient `manualBalance` ; l'écart à la baisse compte comme capital remboursé.
2. **Remboursements anticipés** dont la date est ≤ celle de l'échéance : capital réduit (au plus du capital restant), montant compté en capital, indemnité comptée en intérêts. Mode `mensualite` : l'échéance est recalculée sur le capital restant et les mois restants (après le différé).
3. **Différé** (`deferred = min(deferredMonths, termMonths − 1)`) : partiel, on paie les intérêts ; total, les intérêts s'ajoutent au capital (capital négatif, rien à payer). Après un différé total, l'échéance est calculée sur `principal × (1 + r)^deferred` et `termMonths − deferred` mois.
4. **Amortissement** : `intérêts = capital × r`, `capital remboursé = min(capital, max(0, échéance − intérêts))`.
5. Avec au moins un remboursement anticipé, l'échéancier s'arrête dès que le capital tombe sous 0,005 €.

`loanSchedule` expose ces pas. `loanYears(loan, until?)` les regroupe par année civile (capital, intérêts, assurance, reste dû en fin d'année), arrêté à `until`.

### État à une date (`loanState`)

- `paymentsDone` : échéances dont la date est ≤ `asOf` ; `paymentsLeft` : les autres.
- `balance` : le relevé s'il n'y a pas eu d'échéance depuis, sinon le capital après la dernière échéance passée (le montant emprunté avant la première), moins les remboursements anticipés datés avant `asOf` mais pas encore appliqués ; 0 quand il ne reste aucune échéance.
- `payment` et `insurance` : ceux de la prochaine échéance ; `monthly = payment + insurance` tant qu'il reste des échéances.
- `heldBalance = balance × share`, `heldMonthly = monthly × share`.
- `totalInterest`, `totalInsurance` : sur tout l'échéancier ; `totalInterest` inclut les indemnités.
- `fromManualBalance` : un relevé daté avant `asOf` existe.

`loanHeldBalanceAt` (historique) : 0 avant la première échéance, et 0 à partir de `closedOn`, ou à toute date si le crédit est archivé sans `closedOn`.

### Patrimoine (`engine.ts`)

`netWorth.loans` = `loanState` des crédits **non archivés** (après parts de SCI) ; `debts = Σ heldBalance` ; `monthlyLoans = Σ heldMonthly` ; `net = financier + immobilier + autres biens − dettes`.

### Coût restant (`loanCost`)

- Échéances strictement après la date ; `balance = loanState(...).balance`.
- `rateWithInsurance` : taux mensuel `i` tel que `Σ (échéance + assurance) ÷ (1 + i)^(k+1) = balance`, trouvé par bissection sur [0 ; 1] (100 itérations), puis × 12 et arrondi à 5 décimales ; `null` si le capital est nul ou si les paiements ne le couvrent pas.
- `remainingInterest`, `remainingInsurance` : sommes des échéances futures × `share`.

### Poids des crédits (`debtOverview`)

Le commentaire cite le Haut Conseil de stabilité financière, décision du 29 septembre 2021 (35 % des revenus nets, assurance comprise, pour un nouveau crédit immobilier), « vérifié le 11 novembre 2026, source secondaire, texte officiel à relire ».

- `assets = financier + immobilier + autres biens` ; `debtRatio = debts ÷ assets`.
- `effortRate = monthlyLoans ÷ netMonthlyIncome`, `null` si le revenu vaut 0. `MAX_EFFORT_RATE = 0,35`.
- `properties` : biens non archivés dont les crédits actifs (`paymentsLeft > 0`) ont un capital > 0 ; `ratio = dette ÷ propertyValue`.
- `loans` : `loanCost` des crédits actifs.

Alerte du tableau de bord (`computeAlerts`) : niveau « information », identifiant `taux-effort`, si `monthlyLoans ÷ netMonthlyIncome > 0,35`, lien vers `/credits`.

### Indemnité maximale (`maxPrepaymentFee`)

Règles du commentaire de `debt.ts`, « vérifiées le 11 novembre 2026 (sources secondaires, textes officiels à relire) » ; sources affichées par `DEBT_SOURCES` : La finance pour tous (remboursement anticipé d'un crédit immobilier) et Code de la consommation, art. R313-25 et L312-34 sur Legifrance.

- Somme remboursée retenue : `min(montant, capital restant dû)` ; 0 si elle est nulle.
- `immobilier` et `travaux` : `min(somme × taux ÷ 2, capital restant dû × 3 %)` (six mois d'intérêts, art. R313-25).
- `consommation` et `auto` : 0 si les remboursements anticipés enregistrés sur les douze derniers mois plus la somme font au plus 10 000 € ; sinon `somme × 1 %` s'il reste plus de 12 échéances, `× 0,5 %` sinon (art. L312-34, « à vérifier »).
- `autre` : `null` (« Selon votre contrat »).

### Rembourser ou placer (`comparePrepayment`)

Entrées : crédit, date (aujourd'hui dans l'interface), somme pour le crédit entier, mode, indemnité, rendement annuel net `t`.

```
avant      = échéances après la date, sans le remboursement
après      = échéances après la date, avec un remboursement simulé (indemnité 0)
horizon    = dernière échéance de « avant » ; mois = mois entre la date et l'horizon
libéré(s)  = (échéance + assurance) avant − (échéance + assurance) après, à la même date
rembourser = Σ libéré(s) × (1 + t_m)^(mois entre s et l'horizon),  t_m = (1 + t)^(1/12) − 1
placer     = (min(somme, capital restant dû) + indemnité) × (1 + t)^(mois ÷ 12)
avantage   = (rembourser − placer) × share
```

- `breakEvenRate` : taux `t` qui annule l'écart, par bissection sur [−50 % ; 100 %] (80 itérations), arrondi à 5 décimales ; `null` si l'écart ne change pas de signe.
- Aussi : `newEndDate`, `newMonthly` (prochaine échéance après, × `share`), `monthsSaved`, `savedInterest` et `savedInsurance` (× `share`).
- L'interface affiche « Les deux options se valent » si |avantage| < 1 €.

`placementPresets` (rendements arrondis à 5 décimales) : `livrets` ; `fondsEuros × (1 − tax.socialAv)` ; `obligations × (1 − tax.pfuIncomeTax − tax.socialGeneral)` ; `actions × (1 − tax.socialGeneral)`.

### Interface

- `Credits.tsx` : les chiffres du haut sont `netWorth.debts`, `netWorth.monthlyLoans` et `netWorth.net` ; le tableau liste `netWorth.loans`, y compris un crédit non archivé sans échéance restante.
- `LoanYearsChart` : barres empilées capital, intérêts, assurance ; une série sans montant est retirée de la légende.
- `DebtWeightCard` et `PrepaymentCard` ne s'affichent que s'il existe un crédit avec `paymentsLeft > 0`.
- `PrepaymentCard` : somme par défaut 10 000 €, mode « Réduire la durée », placement « fonds euros » ; l'indemnité suit `maxPrepaymentFee` tant qu'elle n'est pas saisie, et se remet au plafond quand le crédit ou la somme changent.
- `LoanDialog` : refuse l'enregistrement si le nom manque, si le montant est nul, si la part n'est pas dans ]0 ; 1], si le différé atteint la durée, ou si capital relevé et date ne vont pas ensemble ; la case « Archivé » n'apparaît qu'en modification.

## Tests

| Fichier | Ce qu'il couvre |
|---|---|
| `packages/core/src/realestate/realestate.test.ts` (bloc « crédits », et deux tests du bloc « biens ») | Échéance, capital restant dû, relevé, assurance (trois modes), coût par année, différé partiel et total, remboursements anticipés, part à charge, capital passé (`loanHeldBalanceAt`), crédit à solder à la vente. |
| `packages/core/src/loans/debt.test.ts` | Taux assurance comprise, indemnité maximale (immobilier, consommation), rembourser ou placer, placements de comparaison. |
| `packages/core/src/analysis/debt.test.ts` | Poids des crédits : patrimoine, biens, revenus. |
| `packages/core/src/portfolio/engine.test.ts` | Part à charge des crédits dans le patrimoine. |
| `packages/backend/src/handlers/loans.test.ts` (blocs « assurance d'un crédit », « part à charge d'un crédit », « différé, remboursements anticipés et documents ») | Valeurs par défaut, nettoyage selon le mode d'assurance, bornes, sauvegardes sans ces colonnes, différé, remboursements anticipés. |
| `packages/backend/src/backend.test.ts` | Type par défaut, rattachement à un bien réservé aux crédits immobiliers et travaux. |
| `packages/ui/src/flows/placements.flow.test.tsx` (« Crédits », « Poids des crédits et « rembourser ou placer ? » », « Formulaire de crédit (LoanDialog) ») | Parcours de la page. |
| `packages/ui/src/flows/flows.test.tsx` | Crédit à la consommation, crédit partagé, crédit archivé. |

## Limites connues

- Seuls les prêts amortissables à taux fixe et échéances mensuelles sont calculés.
- Les tests du prêt sont encore dans `packages/core/src/realestate/realestate.test.ts`, alors que le code est dans `packages/core/src/loans/loan.ts`.
- Avec un `manualPayment` plus élevé que nécessaire et sans remboursement anticipé, l'échéancier continue jusqu'à `termMonths` après que le capital est tombé à 0 : `loanState` garde une mensualité et des échéances restantes (vérifié sur un prêt de 12 000 € à 0 % sur 12 mois avec 2 000 € par mois : mensualité de 2 000 € comptée jusqu'au 12e mois). La coupure à 0,005 € n'est faite que s'il existe un remboursement anticipé.
- Avant la première échéance, `loanState` compte le montant emprunté comme capital restant dû (patrimoine du jour, page Crédits), alors que `loanHeldBalanceAt` compte 0 (historique).
- Archiver un crédit à la main ne renseigne pas `closed_on` : il disparaît de l'historique à toutes les dates.
- `maxPrepaymentFee` applique aux crédits `travaux` la règle du crédit immobilier, quel que soit le montant ou la garantie du prêt.
- Le commentaire de `debt.ts` parle de « moins de 10 000 € » sans indemnité ; le code exonère jusqu'à 10 000 € inclus (`≤`).
- Le sous-titre du chiffre « Patrimoine net » de la page (« financier + immobilier − crédits ») omet les autres biens, que `netWorth.net` inclut.
- `rateWithInsurance` est un taux mensuel × 12 (taux proportionnel), pas un taux actuariel annuel.
- L'aide de « Revenus nets par mois » (Paramètres) mentionne les 70 % de loyers retenus par les banques, mais aucun loyer n'est ajouté au calcul.
