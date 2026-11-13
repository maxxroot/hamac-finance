# Immobilier : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Périmètre : la page `/immobilier`, la page d'un bien `/immobilier/:id` (onglet Finances et fiche du bien), la fiche imprimable `/impression/bien/:id`, les sociétés (SCI), le démembrement, les estimations, la vente, les dépenses, les recettes, les documents et les alertes DPE et documents. L'onglet Location, les lots, les baux, les loyers et les rappels saisis à la main sont dans la [documentation technique de la gestion locative](../gestion-locative/technique.md). Les crédits sont dans celle des [crédits](../credits/technique.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| core | `packages/core/src/realestate/realestate.ts` | Types `Property`, `PropertyValue`, libellés ; `propertyValue`, `propertySqm`, `propertyFees`, `propertyTotalCost`, `propertySummary`, `estimateNotaryFees`, `propertyHeldValueAt`, `loanPayoffAt`, `propertySale`, `companySummary`. |
| core | `packages/core/src/realestate/expenses.ts` | Dépenses (`PropertyExpense`, `EXPENSE_CATEGORIES`, `expenseDates`, `propertyImprovements`) et leur part récupérable sur le locataire (`RECOVERABLE_CATEGORIES`, `defaultRecoverableRate`, `recoverableAmount`, `ownerAmount`, `rateFromAmount`). |
| core | `packages/core/src/realestate/rental.ts` | Recettes (`PropertyIncome`, `incomeSigned`), résultats par année (`propertyYears`, `propertyProfitability`), registre des documents (`PropertyDocument`). |
| core | `packages/core/src/realestate/energy.ts` | DPE : `dpeExpiry`, `dpeRentalBan`, `dpeFreezesRent`. |
| core | `packages/core/src/model/ownership.ts` | Démembrement (`dismembermentRatio`, `usufructRate`, `DISMEMBERMENT_SOURCE`), sociétés (`Company`, `companyShare`, `withCompanyShares`), `heldShareLabel`. |
| core | `packages/core/src/portfolio/engine.ts` | `netWorth.realEstate` (biens non archivés, `propertyValue`) et place des biens dans l'allocation. |
| core | `packages/core/src/portfolio/history.ts` | Valeur passée des biens (`propertyHeldValueAt`) pour la page Historique. |
| core | `packages/core/src/alerts/alerts.ts` | `energyAlerts`, `documentAlerts`. |
| api | `packages/api/src/realestate/inputs.ts` | `PropertyInput`, `PropertySaleInput`, `PropertyValueInput`, `PropertyExpenseInput`, `PropertyIncomeInput`, `PropertyDocumentInput`, `CompanyInput`. |
| api | `packages/api/src/realestate/procedures.ts` | Procédures du domaine (`realestateProcedures`). |
| api | `packages/api/src/system/procedures.ts` | Type `Workspace`. |
| backend | `packages/backend/src/handlers/realestate/properties.ts` | Handlers des sociétés, biens, ventes, estimations, dépenses, recettes, documents et rappels. |
| backend | `packages/backend/src/handlers/realestate/index.ts` | Assemble les handlers du domaine. |
| backend | `packages/backend/src/db/schema/realestate.ts` | Tables `companies`, `properties`, `property_values`, `property_expenses`, `property_incomes`, `property_documents` (et celles de la gestion locative). |
| backend | `packages/backend/src/repo/mappers/realestate.ts` | Lignes → objets du domaine. |
| backend | `packages/backend/src/repo/loadWorkspace.ts` | Chargement de l'espace de travail. |
| backend | `packages/backend/src/backup/dump.ts` | `TABLES` : ordre des tables dans les sauvegardes. |
| ui | `packages/ui/src/features/realestate/pages/Immobilier.tsx` | Page `/immobilier`. |
| ui | `packages/ui/src/features/realestate/pages/Bien.tsx` | Page d'un bien : chiffres, onglets Location et Finances. Chaque onglet range ses cartes en deux colonnes indépendantes (`CardColumns`) : Finances met l'achat et les crédits à gauche, la valeur, les dépenses et les recettes à droite, puis les résultats par année sur toute la largeur. |
| ui | `packages/ui/src/features/realestate/components/PurchaseCard.tsx` | Achat du bien entier, frais et travaux d'amélioration. |
| ui | `packages/ui/src/features/realestate/components/PropertyLoansCard.tsx` | Crédits rattachés, part à charge. |
| ui | `packages/ui/src/features/realestate/pages/ImpressionBien.tsx` | Fiche imprimable. |
| ui | `packages/ui/src/features/realestate/components/PropertySheetModal.tsx` | Fiche du bien (grande fenêtre). |
| ui | `packages/ui/src/features/realestate/components/PropertySheetCards.tsx` | `SaleCard` (bilan de la vente). |
| ui | `packages/ui/src/features/realestate/components/CompaniesCard.tsx` | Carte « Sociétés (SCI) » et formulaire d'une société. |
| ui | `packages/ui/src/features/realestate/components/ValuesCard.tsx` | « Valeur dans le temps » et ajout d'une estimation. |
| ui | `packages/ui/src/features/realestate/components/ExpensesCard.tsx` | Dépenses, avec la colonne « À votre charge ». |
| ui | `packages/ui/src/features/realestate/dialogs/ExpenseDialog.tsx` | Saisie d'une dépense : part récupérable en pourcentage (copropriété, autre), TEOM en montant (taxe foncière). |
| ui | `packages/ui/src/features/realestate/components/IncomesCard.tsx` | Autres recettes et leur formulaire. |
| ui | `packages/ui/src/features/realestate/components/PropertyYearsCard.tsx` | Résultats par année. |
| ui | `packages/ui/src/features/realestate/components/DocumentsCard.tsx` | Registre des documents et son formulaire. |
| ui | `packages/ui/src/features/realestate/components/EnergyDiagram.tsx` | Étiquettes DPE et GES. |
| ui | `packages/ui/src/features/realestate/components/AddressInput.tsx` | Champ d'adresse avec suggestions. |
| ui | `packages/ui/src/features/realestate/lib/addressSearch.ts` | Appel à la Base Adresse Nationale (`https://data.geopf.fr/geocodage/search/`). |
| ui | `packages/ui/src/features/realestate/dialogs/PropertyDialog.tsx` | Formulaire d'un bien (utilisation, statut, SCI, démembrement, achat, frais, allocation). |
| ui | `packages/ui/src/features/realestate/dialogs/PropertySheetDialog.tsx` | Formulaire de la fiche descriptive. |
| ui | `packages/ui/src/features/realestate/dialogs/SaleDialog.tsx` | Vente. |
| ui | `packages/ui/src/features/realestate/dialogs/ExpenseDialog.tsx` | Dépense. |
| ui | `packages/ui/src/shared/components/CardColumns.tsx` | Deux colonnes de cartes empilées chacune de son côté, sans vide sous une carte courte. |
| ui | `packages/ui/src/shared/components/DismembermentFields.tsx` | Champs du démembrement, partagés avec les autres biens. |
| ui | `packages/ui/src/shared/lib/portfolio.ts` | Applique `withCompanyShares` avant le moteur. |
| ui | `packages/ui/src/features/realestate/index.ts` | Façade du domaine (pages exportées). |
| ui | `packages/ui/src/app/App.tsx`, `packages/ui/src/shared/nav.ts` | Routes et entrée du menu (module `immobilier`). |

