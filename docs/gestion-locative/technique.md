# Gestion locative : documentation technique

> Pour l'utilisateur : [guide](guide.md).

Périmètre : la page `/gestion-locative`, l'onglet Location de la page d'un bien (`/immobilier/:id?onglet=location`), les courriers imprimables (`/impression/quittance|avis|relance|attestation|revision/...`), les alertes de bail et l'indice de référence des loyers. La proposition d'origine est [`docs/propositions/gestion-locative.md`](../propositions/gestion-locative.md) : ses tranches 1 à 3 sont codées (lots, vue du parc, encaissements et relances), les tranches 4 à 7 non. Les résultats par année et les rendements d'un bien sont décrits dans la [documentation technique de l'immobilier](../immobilier/technique.md#résultats-par-année-propertyyears-propertyprofitability).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| core | `packages/core/src/realestate/lots.ts` | Modes de location, natures de lot, `lotKindsFor`, `lotFitsMode`, `lotIsActive`, `lotIsAnnex`, `defaultLotName`, `sortLots`. |
| core | `packages/core/src/realestate/lotStatus.ts` | `lotStatus` : loué, bientôt loué ou vide depuis quand. |
| core | `packages/core/src/realestate/renters.ts` | Locataires, liens bail–locataire, garanties ; `renterName`, `joinNames`, `leaseRenters`, `leaseRenterNames`. |
| core | `packages/core/src/realestate/leases.ts` | Types de bail et règles légales, fin et état d'un bail, `validateLease`, loyers en vigueur, mois de loyer pointés (`rentMonths`), `settlingPayment`, `leaseBalance`, dépôt gardé, `leaseRevisionDue`, `rentReceipt`, `leaseKindsFor`, `rentalModeFromLeases`. |
| core | `packages/core/src/realestate/rentNotices.ts` | Relances : `leaseArrears`, `noticeStep`. |
| core | `packages/core/src/realestate/irl.ts` | Révision annuelle d'après l'IRL : zone, trimestre, anniversaire à réviser, date d'effet, calcul, `proposeRevision`. |
| core | `packages/core/src/realestate/energy.ts` | `dpeFreezesRent`, `dpeExpiry` (utilisés par la révision et l'échéancier). |
| core | `packages/core/src/realestate/rental.ts` | `RentalData`, fenêtres de location des lots (`lotWindows`, `rentalWindows`), `propertyYears`, `propertyProfitability`. |
| core | `packages/core/src/realestate/rentalPark.ts` | Vue du parc : `parkProperties`, `parkMonth`, `parkDebts`, `parkVacancies`, `lotPotentialRent`, `relocationGaps`, `propertyOccupancy`, `parkOccupancy`, `parkPropertyRows`, `parkSchedule`, type `PropertyReminder`. |
| core | `packages/core/src/alerts/alerts.ts` | `leaseAlerts` (appelée par `computeAlerts` avec `params.alerts`). |
| core | `packages/core/src/model/params.ts` | Délais de relance `alerts.rentReminderDays`, `rentRelanceDays`, `rentFormalNoticeDays` (10, 20, 30 par défaut, ordre contrôlé). |
| api | `packages/api/src/realestate/inputs.ts` | `LotInput`, `RenterInput`, `LeaseGuaranteeInput`, `LeaseInput`, `LeaseRentInput`, `RentPaymentInput`, `RentPaymentsInput`, `RentWaiverInput`, `RentNoticeInput`, `PropertyReminderInput`. |
| api | `packages/api/src/realestate/procedures.ts` | Procédures `lots.*`, `renters.*`, `leases.*`, `leaseRents.*`, `rentPayments.*`, `rentWaivers.*`, `rentNotices.*`, `propertyReminders.*`. |
| api | `packages/api/src/assets/procedures.ts` | `market.irl` (indice des loyers). |
| backend | `packages/backend/src/handlers/realestate/leases.ts` | Lots, locataires, baux (avec locataires et garanties), loyers des baux et révisions. |
| backend | `packages/backend/src/handlers/realestate/rents.ts` | Paiements pointés, mois remis, relances. |
| backend | `packages/backend/src/handlers/realestate/properties.ts` | `propertyReminders.*`. |
| backend | `packages/backend/src/handlers/assets.ts` | Handler de `market.irl`. |
| backend | `packages/backend/src/market/sources/irl.ts` | Lecture des séries IRL de l'INSEE (SDMX). |
| backend | `packages/backend/src/market/shared.ts` | `SharedMarket.irl()` : cache de l'instance. |
| backend | `packages/backend/src/db/schema/realestate.ts` | Tables du domaine. |
| backend | `packages/backend/src/repo/mappers/realestate.ts` | Lignes → objets. |
| backend | `packages/backend/src/backup/dump.ts`, `packages/backend/src/backup/dumpUpgrade.ts` | Sauvegardes ; reprise des sauvegardes d'avant les lots (`upgradeLegacyDump`) et d'avant le suivi strict (`upgradeLegacyRentExceptions`). |
| ui | `packages/ui/src/features/realestate/pages/GestionLocative.tsx` | Page `/gestion-locative`. |
| ui | `packages/ui/src/features/realestate/pages/Bien.tsx` | Onglet Location : une `LeaseCard` par lot, `RentsCard`, `LotsCard`. |
| ui | `packages/ui/src/features/realestate/components/LeaseCard.tsx` | Bail en cours d'un lot, révision proposée, évolution du loyer, autres baux. |
| ui | `packages/ui/src/features/realestate/components/ArrearsPanel.tsx` | Retards d'un bail, étape de relance, envois notés, rappels caution et CAF. |
| ui | `packages/ui/src/features/realestate/components/RentsCard.tsx` | Mois de loyer d'une année, « Reçu », « Détail », « Valider l'année ». |
| ui | `packages/ui/src/features/realestate/components/LotsCard.tsx` | Lots et leur situation. |
| ui | `packages/ui/src/features/realestate/components/RentStatusBadge.tsx` | Badge d'état d'un loyer. |
| ui | `packages/ui/src/features/realestate/dialogs/LeaseDialog.tsx` | Formulaire du bail (locataires, garanties, congé, sortie). |
| ui | `packages/ui/src/features/realestate/dialogs/LeaseRentDialog.tsx` | Nouveau loyer saisi à la main. |
| ui | `packages/ui/src/features/realestate/dialogs/RentRevisionDialog.tsx` | Révision annuelle. |
| ui | `packages/ui/src/features/realestate/dialogs/RentMonthDialog.tsx` | Détail d'un mois : paiements, remise. |
| ui | `packages/ui/src/features/realestate/dialogs/LotDialog.tsx` | Lot. |
| ui | `packages/ui/src/features/realestate/dialogs/ReminderDialog.tsx` | Rappel saisi à la main. |
| ui | `packages/ui/src/features/realestate/pages/Quittance.tsx` | Quittance ou reçu d'un mois. |
| ui | `packages/ui/src/features/realestate/pages/AvisEcheance.tsx` | Avis d'échéance. |
| ui | `packages/ui/src/features/realestate/pages/Relance.tsx` | Courrier de relance (trois niveaux). |
| ui | `packages/ui/src/features/realestate/pages/AttestationLoyer.tsx` | Attestation de loyer. |
| ui | `packages/ui/src/features/realestate/pages/CourrierRevision.tsx` | Courrier de révision. |
| ui | `packages/ui/src/features/realestate/lib/leaseLetters.ts` | Adresse du logement et destinataires des courriers. |
| ui | `packages/ui/src/shared/components/PrintPage.tsx` | Mise en page des pages à imprimer. |
| ui | `packages/ui/src/features/settings/pages/Parametres/PlanTab.tsx` | Réglage des délais de relance. |
| ui | `packages/ui/src/app/App.tsx` | Routes `/gestion-locative` et `/impression/...`. |
| ui | `packages/ui/src/shared/nav.ts` | Entrée du menu (module `immobilier`). |

## Données

### Tables (schéma du tenant)

| Table | Colonnes utiles | Contraintes |
|---|---|---|
| `properties` | `kind` (`locatif` pour être suivi), `rental_mode`, `postal_code` (zone IRL), `dpe`, `dpe_date`. | Voir [immobilier](../immobilier/technique.md). |
| `lots` | `property_id`, `name`, `kind`, `surface`, `target_rent_cents`, `comment`, `archived`, `sort_order`. | Cascade sur le bien. |
| `renters` | `first_name`, `last_name`, `email`, `phone`, `forwarding_address`, `comment`. | Pas rattachés à un bien : réutilisables d'un bail à l'autre. |
| `lease_renters` | `lease_id`, `renter_id`, `sort_order`. | Cascade sur le bail et sur le locataire. |
| `lease_guarantees` | `lease_id`, `kind`, `name`, `contact`, `amount_cents`, `until`, `comment`, `sort_order`. | Cascade sur le bail. |
| `leases` | `property_id`, `lot_id`, `kind`, `start_date`, `duration_months`, `rent_cents`, `charges_cents`, `deposit_cents`, `notice_by`, `notice_date`, `notice_months`, `actual_end`, `reminders`, `deposit_returned_cents`, `deposit_returned_on`, `deposit_reason`, `landlord`, `landlord_address`, `tenant_insurance_until`, `revisable`, `irl_quarter`, `due_day`, `comment`. | Cascade sur le bien ; `lot_id` → `lots.id` sans action. |
| `lease_rents` | `lease_id`, `from_month`, `rent_cents`, `charges_cents`, détail de révision (`revision_anniversary`, `revision_demand_date`, `revision_previous_rent_cents`, `revision_quarter_new`, `revision_quarter_old`, `revision_index_new`, `revision_index_old`). | Unique (`lease_id`, `from_month`). |
| `rent_payments` | `lease_id`, `month`, `date`, `amount_cents`, `method`, `comment`. | Plusieurs par mois. Cascade. |
| `rent_waivers` | `lease_id`, `month`, `comment`. | Unique (`lease_id`, `month`). Cascade. |
| `rent_notices` | `lease_id`, `level`, `sent_on`, `amount_cents`, `comment`. | Cascade. |
| `property_reminders` | `property_id`, `lot_id`, `date`, `yearly`, `label`, `comment`, `done_on`. | Cascade sur le bien, `lot_id` en `SET NULL`. |

Toutes figurent dans `TABLES` (`packages/backend/src/backup/dump.ts`) dans l'ordre des clés étrangères : `properties`, `lots`, `renters`, `leases`, `lease_renters`, `lease_guarantees`, `lease_rents`, `rent_payments`, `rent_waivers`, `rent_notices`, …, `property_reminders`.

Migrations concernées (`packages/backend/drizzle/`) : `0022` (lots, locataires, garanties, `rental_mode`, `leases.lot_id`), `0024` (`property_reminders`), `0025` (`rent_payments`, `rent_waivers`, `leases.due_day`, reprise des signalements), `0026` (suppression de `rent_exceptions`), `0027` (`rent_notices`).

### Procédures du contrat et règles du backend

| Procédure | Règles |
|---|---|
| `lots.upsert` | Bien inconnu, ou lot d'un autre bien : `NOT_FOUND`. Changer la nature d'un lot qui a des baux : `CONFLICT`. |
| `lots.delete` | Lot qui a des baux : `CONFLICT` (l'interface propose de l'archiver). |
| `renters.upsert`, `renters.delete` | Un id inconnu : `NOT_FOUND`. Supprimer un locataire inscrit sur un bail : `CONFLICT`. Aucun écran ne les appelle directement : les locataires passent par `leases.upsert`. |
| `leases.upsert` | Bien inconnu : `NOT_FOUND` ; bien qui n'est pas `locatif` : `CONFLICT`. Sans `lotId` (ni lot du bail existant) : le seul lot actif non annexe ; s'il y en a plusieurs, `VALIDATION` « Choisissez le lot loué. » ; en mode `chambres` sans chambre, `VALIDATION` ; sinon un lot « Logement » est créé. Le type doit figurer dans `leaseKindsFor(mode, lot.kind)` pour un nouveau bail, ou si le type ou le lot change (un bail existant garde son type même si le mode a changé). `validateLease` contre les autres baux du bien. `notice_months` n'est gardé que pour un congé du locataire, `deposit_reason` que si un dépôt rendu est saisi. Locataires : repris par id ou créés, liens réécrits dans l'ordre reçu (doublons ignorés). Garanties : la liste reçue remplace celle du bail. Le tout dans une transaction. |
| `leases.delete` | Supprime en cascade loyers, paiements, remises, relances, liens et garanties. |
| `leaseRents.upsert` | Bail inconnu : `NOT_FOUND`. Avec `revision` : bail sans clause ou non vide/meublé, ou note F/G : `CONFLICT` ; demande plus d'un an après l'anniversaire, ou loyer supérieur au calcul : `VALIDATION` ; `from_month` forcé au mois de `revisionEffectiveDate`. Dans tous les cas, `from_month` doit suivre le premier mois du bail (`VALIDATION`). Même mois déjà présent : remplacé. |
| `leaseRents.delete` | — |
| `rentPayments.upsert` | Bail inconnu : `NOT_FOUND`. Mois avant le début ou après la fin du bail : `VALIDATION`. |
| `rentPayments.addMany` | Mêmes contrôles pour chaque paiement, dans une transaction : tout ou rien. 1 à 2 000 paiements. Renvoie `{ count }`. |
| `rentPayments.delete` | — |
| `rentWaivers.set` | Mêmes contrôles de mois. Mois déjà remis : commentaire remplacé. |
| `rentWaivers.delete` | — |
| `rentNotices.add` | Bail inconnu : `NOT_FOUND`. |
| `rentNotices.delete` | — |
| `propertyReminders.upsert` | Bien inconnu, ou lot d'un autre bien : `NOT_FOUND`. Un rappel annuel n'est jamais « fait » (`done_on` forcé à null). |
| `propertyReminders.delete` | — |
| `market.irl` | Renvoie `IrlData` (séries des trois zones et date de lecture). |

Bornes zod notables : `LeaseInput.durationMonths` de 1 à 600, `dueDay` de 1 à 31, `irlQuarter` de 1 à 4, 12 locataires et 12 garanties au plus ; congé et date vont ensemble, dépôt rendu et date aussi ; `RenterInput` exige un prénom ou un nom ; `RentPaymentInput.amount` > 0.

### Champs du `Workspace` utilisés

`properties`, `lots`, `leases`, `renters`, `leaseRenters`, `leaseGuarantees`, `leaseRents`, `rentPayments`, `rentWaivers`, `rentNotices`, `propertyExpenses`, `propertyIncomes`, `propertyDocuments`, `propertyReminders`, `loans`, et `params.alerts` (délais de relance). La page Gestion locative passe `ws` tel quel à `ParkData` : **les parts détenues et les parts de SCI ne sont pas appliquées**, les montants sont ceux du bien entier.

## Règles de calcul

### Modes de location et lots (`lots.ts`)

Source citée : loi n° 89-462 du 6 juillet 1989, art. 8-1 (colocation), consultée sur legifrance.gouv.fr le 12/11/2026.

- Modes : `vide`, `meuble`, `colocation` (un bail pour tous), `chambres` (un bail par chambre).
- `lotKindsFor(mode)` : les annexes (`parking`, `cave`, `local`, `autre`) toujours, plus `chambre` en mode `chambres`, `logement` sinon.
- `lotIsActive` : non archivé et adapté au mode. Un lot inactif garde ses baux et son historique.
- `leaseKindsFor(mode, lotKind)` : annexe → `autre` seulement ; `vide` → `vide`, `autre` ; `meuble` → `meuble`, `etudiant`, `mobilite`, `autre` ; `colocation` et `chambres` → tous.
- `defaultLotName` : « Logement », « Chambre 1 », « Parking », puis « Parking 2 »… ; `sortLots` trie par `sortOrder` puis par nom, en ordre naturel.
- `rentalModeFromLeases` (reprise des anciennes données) : `meuble` si le bail le plus récent est meublé, étudiant ou mobilité, sinon `vide`.

### Règles légales d'un bail (`leases.ts`)

Sources citées : loi n° 89-462 du 6 juillet 1989, art. 10, 13, 15 et 22 (location vide), 25-6 à 25-8 (meublé), 25-14, 25-15 et 25-17 (bail mobilité), consultés sur legifrance.gouv.fr le 09/11/2026 ; fin de préavis : service-public.gouv.fr, fiche F32360.

| Type | Durée proposée | Reconduction | Préavis du propriétaire | Préavis du locataire | Dépôt maximal (mois de loyer HC) |
|---|---|---|---|---|---|
| `vide` | 36 mois, 72 si `ownership = "sci"` | oui | 6 mois | 3 mois | 1 |
| `meuble` | 12 | oui | 3 mois | 1 mois | 2 |
| `etudiant` | 9 | non | — | 1 mois | 2 |
| `mobilite` | 10 | non | — | 1 mois | 0 |
| `autre` | 12 | non | — | 3 mois | pas de plafond |

`leaseDurationNote` avertit sans bloquer : vide plus court que la durée légale, meublé de moins de 12 mois, étudiant de moins de 9 mois, mobilité de plus de 10 mois.

### Fin et état d'un bail

- `termEnd(n)` = début + n × durée − 1 jour. Un bail non reconductible n'a qu'une période.
- `leaseEnd` : `actualEnd` s'il est saisi ; congé du locataire : `noticeDate + noticeMonths` (ou le préavis habituel), plafonné à la fin de la première période pour un bail non reconductible ; congé du propriétaire (baux reconductibles) : fin de la première période dont la date limite (`termEnd − préavis du propriétaire`) n'est pas dépassée à la réception ; sinon `null` (reconduction) ou la fin de la première période. `addMonths` ramène au dernier jour du mois quand le quantième n'existe pas.
- `leaseState` : `a_venir` avant le début, `termine` après la fin, `conge` dès qu'un congé est saisi, `en_cours` sinon. `nextDeadline` (dernier jour pour donner congé) n'existe que si la fin est inconnue. `noticeTooLateFor` signale la période manquée par un congé du propriétaire tardif. Loyer et charges : ceux en vigueur au mois de référence.
- `currentLease` : en cours ou congé, sinon le prochain à venir, sinon le dernier.
- `leaseRentAt` : le dernier `lease_rents` dont `from_month ≤ mois`, sinon le loyer du bail.

### Validation d'un bail (`validateLease`, partagée par le formulaire et le backend)

Dans l'ordre : date de début valide, durée ≥ 1, congé et date ensemble, congé et départ réel pas avant le début. Puis, pour chaque autre bail du bien qui « gêne » (même lot, ou logement entier contre chambre ; sans lot connu, tous les baux gênent) : refus si les périodes se chevauchent, une fin inconnue valant « sans fin ». Deux messages : même logement, ou logement entier et chambre.

### Mois de loyer pointés (`rentMonths`) : le suivi strict

Pour chaque mois du début du bail jusqu'au mois de la fin ou au mois de `asOf` (le plus proche) :

```
fraction        = jours occupés dans le mois ÷ jours du mois     (premier et dernier mois au prorata)
expectedRent    = loyer en vigueur × fraction ; expectedCharges idem
due             = 0 si le mois est remis, sinon expectedRent + expectedCharges
paid            = somme des paiements du mois (trop-perçu compris)
receivedRent    = min(paid, due) × expectedRent ÷ due ; receivedCharges = min(paid, due) − receivedRent
outstanding     = max(0, due − paid)
dueDate         = AAAA-MM-jj avec jj = min(dueDay, dernier jour du mois)
```

État (`RentStatus`) : `remis` si remise ; `recu` si `outstanding = 0` ; `a_venir` si `dueDate > asOf` ; `attendu` jusqu'à `RENT_GRACE_DAYS` (10) jours après l'échéance ; puis `partiel` si quelque chose est reçu, `non_recu` sinon. `rentIsLate` = `partiel` ou `non_recu`. Les montants sont ceux du bail, donc du lot ou du bien entier.

- `settlingPayment` : le reste dû, daté de l'échéance si elle est passée, sinon du jour ; méthode `virement` ; `null` si rien n'est dû.
- `leaseBalance` : dû des mois échus moins tous les paiements datés jusqu'à `asOf` (négatif si payé d'avance). N'est utilisée par aucun écran.
- `depositRetained` = `max(0, dépôt − dépôt rendu)` une fois rendu ; compté comme recette à `depositReturnedOn` dans `propertyYears`.
- `rentReceipt` (art. 21 de la loi du 6 juillet 1989, cité dans le code) : `quittance` si tout est reçu, `recu` (paiement partiel) sinon, `null` si rien n'est reçu.

### Vue du parc (`rentalPark.ts`)

- `parkProperties` : biens `locatif` non archivés (une vente archive le bien).
- `parkMonth(month)` : calcule chaque bail jusqu'à la fin du mois (ou aujourd'hui pour le mois en cours) ; garde les lignes avec `due > 0` ou une remise. `expected = Σ due`, `received = Σ (receivedRent + receivedCharges)` (sans trop-perçu), `late` et `pending` : reste dû en retard ou pas encore. Le nom du lot n'est affiché que si le bien a plusieurs lots.
- `parkDebts` : par bail, les mois en retard et leur reste dû, triés du plus gros montant au plus petit.
- `lotPotentialRent` : `targetRent` s'il est > 0, sinon le loyer du dernier bail du lot à sa fin (ou à son début s'il n'est pas fini).
- `parkVacancies` : lots actifs sans bail en cours ; un lot jamais loué sans loyer possible est ignoré ; `since` = lendemain de la fin du dernier bail ; `lost = loyer possible × 12 × jours ÷ 365` ; `nextStart` = début du prochain bail.
- `relocationGaps` : pour chaque lot, jours entre le lendemain de la fin d'un bail et le début du suivant (0 au minimum).
- `parkPropertyRows(year)` : `lots = max(lots actifs, 1 si un bail court)`, `rentedLots` = lots distincts des baux en cours, `monthlyRent` = loyers hors charges des baux en cours, occupation de l'année, rendements et `monthlyRemaining` de `propertyProfitability` (année de référence indépendante de `year`), relocation moyenne arrondie au jour.

