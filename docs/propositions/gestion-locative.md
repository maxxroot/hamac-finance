# Gestion locative : remplacer le travail d'une agence

Document de travail ouvert le 12 novembre 2026. L'objectif est que le module Immobilier suive tout le parc, et chaque bien, comme le ferait une agence de gestion : baux, locataires, encaissements, impayés, révisions, charges, vacance, locations saisonnières, entrées et sorties, interventions. La seule chose exclue est la synchronisation bancaire : les paiements sont pointés à la main ou importés d'un fichier.

Comme pour les propositions « gestion de patrimoine », chaque tranche indique ce qui existe, ce qu'il faut ajouter et les questions encore ouvertes. Les règles légales et les montants cités sont **à vérifier sur la source officielle au moment du développement** (loi, décret, BOFiP, service-public.gouv.fr, anil.org), avec la source citée dans `@hamac/core`, la date de vérification et des tests chiffrés.

## Décisions prises le 12 novembre 2026

| Sujet | Décision |
|-------|----------|
| Structure | Une table `lots` entre le bien et les baux. Un bien contient un ou plusieurs lots (logement entier, chambre, parking…), chaque bail porte sur un lot, et plusieurs baux peuvent courir en même temps sur des lots différents. Les biens existants reçoivent un lot unique, sans rien demander à l'utilisateur. |
| Encaissements | Suivi strict partout : un loyer n'est plus considéré comme reçu tant qu'il n'a pas été pointé. Le bouton « Valider le mois » marque d'un coup les loyers du mois comme reçus, et chaque loyer peut aussi être pointé seul. Tout ce qui n'est pas validé sur un mois est signalé, pour ne jamais laisser passer un mois sans le voir. Tolérance de 10 jours après l'échéance avant « en retard », faute de rapprochement bancaire automatique. |
| Mode de location | Le bien déclare comment il est loué : location vide, location meublée ou colocation (un bail pour tous, ou un bail par chambre). Ce mode décide des lots proposés et des baux possibles. |
| Garants | Prévus dès la tranche 1, avec leur type (caution d'une personne, Visale, garantie loyers impayés, caution bancaire). |
| Occupation | Pondérée par le loyer, pour qu'un parking vide ne pèse pas autant qu'un appartement vide. |
| Fichiers | Pas de stockage des fichiers pour l'instant : le registre des documents garde seulement leur emplacement. |
| Saisonnier | Saisie à la main et import d'un fichier CSV (Airbnb, Booking…). |
| Fiscalité locative | Importante, mais pour le chantier suivant (revenus fonciers, location meublée, amortissements). |
| Ordre | 1 → 2 → 3, puis 4 à 7 ; le saisonnier (5) peut passer avant 4 si besoin. |

## Ce qui existe déjà

Au 12 novembre 2026, branche `patrimoine` :

- **Le bien** (`properties`) : type, détention, part détenue, démembrement, SCI, adresse, surface, pièces, DPE et GES, achat et frais, vente, estimations successives (`property_values`).
- **Les baux** (`leases`, `core/src/leases.ts`) : vide, meublé, meublé étudiant de 9 mois, bail mobilité, autre. Durée légale proposée, plafond du dépôt de garantie, reconduction tacite, congé du locataire ou du propriétaire avec les préavis, date limite de congé du propriétaire, départ réel, restitution du dépôt avec retenue, garant (texte libre), fin de l'assurance du locataire. **Un seul bail à la fois par bien** : `validateLease` refuse deux baux qui se chevauchent.
- **Les loyers** : loyer et charges du bail, nouveaux loyers datés (`lease_rents`). Un loyer est **réputé perçu** sauf signalement (`rent_exceptions` : impayé, mois vide, montant différent). Quittance ou reçu de paiement partiel par mois (page `Quittance`).
- **La révision annuelle** (`core/src/irl.ts`) : indice de référence des loyers de l'INSEE récupéré par l'instance, trimestre du bail, date d'effet selon la date de la demande, délai d'un an, gel des logements classés F et G, courrier au locataire (page `CourrierRevision`).
- **Les dépenses et recettes du bien** (`property_expenses`, `property_incomes`, `core/src/rental.ts`) : catégories, dépenses répétées chaque année, travaux d'amélioration ajoutés au coût, régularisations de charges reçues ou rendues, indemnités, dépôt gardé.
- **Les résultats par année** (`propertyYears`) : loyers, charges, autres recettes, dépenses, coût du crédit, reste, rendement brut et net, taux d'occupation.
- **Le registre des documents** (`property_documents`) avec date d'expiration.
- **Les alertes** (`core/src/alerts.ts`) : impayés, dépôt à rendre, bien sans bail, assurance du locataire, révision à faire, fin de bail, date limite de congé, DPE expiré ou location bientôt interdite, documents qui expirent.
- **La fiche imprimable** d'un bien (`ImpressionBien`).

---

## 1. Lots, colocation et locataires

**Statut :** fait le 12 novembre 2026 (branche `gestion-locative`). Calculs dans `core/src/lots.ts` et `core/src/renters.ts` ; tables `lots`, `renters`, `lease_renters`, `lease_guarantees` et colonne `properties.rental_mode` (migrations 0022 et 0023, la seconde retire `leases.tenant` et `leases.guarantor`) ; reprise des anciennes sauvegardes dans `backend/src/dumpUpgrade.ts`. Écrans : mode de location dans le formulaire du bien, carte « Lots » et une carte de bail par lot dans l'onglet Location, locataires et garanties dans le formulaire du bail. Décisions prises en codant : une ligne de locataire laissée vide est ignorée, une ligne commencée sans nom bloque l'enregistrement ; un lot loué ne se supprime pas (il s'archive) et garde sa nature ; un bail existant garde son type si le mode de location change ensuite ; un lot qui ne correspond plus au mode ou qui est archivé s'arrête, pour l'occupation, à la fin de son dernier bail et ne déclenche plus l'alerte « aucun bail en cours » ; alerte quand une garantie à durée limitée arrive à son terme. Non fait : le jeu de démonstration n'a pas de colocation (cela changerait les chiffres attendus par les tests du tableau de bord) ; la quittance d'une colocation reste au nom de tous les colocataires.

**Pourquoi.** Tant qu'un bien ne peut avoir qu'un bail à la fois, on ne peut gérer ni une colocation à baux individuels, ni la location chambre par chambre (fréquente en location étudiante), ni un immeuble de rapport, ni un parking loué à part. Le lot est l'unité qu'on loue ; le bien reste ce qu'on possède (valeur, crédit, achat, fiscalité).

**Ce qu'il faut ajouter :**

- **Table `lots`** : bien, nom (« Appartement », « Chambre 2 », « Parking 14 »), nature (logement entier, chambre, parking ou box, cave, local, autre), surface facultative, loyer espéré facultatif (sert à chiffrer la vacance, voir tranche 2), commentaire, archivé, ordre d'affichage.
- **`leases.lot_id`** : chaque bail porte sur un lot. Le contrôle des chevauchements se fait **par lot** et non plus par bien.
- **Migration des données** : un lot « Logement » créé pour chaque bien qui a déjà un bail ou qui est en location, et tous ses baux rattachés à ce lot. Rien ne change à l'écran pour un bien à lot unique : le choix du lot n'apparaît que s'il y en a plusieurs.
- **Colocation** :
  - *bail unique* : un seul bail sur le logement entier, avec plusieurs locataires et une clause de solidarité facultative ;
  - *baux individuels* : un lot par chambre, un bail par lot.

  Le formulaire du bail propose les deux cas sans jargon : « Un bail pour tous les colocataires » ou « Un bail par chambre ».
- **Locataires** (table `renters`, pour ne pas confondre avec les tenants de l'instance) : prénom, nom, e-mail, téléphone, adresse après le départ (utile pour rendre le dépôt), commentaire. Un locataire peut avoir plusieurs baux successifs. Lien bail ↔ locataires dans une table `lease_renters` (rôle : titulaire ou colocataire).
- **Garanties** (table `lease_guarantees`) : type (personne qui se porte caution, Visale, garantie loyers impayés, caution bancaire, autre), nom, coordonnées, montant ou durée de l'engagement, dates. Elles remplacent le champ texte `leases.guarantor`.
- **Reprise des anciens champs** : `leases.tenant` devient un locataire, `leases.guarantor` devient une garantie de type « caution ». Les deux colonnes sont supprimées une fois reprises.
- **Calculs** : `propertyYears` additionne tous les lots ; le taux d'occupation devient la part des jours-lots occupés, pondérée par le loyer espéré quand il est saisi (sinon par le dernier loyer du lot). Les alertes d'un bail citent le lot quand le bien en a plusieurs (« Rue des Lilas, chambre 2 : … »).
- **Écrans** : onglet Location de la fiche du bien organisé par lot (bail en cours, locataires, loyers) ; liste des locataires du bien ; quittance et courrier de révision au nom de chaque locataire du bail.

**Données personnelles.** Les locataires sont des tiers : on ne demande que ce qui sert à la gestion (pas de date de naissance, pas de pièces d'identité). L'instance est auto-hébergée et chaque tenant reste isolé ; la sauvegarde (`dump.ts`) contient ces données, à signaler dans la notice.

**Technique.** Nouvelles tables `lots`, `renters`, `lease_renters`, `lease_guarantees` : mappeurs et `loadWorkspace` dans `repo.ts`, type `Workspace`, `normalizeWorkspace`, liste `TABLES` de `dump.ts` dans l'ordre des clés étrangères (`lots` après `properties`, `renters` avant `leases`, `lease_renters` et `lease_guarantees` après), jeu fictif `demo.ts` avec un bien à deux chambres.

**Mode de location du bien** (décidé le 12 novembre 2026) : le bien déclare comment il est loué, et ce choix décide de ce qui est proposé :

| Mode | Lots | Baux |
|------|------|------|
| Location vide | un logement entier, plus des annexes (parking, cave) | un bail vide sur le logement |
| Location meublée | idem | un bail meublé, étudiant ou mobilité |
| Colocation, un bail pour tous | un logement entier | un bail avec plusieurs locataires |
| Colocation, un bail par chambre | une chambre par lot, plus des annexes | un bail par chambre |

Le mode peut changer dans le temps (une location entière qui devient une colocation par chambres) : les anciens baux gardent leur lot. Un bail sur le logement entier ne peut pas chevaucher un bail sur une chambre du même bien. La location saisonnière s'ajoutera comme cinquième mode à la tranche 5.

**Question ouverte :** les dépenses restent au niveau du bien ; leur répartition entre les lots arrive avec les charges (tranche 4).

---

## 2. Vue du parc

**Statut :** fait le 12 novembre 2026 (branche `gestion-locative`). Page « Gestion locative » (`/gestion-locative`, module Immobilier, juste après Immobilier dans le menu), calculs dans `core/src/rentalPark.ts`, table `property_reminders` (migration 0024). Décisions prises en codant : les montants sont ceux du bien entier (la part détenue ne s'applique qu'aux rendements) ; un parking ou une cave jamais loués ne comptent comme vides que s'ils ont un loyer espéré ; les loyers perdus d'un lot vide se comptent au loyer espéré, sinon au dernier loyer ; l'occupation physique compte les jours loués sur les jours proposés, l'occupation financière les loyers reçus sur les loyers possibles (lots loués au loyer du bail, lots vides au loyer possible) ; le dépôt à rendre apparaît deux mois après le départ (délai le plus long), en retard ensuite ; un rappel ponctuel se marque « Fait », un rappel annuel revient chaque année. En attendant la tranche 3, « reçu » et « impayé » viennent encore des signalements.

**Pourquoi.** Une agence regarde d'abord le parc entier : ce qui est encaissé ce mois-ci, ce qui manque, ce qui est vide, ce qui arrive à échéance.

**Ce qu'il faut ajouter :** une page « Gestion locative » (module Immobilier), avec :

- **Ce mois-ci** : loyers attendus, reçus, en attente, en retard, pour tout le parc, et la liste par lot.
- **Impayés** : montant dû par bail, ancienneté de la dette, prochaine étape de relance (tranche 3).
- **Vacance** : lots vides, depuis quand, loyers perdus depuis le départ (d'après le loyer espéré ou le dernier loyer), durée moyenne de relocation par bien.
- **Occupation** : taux d'occupation physique (jours loués) et financier (loyers reçus ÷ loyers possibles) par bien, par lot et pour le parc, sur l'année en cours et les précédentes.
- **Échéancier commun** : toutes les dates à venir, triées : révisions de loyer, fins de bail, dates limites de congé, dépôts à rendre, assurances des locataires, diagnostics et documents qui expirent, dépenses annuelles prévues (taxe foncière…), et des rappels saisis à la main (assemblée générale de copropriété, entretien de la chaudière…).
- **Tableau des biens** : loyer mensuel en cours, rendement brut et net, reste après crédit, occupation, alertes, avec tri.

**Technique.** Calculs purs dans un nouveau `core/src/rentalPark.ts`, à partir des données déjà chargées. Les rappels saisis à la main demandent une petite table (`property_reminders` : bien, lot facultatif, date, répétition annuelle, libellé).

---

## 3. Encaissements

**Statut :** à faire, après la tranche 2.

**Pourquoi.** Remplacer « réputé perçu » par un vrai suivi des paiements : c'est ce qui permet de savoir qui doit quoi, de relancer à temps et de délivrer des quittances justes.

**Ce qu'il faut ajouter :**

- **Échéance du bail** : jour du mois où le loyer est dû (le 1er par défaut, modifiable), loyer payable d'avance ou à la fin du mois.
- **Paiements** (table `rent_payments`) : bail, mois concerné, date de réception, montant, moyen (virement, prélèvement, chèque, espèces, aide au logement versée par la CAF, garant, autre), commentaire. Un mois peut recevoir plusieurs paiements (paiement en deux fois, aide au logement versée à part). Un paiement en trop reste au crédit du locataire et s'impute sur le mois suivant.
- **État de chaque mois** : à venir, en attente (jusqu'à 10 jours après l'échéance), reçu, reçu en partie, en retard. Le solde du locataire (dû moins reçu) s'affiche sur le bail.
- **Pointage** :
  - par loyer : boutons « Reçu » (montant attendu, à la date du jour, modifiable) et « Autre montant… » ;
  - groupé : un bouton « Valider le mois » sur la liste du mois, qui affiche d'abord la liste des loyers concernés et leur total, puis les marque reçus au montant attendu.
- **Rien ne passe inaperçu** : chaque loyer non validé d'un mois échu est signalé, sur la fiche du bail, dans la vue du parc et dans les alertes (une alerte par bail, avec le nombre de mois et le total en attente).
- **Ce que deviennent les signalements actuels** (décidé le 12 novembre 2026) : rien n'est repris comme reçu automatiquement. Les mois passés sans signalement deviennent des loyers « à valider », signalés comme les autres ; « Valider le mois » permet de les rattraper mois par mois. « Impayé » ne crée aucun paiement et reste dû. « Montant différent » crée un paiement de ce montant. « Mois vide » devient une **remise de loyer** (mois offert ou franchise après travaux), qui reste une notion à part : un mois remis n'est pas dû. La table `rent_exceptions` est remplacée par `rent_payments` et une table des remises.
- **Documents** : avis d'échéance (appel de loyer) du mois, quittance (paiement complet) ou reçu (paiement partiel, art. 21 de la loi du 6 juillet 1989, à vérifier), attestation de loyer à jour, décompte des sommes dues.
- **Relances** : rappel amiable, relance, mise en demeure, à des délais réglables après l'échéance (par défaut 10, 20 et 30 jours), chacune avec son courrier prêt à imprimer et la date d'envoi notée. Rappels liés : prévenir le garant, et la CAF quand l'aide au logement est versée au propriétaire. Les obligations légales et leurs délais (information de la caution, signalement à la CAF, commandement de payer par un commissaire de justice) sont **à vérifier** (loi du 6 juillet 1989, art. 24 ; code de la construction et de l'habitation pour les aides au logement).
- **Import CSV des paiements** (facultatif dans cette tranche) : réutiliser `core/src/csv.ts` et le principe de `statementImport.ts` pour rapprocher les lignes d'un relevé bancaire exporté des loyers attendus (montant et nom du locataire). Ce n'est pas une synchronisation bancaire : le fichier est déposé à la main.

**Questions ouvertes :**

- Pour une colocation à bail unique : un paiement par colocataire (avec sa part du loyer) ou un paiement global ? Proposition : part de chaque colocataire facultative sur le bail ; sans part, paiement global.

---

## 4. Charges

**Statut :** à faire.

**Pourquoi.** La régularisation annuelle des charges est l'une des tâches les plus pénibles d'une agence, et l'une des plus souvent faites de travers.

**Ce qu'il faut ajouter :**

- **Mode de charges du bail** : provisions avec régularisation annuelle, ou forfait sans régularisation (possible en meublé et en colocation à baux individuels ; loi du 6 juillet 1989, art. 25-10 et 8-1, à vérifier).
- **Part récupérable des dépenses** : sur chaque dépense du bien, la part qui peut être demandée au locataire, d'après la liste des charges récupérables (décret n° 87-713 du 26 août 1987, à vérifier). Exemples : la taxe d'enlèvement des ordures ménagères comprise dans la taxe foncière ; la part récupérable du décompte annuel du syndic de copropriété.
- **Répartition entre les lots** : à parts égales, à la surface, ou selon des tantièmes saisis.
- **Calcul de la régularisation** : charges récupérables de la période, au prorata de la durée d'occupation de chaque bail, moins les provisions reçues (tranche 3). On obtient le montant à demander ou à rendre, avec un courrier détaillé par poste. Le montant, une fois réglé, est enregistré comme recette (la catégorie de régularisation existe déjà).
- **Ajustement des provisions** proposé d'après le réel de l'année.
- Rappels : date de la régularisation annuelle, et justificatifs à tenir à la disposition du locataire pendant un délai légal, à vérifier.

---

## 5. Locations saisonnières

**Statut :** à faire.

**Pourquoi.** La location saisonnière fonctionne par séjours de quelques nuits, avec des plateformes, des commissions et des règles propres. Elle se combine souvent avec la location étudiante : un bail étudiant de 9 mois, puis des séjours l'été.

**Ce qu'il faut ajouter :**

- **Séjours** (table `stays`) sur un lot : voyageur, canal (Airbnb, Booking, Abritel, en direct, autre), code de réservation, arrivée, départ, nombre de voyageurs, montant payé par le voyageur, ménage, commission de la plateforme, taxe de séjour (et qui la reverse : la plateforme ou le propriétaire), montant versé et date du versement, statut (confirmé, annulé avec ou sans frais), commentaire.
- **Périodes bloquées** : séjours personnels, travaux, indisponibilité. Elles comptent à part dans le taux d'occupation.
- **Un même lot** peut alterner baux et séjours ; le contrôle des chevauchements couvre les deux.
- **Calendrier** par lot et pour le parc, mois par mois.
- **Indicateurs** : nuits louées, taux d'occupation (nuits louées ÷ nuits disponibles), prix moyen par nuit, revenu par nuit disponible, revenu net après commissions et ménage, par canal et par saison.
- **Règles à suivre et à vérifier** :
  - plafond de nuits par an pour une résidence principale louée en meublé de tourisme (120 nuits, que la commune peut abaisser à 90 depuis la loi n° 2024-1039 du 19 novembre 2024, dite loi Le Meur) ;
  - numéro d'enregistrement du meublé de tourisme et déclaration en mairie ;
  - exigences de DPE propres aux meublés de tourisme introduites par la même loi ;
  - taxe de séjour.

  Les effets fiscaux (micro-BIC, meublé classé ou non) sont pour le chantier fiscal.
- **Import CSV** : exports de réservations d'Airbnb et de Booking, colonnes reconnues automatiquement quand le format est connu, sinon choix des colonnes à la main ; aperçu avant import ; un séjour déjà importé (même canal et même code) est mis à jour, pas dupliqué. Des fichiers d'exemple fictifs servent aux tests. Les formats exacts sont à relever sur des exports réels au moment du développement.

---

## 6. Entrée, sortie et relocation

**Statut :** à faire.

**Ce qu'il faut ajouter :**

- **États des lieux d'entrée et de sortie** : pièces, éléments, état (neuf, bon, usé, dégradé), commentaire, relevés des compteurs, clés remises. Comparaison automatique entre l'entrée et la sortie, qui fait ressortir ce qui s'est dégradé. Pas de photos tant que les fichiers ne sont pas stockés.
- **Inventaire du meublé** d'après la liste minimale du décret n° 2015-981 du 31 juillet 2015 (à vérifier), proposé à cocher.
- **Restitution du dépôt** : retenues justifiées ligne par ligne (dégradation, loyers ou charges dus, régularisation à venir), délai d'un ou deux mois selon l'état des lieux, majoration due en cas de retard (loi du 6 juillet 1989, art. 22, à vérifier), courrier de restitution.
- **Relocation** : suivi de la vacance du lot, loyer proposé pour le prochain bail avec ses limites :
  - en zone tendue, hausse limitée par rapport au loyer du locataire précédent (décret annuel, à vérifier) ;
  - dans les villes où les loyers sont encadrés, loyer de référence majoré saisi à la main, car aucune source automatique n'est prévue ;
  - aucune hausse pour un logement classé F ou G (déjà géré pour la révision).

---

## 7. Interventions et prestataires

**Statut :** à faire.

**Ce qu'il faut ajouter :**

- **Interventions** (table `interventions`) sur un bien ou un lot : date du signalement, objet, à la charge du propriétaire ou du locataire (réparations locatives, décret n° 87-712 du 26 août 1987, à vérifier), prestataire, devis, état (signalée, devis demandé, prévue, faite, facturée), coût. Une intervention facturée crée la dépense du bien, avec sa part récupérable (tranche 4) ou d'amélioration.
- **Carnet des prestataires** : nom, métier, téléphone, e-mail, commentaire, interventions passées.
- **Entretiens périodiques** rappelés dans l'échéancier : chaudière, ramonage, détecteur de fumée, contrôle de la VMC. Qui doit les faire, et à quelle fréquence, est à vérifier pour chacun.

---

## Hors de ce chantier

- **Fiscalité locative**, au chantier suivant : revenus fonciers (micro-foncier ou réel, déclaration 2044), location meublée (micro-BIC ou réel avec amortissements, 2031 et 2033), meublés de tourisme, déficit foncier, lien avec le récapitulatif fiscal.
- **Stockage des fichiers** (bail signé, photos, factures).
- **Synchronisation bancaire.**
- Signature électronique, candidatures et visites, publication d'annonces.

## Ordre de développement

1. **Lots, colocation et locataires**, base de tout le reste.
2. **Vue du parc.**
3. **Encaissements** (passage au suivi strict).
4. **Charges.**
5. **Locations saisonnières**, avec l'import CSV.
6. **Entrée, sortie et relocation.**
7. **Interventions et prestataires.**

Un commit par tranche au moins, sur la branche `gestion-locative`.