## Données

### Tables (schéma du tenant)

| Table | Contenu | Remarques |
|---|---|---|
| `companies` | SCI : nom, `share` (part des parts), commentaire, archivée. | `properties.company_id` → `companies.id`, `ON DELETE SET NULL` : supprimer une société garde ses biens. |
| `properties` | Le bien : utilisation (`kind`), statut (`ownership`), valeur et date, achat et frais (`*_cents`), `new_build`, fiche descriptive, DPE et GES, `dpe_reminders`, `rental_mode`, vente (`sale_date`, `sale_price_cents`, `sale_fees_cents`), `share`, `company_id`, démembrement (`dismemberment`, `usufruct_birth_date`, `usufruct_end`), `in_allocation`, `class_id`, archivé. | La valeur actuelle reste sur le bien. |
| `property_values` | Estimations passées : `property_id`, `date`, `value_cents`. | Index unique (`property_id`, `date`). Cascade à la suppression du bien. |
| `property_expenses` | Dépenses : date, catégorie, montant, libellé, `yearly`, `until_year`, `improvement`, `recoverable_rate` (part récupérable sur le locataire, de 0 à 1 ; migration 0031, qui passe la copropriété existante aux deux tiers). | Cascade. |
| `property_incomes` | Recettes hors loyer : date, catégorie, montant positif, libellé. | Cascade. |
| `property_documents` | Registre : type, nom, date, `expires_on`, emplacement. | Cascade. |