### Fenêtres de location et occupation

`lotWindows` (dans `rental.ts`) donne, pour chaque lot du bien (et un groupe « sans lot » pour d'anciens baux) :

- `from` : début du premier bail commencé ; pour un lot actif jamais loué mais avec un loyer espéré, début du premier bail du bien ; sinon le lot est ignoré ;
- `to` : le dernier jour compté (fin du mois en cours, ou date de vente) ; pour un lot inactif, la fin de son dernier bail ;
- `weight` : loyer espéré, sinon dernier loyer du lot, sinon 1.

Deux mesures en découlent :

| Mesure | Où | Formule |
|---|---|---|
| Occupation pondérée | `propertyYears` (fiche du bien, Résultats par année) | `Σ weight × jours occupés ÷ Σ weight × jours proposés`, sur la période de location de l'année. |
| Occupation physique | `propertyOccupancy`, `parkOccupancy` (tableau Biens de la Gestion locative) | `Σ jours occupés ÷ Σ jours proposés`, sans pondération. |
| Occupation financière (« Loyers reçus ») | idem | `Σ receivedRent ÷ (Σ expectedRent + Σ jours vides × weight × 12 ÷ 365)`. |

Jours occupés d'un mois = `fraction × jours du mois`. Un mois remis reste occupé. Les trois rapports sont plafonnés à 1, et `null` si le dénominateur est nul.

### Relances (`rentNotices.ts`)

Le commentaire du module cite la loi n° 89-462 du 6 juillet 1989, art. 24 (commandement de payer par un commissaire de justice, à signifier à la caution dans les quinze jours) et le code de la construction et de l'habitation pour le signalement à la CAF (« article et délai non relevés »). Ces obligations sont affichées dans l'interface sans être vérifiées.

- `leaseArrears` : mois en retard (`rentIsLate`), total, `since` = échéance du plus ancien, `daysLate` depuis cette date ; `null` si le bail est à jour.
- `noticeStep` : `mise_en_demeure` si `daysLate ≥ rentFormalNoticeDays`, sinon `relance` si `≥ rentRelanceDays`, sinon `rappel` si `≥ rentReminderDays`, sinon `null`. `sent` = relances du bail envoyées depuis `since` ; `done` si l'une est au moins aussi ferme que l'étape.
- `PlanParams` refuse des délais qui ne se suivent pas (rappel ≤ relance ≤ mise en demeure).
- `ArrearsPanel` prépare le courrier de l'étape (ou du rappel si le retard est trop récent) et note l'envoi avec la somme due du jour. Rappel « caution » si le bail a une garantie `caution` ; rappel « CAF » si un paiement du bail a le moyen `caf`.

### Révision annuelle (`irl.ts`)

Sources citées : loi n° 89-462 du 6 juillet 1989, art. 17-1 (I et III), 25-9 (meublé) et 25-16 (bail mobilité), sur legifrance.gouv.fr ; formule et arrondi : service-public.gouv.fr, fiche F13723 ; consultés le 09/11/2026.

- `irlZone` : code postal commençant par `20` → Corse ; `971`, `972`, `973`, `974`, `976` → outre-mer ; sinon métropole.
- `leaseIrlQuarter` : `irlQuarter` du bail, sinon le trimestre du dernier indice publié (`published ≤ startDate`), sinon d'après la date de parution attendue (20 avril, 20 juillet, 20 octobre, 20 janvier de l'année suivante), 3e trimestre par défaut.
- `leaseCanBeRevised` : clause cochée et bail `vide` ou `meuble`.
- `pendingRevisionAnniversary` : le dernier anniversaire atteint au plus tard dans 45 jours, tant qu'il n'est pas passé de plus de 365 jours et qu'aucun loyer n'a été saisi à partir de deux mois avant cet anniversaire.
- `proposeRevision` : `null` sans anniversaire en attente ou avec une note F/G. Trimestre du nouvel indice : celui du bail, de l'année la plus récente dont l'indice était paru à l'anniversaire (date attendue ou date réelle) ; ancien indice : même trimestre, un an plus tôt. Loyer de base : celui en vigueur au mois de l'anniversaire. `newRent = null` tant qu'un indice manque.
- `revisedRent = arrondi au centime (loyer × indexNew ÷ indexOld)`.
- `revisionEffectiveDate = max(anniversaire, date de la demande)` ; `revisionStillPossible` : demande au plus tard 12 mois après l'anniversaire.
- Le formulaire et le backend refusent un loyer supérieur au calcul ; un loyer inférieur est accepté.