`loans.property_id` → `properties.id` en `ON DELETE SET NULL` : supprimer un bien garde ses crédits. Les tables de la gestion locative (lots, baux, loyers, rappels) sont aussi en cascade sur le bien.

Toutes ces tables figurent dans `TABLES` (`packages/backend/src/backup/dump.ts`), `companies` avant `properties`.

### Procédures du contrat

| Procédure | Règles côté backend |
|---|---|
| `companies.upsert`, `companies.delete` | Mise à jour d'un id inconnu : `NOT_FOUND`. |
| `properties.upsert` | Société inconnue : `NOT_FOUND`. `company_id` n'est gardé que pour un statut `sci` ou `sci_familiale`. En pleine propriété, la naissance et la fin de l'usufruit sont effacées. Si `valueDate` change, l'ancienne valeur est copiée dans `property_values` (`keepPastValue`, qui écrase une estimation à la même date). Le schéma zod exige, hors pleine propriété, une naissance ou une fin d'usufruit. |
| `properties.delete` | Suppression en cascade (voir plus haut). |
| `properties.sell` | Vente avant l'achat : `VALIDATION`. Écrit la vente et `archived = true`. Avec `closeLoans` (vrai par défaut), archive les crédits non archivés du bien avec `closed_on = saleDate`. |
| `properties.cancelSale` | Rétablit les crédits du bien dont `closed_on` vaut la date de vente, puis efface la vente et désarchive. |
| `propertyValues.add` | Date antérieure à l'estimation actuelle : ajoutée à l'historique seulement. Sinon l'estimation actuelle passe dans l'historique (si sa date diffère) et la nouvelle la remplace. |
| `propertyValues.delete` | — |
| `propertyExpenses.upsert`, `.delete` | Bien inconnu : `NOT_FOUND`. `untilYear` antérieure à l'année de la date : `VALIDATION`. `untilYear` n'est gardée que si `yearly` ; `improvement` seulement pour la catégorie `travaux`. |
| `propertyIncomes.upsert`, `.delete` | Bien inconnu : `NOT_FOUND`. Montant strictement positif (zod). |
| `propertyDocuments.upsert`, `.delete` | Bien inconnu : `NOT_FOUND`. Nom requis (zod). |

Bornes zod notables (`PropertyInput`) : `share` dans ]0 ; 1], `surface` > 0, `buildYear` entre 1000 et 2200, notes de 500 caractères au plus.

### Champs du `Workspace` utilisés

`properties`, `companies`, `propertyValues`, `propertyExpenses`, `propertyIncomes`, `propertyDocuments`, `loans` (crédits rattachés, vente), `lots`, `leases`, `leaseRents`, `rentPayments`, `rentWaivers` (résultats par année), `accounts` et leurs positions (SCPI), `params` (classe Immobilier, classes personnalisées).

La page lit deux versions des biens : `pf.idx.ws.properties`, tels que saisis (formulaires), et `pf.data.properties`, après `withCompanyShares` (calculs). Il en va de même des crédits.

## Règles de calcul

### Part détenue

- `propertyValue(p, date) = value × share × dismembermentRatio(p, date)`, arrondi au centime.
- `withCompanyShares` multiplie `share` d'un bien de SCI par `companies.share`, et `share` de ses crédits du même facteur. L'interface l'applique une fois pour toutes dans `engineFor` (`packages/ui/src/shared/lib/portfolio.ts`).
- `companySummary` : biens non archivés de la société et crédits non archivés de ces biens, **avant** les parts de société ; `net = valeur − dettes`, `held = net × company.share`.

### Démembrement

Barème de l'article 669 du CGI (BOI-ENR-DMTG-10-40-10-50, vérifié le 11 novembre 2026) :

- usufruit viager : `lifeUsufructRate(age)` vaut 90 % avant 21 ans, 10 % à partir de 91 ans, et `0,9 − ⌊(âge − 11) / 10⌋ × 0,1` entre les deux (âge révolu) ;
- usufruit à durée fixe : 23 % par période de dix ans commencée (`fixedUsufructPeriods`), plafonné à 100 % et à l'usufruit viager si la naissance est aussi connue ; une fois terminé, il vaut 0 ;
- nue-propriété : `1 − usufruit` ;
- usufruitier inconnu : ratio 1.

### Coûts, gain, valeur nette

- `propertyFees = notaire + agence + travaux à l'achat + autres`.
- `propertyTotalCost = prix + frais`, `null` sans prix d'achat.
- `propertyImprovements` : somme des dépenses `improvement` payées jusqu'à la date (les dépenses annuelles comptent à chaque occurrence, `expenseDates`).
- `propertySummary` : `heldCost = (coût total + améliorations) × share`, `gain = heldValue − heldCost`, `heldDebt` et `heldMonthly` sur les `LoanState` passés dont `propertyId` est le bien, `netValue = heldValue − heldDebt`. La page passe `netWorth.loans`, donc les seuls crédits non archivés.

### Frais de notaire (`estimateNotaryFees`)

Sources citées dans le code : art. A444-91 du code de commerce et service-public.gouv.fr, fiche F17701 (émoluments : 1 995,25 € HT pour 200 000 €) ; art. 1594 D du CGI, art. 116 de la loi n° 2025-127, BOI-ENR-DMTOI-10-20 et tableau des taux de la DGFiP (droits de mutation). Pas de date de consultation dans le code.

```
droits     = prix × 6,3185 %   (ancien, achat ≥ 2025-04-01 ou date inconnue)
           = prix × 5,80665 %  (ancien, achat < 2025-04-01)
           = prix × 0,715 %    (neuf ou VEFA)
émoluments = Σ tranches : 3,87 % jusqu'à 6 500 €, 1,596 % jusqu'à 17 000 €, 1,064 % jusqu'à 60 000 €, 0,799 % au-delà
total      = arrondi( droits + émoluments × 1,20 + prix × 0,1 % + 1 000 )
```

Prix nul ou négatif : 0. Le formulaire suit l'estimation tant que `notaryFees` vaut 0 à l'ouverture et n'a pas été saisi.

### Valeur dans le temps (`propertyHeldValueAt`)

- 0 avant `purchaseDate`, à partir de `saleDate`, ou à toute date si le bien est archivé sans date de vente.
- Sinon : dernière estimation connue à la date (historique + estimation actuelle si `valueDate`), sinon `purchasePrice`, sinon la première estimation ; sans aucune estimation datée, `value`.

### Vente (`propertySale`, `loanPayoffAt`)

- `price = salePrice × share`, `fees = saleFees × share`, `cost = (coût total + améliorations) × share`, `gain = price − fees − cost`, `net = price − fees − loanPayoff`.
- `loanPayoffAt` : crédits du bien non archivés ou soldés le jour de la vente ; avant la première échéance, le capital emprunté × part ; sinon `loanState(...).heldBalance`.
- `null` si `saleDate` ou `salePrice` manque.

### Dépenses et recettes

- `expenseDates` : une dépense ponctuelle compte à sa date si elle est passée ; une dépense annuelle chaque année à la même date, jusqu'à `untilYear` inclus.
- `incomeSigned` : `regularisation_rendue` compte en négatif, les autres catégories en positif.

### Part récupérable des dépenses (`expenses.ts`)

Source : décret n° 87-713 du 26 août 1987, annexe (liste limitative des charges récupérables), dont la taxe d'enlèvement des ordures ménagères (TEOM) ; le reste de la taxe foncière n'est pas récupérable. Relu le 13 novembre 2026 sur des sources secondaires, à confirmer sur Légifrance.

- `recoverableRate` (0 à 1) sur chaque dépense. Seules `copropriete`, `taxe_fonciere` et `autre` peuvent en avoir une (`RECOVERABLE_CATEGORIES`) ; le backend force 0 ailleurs et sur une amélioration.
- Valeur proposée (`defaultRecoverableRate`) : `params.rental.coproRecoverable` pour la copropriété (deux tiers par défaut), 0 ailleurs. Le backend l'applique quand l'entrée n'a pas de `recoverableRate`.
- Taxe foncière : l'interface demande le montant de la TEOM et le convertit (`rateFromAmount`, borné entre 0 et 1).
- `recoverableAmount` = montant × part (0 pour une amélioration) ; `ownerAmount` = montant − récupérable.
- Une sauvegarde d'avant la migration 0031 reçoit la même reprise à la restauration (`upgradeLegacyExpenses`, `packages/backend/src/backup/dumpUpgrade.ts`).