Rappels de révision : la carte du bail utilise `pendingRevisionAnniversary` (de 45 jours avant à un an après) ; l'alerte du tableau de bord utilise `leaseRevisionDue` (30 jours avant ou après l'anniversaire) ; l'échéancier affiche le prochain anniversaire.

**Données de l'indice.** `fetchIrl` lit les séries de la Banque de données macroéconomiques de l'INSEE (`https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/<id>`, séries `001515333` métropole, `010760507` Corse, `010760509` outre-mer) et garde trimestre, valeur et date de parution au Journal officiel (`DATE_JO`). `SharedMarket.irl()` les garde dans `marche.config` (clé `irl`) pour toute l'instance, relues au plus une fois par 24 heures ; après un échec, pas de nouvel essai avant 15 minutes, et les valeurs connues servent. Une zone en échec garde ses anciennes valeurs. Côté interface, `LeaseCard` n'appelle `market.irl` que si une révision est à faire, avec un cache d'une heure.

### Échéancier (`parkSchedule`)

Dates des 365 prochains jours, triées. Les dates passées sont écartées, sauf les dépôts à rendre et les rappels ponctuels non faits, marqués `late`.

| Type | Date |
|---|---|
| `depot` | Bail terminé avec dépôt non rendu : fin + 2 mois. |
| `fin_bail` | Fin connue d'un bail non terminé. |
| `conge` | `nextDeadline`. |
| `assurance` | `tenantInsuranceUntil`. |
| `revision` | Prochain anniversaire, si le bail est révisable, la note n'est pas F/G et l'anniversaire tombe avant la fin. |
| `garantie` | `until` de chaque garantie. |
| `document` | `expiresOn` des documents du bien. |
| `dpe` | `dpeExpiry(dpeDate)`. |
| `depense` | Prochaine occurrence d'une dépense annuelle, jusqu'à `untilYear`. |
| `rappel` | Prochaine occurrence d'un rappel annuel ; date d'un rappel ponctuel non fait. |