### Résultats par année (`propertyYears`, `propertyProfitability`)

Calculés pour un bien en location, sur les données après parts de SCI. Horizon : la date de vente si elle est passée, sinon aujourd'hui ; le dernier jour compté est la fin du mois en cours (ou la date de vente).

- Années : de la première parmi l'achat, le premier bail, les dépenses, les recettes et les échéances des crédits du bien, jusqu'à l'année de l'horizon.
- `rents`, `charges` : `receivedRent` et `receivedCharges` des mois de loyer de l'année (rattachés au mois du loyer, pas à la date du paiement), × `share`.
- `otherIncome` : recettes signées, plus `depositRetained` à la date `depositReturnedOn`, × `share`.
- `expenses` : toutes les occurrences de l'année, améliorations comprises, × `share`.
- `recoverable` : part récupérable de ces dépenses, × `share`. Information seule : `remaining` compte le cash réel, où les provisions reçues (`charges`) couvrent cette part.
- `interest`, `insurance`, `capital` : `loanYears(loan, horizon)` des crédits du bien, × `loan.share`.
- `remaining = (rents + charges + otherIncome − expenses) × share − interest − insurance − capital` (rents, charges… avant la part).
- `rentalDays` : du premier bail (ou du 1er janvier) au dernier jour compté, dans l'année. `partial` si 0 < `rentalDays` < jours de l'année.
- `annualize = joursDeLAnnée / rentalDays / (coût total + améliorations payées jusqu'au 31 décembre)` ; `null` sans coût ou sans période de location.
- `grossYield = loyers reçus × annualize` ; `netYield = (loyers + charges reçues + recettes − dépenses hors améliorations) × annualize`. Sans crédit. La part se compense : ces rendements ne dépendent pas de `share`.
- `occupancy` : occupation pondérée par le loyer, sur les fenêtres de chaque lot (`lotWindows`, détaillé dans la [documentation de la gestion locative](../gestion-locative/technique.md)) ; `null` avant le premier bail ; plafonnée à 1.
- `propertyProfitability` : année de référence = dernière année louée complète, sinon dernière année louée ; `monthlyRemaining = remaining / rentalMonths` ; cumuls `totalRents` et `totalCapital` depuis la première année. `null` tant que le bien n'a jamais été loué.

### Repères au m² (`propertySqm`)

Prix d'achat, valeur et loyer du mois (`monthlyRentNow`, somme des loyers hors charges des baux en cours) divisés par la surface ; `null` sans surface. La fiche imprimable ne passe pas de loyer.

### DPE (`energy.ts`)

Sources : décret n° 2020-1610 du 17 décembre 2020, art. D.134-4-2 du CCH (validité) ; service-public.gouv.fr (A17975), ecologie.gouv.fr et anil.org pour le calendrier d'interdiction, consultés le 09/11/2026.

- `dpeExpiry` : DPE d'avant 2018 : dix ans, au plus tard le 31/12/2022 ; du 01/01/2018 au 30/06/2021 : 31/12/2024 ; ensuite dix ans.
- `dpeRentalBan` : métropole G 2025-01-01, F 2028-01-01, E 2034-01-01 ; outre-mer (codes postaux 971, 972, 973, 974, 976) G 2028-01-01, F 2031-01-01. Sans code postal : métropole.
- `dpeFreezesRent` : F ou G.

### Alertes (`alerts.ts`)

- `energyAlerts`, pour les biens non archivés avec `dpeReminders` : DPE expiré (« attention » si le bien est loué, « information » sinon) ; DPE qui expire dans 90 jours ou moins (« information ») ; pour un bien loué, interdiction de louer passée (« attention ») ou à moins de 730 jours (« information »).
- `documentAlerts`, pour les biens non archivés : document qui expire dans 30 jours ou moins (« information ») ou expiré (« attention »).

Les deux renvoient vers `/immobilier/<id>`.

### Interface