Le réglage `reminders` du bail n'est pas consulté ici.

### Alertes (`leaseAlerts`)

Pour chaque bien `locatif` non archivé, par lot (lots actifs ou ayant des baux, plus un groupe pour les baux sans lot connu ; le nom du lot n'apparaît que s'il y a plusieurs groupes) :

- par bail, loyers en retard : « attention », avec l'étape de relance conseillée si elle n'est pas faite ; **toujours**, même rappels désactivés ;
- dépôt à rendre (bail terminé, rappels actifs, dépôt > 0 non rendu) : « attention » ;
- puis, si le bail mis en avant a ses rappels actifs : lot sans bail (« information », seulement si le lot est actif), attestation d'assurance et garanties dans les 30 jours, révision (`leaseRevisionDue`, bail en cours, note autre que F/G), fin de bail dans les 60 jours (« information » après un congé, « attention » pour un bail qui ne se reconduit pas), date limite de congé dans les 60 jours (« attention »).

Les liens mènent à `/immobilier/<id>`, avec `?onglet=location` pour les loyers, garanties et révisions.

### Courriers

| Page | Route | Contenu et règles |
|---|---|---|
| `Quittance` | `/impression/quittance/:leaseId/:month` | `rentReceipt` : quittance ou reçu de paiement partiel, loyer et charges distingués ; message si rien n'est reçu. |
| `AvisEcheance` | `/impression/avis/:leaseId/:month` | Calculé jusqu'au 28 du mois s'il est à venir ; loyer, provision, remise, déjà reçu, reste des mois précédents, total à l'échéance. |
| `Relance` | `/impression/relance/:leaseId/:level` | Niveau inconnu → `rappel`. Texte selon le niveau ; mise en demeure : « lettre recommandée avec accusé de réception », huit jours, commandement de payer, copie à la caution s'il y en a une. Décompte des mois en retard. |
| `AttestationLoyer` | `/impression/attestation/:leaseId` | Locataire actuel ou passé, loyer et charges en vigueur, à jour ou montant dû. |
| `CourrierRevision` | `/impression/revision/:rentId` | Seulement pour un loyer issu d'une révision ; cite l'art. 17-1 ; zone de l'indice relue d'après le code postal actuel du bien. |

`leasePlace` : adresse du bien, sinon son nom, suivie du lot entre parenthèses si le bien en a plusieurs. `leaseAddressee` : les locataires du bail, sinon « Le locataire ». La quittance et le courrier de révision construisent l'adresse eux-mêmes, sans le lot.

### Reprise des anciennes données

- Avant les lots (migration `0022`, `upgradeLegacyDump` pour les sauvegardes) : un lot « Logement » par bien loué, mode déduit du dernier bail, un locataire par nom distinct (`leases.tenant`), une caution par garant (`leases.guarantor`).
- Avant le suivi strict (migrations `0025` et `0026`, `upgradeLegacyRentExceptions`) : « montant différent » devient un paiement de ce montant plus les charges du mois (méthode `autre`, daté du 1er), « mois vide » devient une remise, « impayé » ne crée rien. Les mois sans signalement deviennent des loyers à pointer.

## Tests

| Fichier | Ce qu'il couvre |
|---|---|
| `packages/core/src/realestate/leases.test.ts` | Règles légales, échéances et congés, loyer en vigueur, validation, bail mis en avant, rappels, loyers pointés, dépôt, révision, quittances, documents et assurance. |
| `packages/core/src/realestate/lots.test.ts` | Modes de location, baux de plusieurs lots, occupation pondérée, locataires, état d'un lot, alertes lot par lot. |
| `packages/core/src/realestate/rentalPark.test.ts` | Loyers du mois, dettes, lots vides, relocation, occupation physique et financière, lignes par bien, échéancier. |
| `packages/core/src/realestate/rentNotices.test.ts` | Arriérés, étapes de relance, étape faite, alerte, délais par défaut. |
| `packages/core/src/realestate/irl.test.ts` | Zone, trimestre, révision à faire, date d'effet, calcul, Corse, indice manquant, note F/G. |
| `packages/core/src/realestate/rental.test.ts` | Résultats par année : vacance, mois remis, loyer non reçu. |
| `packages/core/src/realestate/energy.test.ts` | DPE (gel du loyer, alertes). |
| `packages/backend/src/handlers/realestate/leases.test.ts` | Baux, loyers, paiements, « Valider le mois », relances, remises, dépenses, rappels, sortie du locataire, recettes, révision, sauvegardes. |
| `packages/backend/src/handlers/realestate/lots.test.ts` | Lots, colocation par chambre, type de bail selon le mode, locataires et garanties, reprise des anciennes données (migrations et sauvegardes). |
| `packages/backend/src/market/sources/irl.test.ts` | Lecture SDMX, observation invalide, zone en échec. |
| `packages/backend/src/market/live.test.ts` | Appel réel de l'INSEE (avec `HAMAC_LIVE=1`). |
| `packages/ui/src/features/realestate/gestion-locative.flow.test.tsx` | Page Gestion locative : sans bien, loyers, impayés, lots vides, échéancier, relances, courriers. |
| `packages/ui/src/flows/placements.flow.test.tsx` (« Bien : bail, loyers et quittances », « Bien : lots et colocation par chambre ») | Onglet Location. |
| `packages/ui/src/flows/flows.test.tsx` | Nouveau bail, révision et courrier, pointage d'un loyer, impression d'une quittance. |