- `Immobilier.tsx` : *Biens immobiliers* = `netWorth.realEstate` ; *SCPI* = valeur des positions `scpi` des comptes ; allocation affichée = `inAllocation ?? classEnabled(params, "immobilier")`.
- `CompaniesCard` : visible s'il existe une société ou un bien au statut `sci` / `sci_familiale`.
- `Bien.tsx` : onglet choisi par `?onglet=location|finances` (les alertes de bail renvoient à `?onglet=location`) ; onglet Location seulement pour `kind = "locatif"`.
- `SaleDialog` : refuse une date antérieure à l'achat avant même l'appel.
- `AddressInput` : n'appelle le service qu'à partir de 3 caractères tapés, après 250 ms, sans cookie ni référent (`credentials: "omit"`, `referrerPolicy: "no-referrer"`) ; la CSP autorise `https://data.geopf.fr` dans `packages/ui/index.html` et `apps/server/src/http/app.ts`.

## Tests

| Fichier | Ce qu'il couvre |
|---|---|
| `packages/core/src/realestate/realestate.test.ts` (bloc « biens ») | Frais de notaire chiffrés, synthèse, vente, valeur dans le temps, crédit à solder, repères au m², coût complet. |
| `packages/core/src/realestate/expenses.test.ts` | Part récupérable : valeur proposée, montant récupérable et reste à charge, TEOM convertie. |
| `packages/core/src/realestate/rental.test.ts` | Dates des dépenses, résultats par année, part récupérable, améliorations, recettes, dépôt gardé, vente. |
| `packages/core/src/realestate/energy.test.ts` | Validité du DPE, interdiction de louer, alertes DPE. |
| `packages/core/src/model/ownership.test.ts` | Barème de l'usufruit, valeur détenue, parts de SCI. |
| `packages/core/src/portfolio/engine.test.ts` | Part détenue des biens dans le patrimoine, nue-propriété. |
| `packages/core/src/realestate/leases.test.ts` (bloc « rappels de documents et d'assurance ») | Alertes de documents. |
| `packages/backend/src/handlers/realestate/properties.test.ts` | Part récupérable des dépenses : valeur proposée et réglage, catégories exclues, migration 0031, ancienne sauvegarde. |
| `packages/backend/src/handlers/loans.test.ts` (blocs « statut et frais d'un bien », « vie d'un bien », et le test des documents dans « différé, remboursements anticipés et documents ») | Statut, frais, fiche descriptive, estimations, vente et annulation, améliorations, documents, sauvegardes. |
| `packages/backend/src/backend.test.ts` | SCI et démembrement d'un bien. |
| `packages/ui/src/features/realestate/lib/addressSearch.test.ts` | Lecture de la réponse du service d'adresse, seuil de 3 caractères, panne. |
| `packages/ui/src/flows/placements.flow.test.tsx` (« Immobilier », « Fiche de bien : formulaire d'achat », « Bien : vente… », « Bien : dépenses », « Bien : finances, fiche descriptive et documents ») | Parcours de la page et de la page d'un bien. |
| `packages/ui/src/flows/flows.test.tsx` | Fiche d'un bien, fiche descriptive, vente, impression, nouveau bien. |
| `packages/ui/src/flows/reglages.flow.test.tsx` (« sociétés (SCI) », « fiche d'un bien : estimations, recettes et documents ») | SCI, estimations, recettes et documents. |

## Limites connues

- Aucun calcul d'impôt (plus-value immobilière, revenus fonciers, location meublée).
- Frais de notaire : TVA de métropole, forfait de formalités, taux départemental le plus courant ; pas de date de consultation des sources dans le code.
- Un bien archivé sans `saleDate` vaut 0 à toutes les dates de l'historique, y compris avant son archivage.
- Dans le tableau de la page Immobilier, « Valeur détenue » d'un bien vendu ou archivé reste affichée (`propertyValue` ne regarde ni la vente ni l'archivage), alors que le bien ne compte plus dans le total.
- `properties.upsert` copie l'ancienne valeur dans l'historique dès que `valueDate` change, même si la nouvelle date est plus ancienne.
- Le commentaire de `packages/ui/src/features/realestate/lib/addressSearch.ts` cite l'ancien chemin du serveur (`app.ts` à la racine de `apps/server/src`) ; le fichier est désormais `apps/server/src/http/app.ts`.
- Les crédits rattachés de `propertySummary` n'incluent pas les crédits archivés (soldés).