## Limites connues

- Tranches non faites de la proposition : régularisation des charges, locations saisonnières, états des lieux et relocation encadrée, interventions et prestataires, import CSV d'un relevé bancaire, part de chaque colocataire sur un bail unique. La fiscalité locative est hors de ce chantier.
- Deux définitions de l'occupation coexistent : pondérée par le loyer dans `propertyYears` (fiche du bien), non pondérée dans `propertyOccupancy` et `parkOccupancy` (tableau Biens). La proposition demandait une occupation pondérée ; c'est l'occupation financière qui en tient lieu dans le tableau.
- Le tableau Biens titre la colonne « Rendement net » ; ailleurs, la même valeur s'appelle « Rendement après charges ».
- Les rappels CAF et caution, et les délais de l'art. 24, ne sont pas vérifiés dans les textes (le code le dit).
- La règle « dépôt à rendre » de l'échéancier retient deux mois dans tous les cas ; elle ne connaît pas l'état des lieux.
- Un trop-perçu reste sur son mois ; seul `leaseBalance`, non affiché, en tient compte.
- `parkSchedule` ignore `lease.reminders`, contrairement à `leaseAlerts`.
- Aucun écran n'utilise `renters.upsert` ni `renters.delete` ; un locataire retiré de tous ses baux reste en base et dans la liste « Reprendre un locataire ».
- Les champs `leases.comment`, `renters.comment` et `lease_guarantees.comment` existent mais ne sont pas saisissables dans le formulaire du bail.
- `LeaseInput.rent` accepte 0 alors que le formulaire exige un loyer positif.
- Les dates de parution attendues de l'IRL sont fixées au 20 du mois ; le commentaire de `expectedPublication` parle d'une parution « vers le 15 ».
