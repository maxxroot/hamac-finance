# Paramètres : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi ça sert

La page « Paramètres » règle ce que Hamac doit faire pour vous et les hypothèses de ses calculs : votre âge et votre date de départ, la fiscalité, la répartition visée entre les placements, les frais de vos établissements. Elle sert aussi à gérer la liste de vos comptes et de vos titres, les sources de cours et votre compte (mot de passe, double authentification, sauvegarde).

Tous ces réglages sont propres à votre compte. Les autres personnes de l'instance ne les voient pas.

## Ce que vous y voyez

La page a sept onglets, dans cet ordre : Plan, Répartition, Établissements, Comptes, Actifs, Cours, Application.

### Plan

- **Usage** : deux choix.
  - « Préparer ma retraite » : projection jusqu'au départ, revenu mensuel possible, part d'actions qui baisse à l'approche de la retraite.
  - « Gérer mon patrimoine » : suivi, allocation cible fixe, versements et alertes, sans projection de retraite. Dans ce cas, la page Projection disparaît du menu et les champs propres à la retraite sont masqués.
  - Changer d'usage ne touche pas à vos données.
- **Modules** : une case par partie de l'application (Performance, Historique, Simulateurs, Projets, Livrets, Fonds euros, Obligations, Actions & ETF, Crypto, Immobilier, Crowdlending, Autres biens, Crédits, Impôts). Décocher une case retire la page du menu. Rien n'est supprimé et aucun calcul ne change.
- **Profil et calendrier** (ou « Profil et versements » en gestion de patrimoine) :
  - année de naissance (l'âge de cette année s'affiche dessous) ;
  - en mode retraite seulement : âge de départ visé, âge de début de sécurisation (à partir de cet âge, la part d'actions baisse), âge horizon (fin des retraits, sert au revenu mensuel possible) ;
  - premier mois des versements et jour des versements dans le mois (le dernier jour du mois s'il est plus court) ;
  - revenus nets du foyer par mois, avant impôt sur le revenu : ils servent au taux d'effort des crédits ;
  - case « Imposition en couple ».
- **Hypothèses** : inflation et, en mode retraite, rendement réel pendant la retraite. Le rendement attendu de chaque classe se règle dans l'onglet Répartition.
- **Règles des livrets** : un plancher (le matelas de sécurité, à ne jamais franchir) et un plafond (au-delà, l'excédent part vers le fonds euros).
- **Fiscalité** : tranche marginale d'imposition (0, 11, 30, 41 ou 45 %), dispense d'acompte sur les intérêts, prélèvements sociaux (cas général et assurance-vie), impôt sur un retrait de PEA avant 5 ans, impôt de l'assurance-vie avant et après 8 ans, abattement annuel de l'assurance-vie pour une personne seule, plafond de déduction PER (lu sur votre avis d'impôt, 0 s'il n'est pas renseigné), seuil d'exonération des ventes de crypto. Un encadré « Imposition retenue » indique si Hamac applique le barème (s'il est plus avantageux) ou le taux forfaitaire de 12,8 %. Les valeurs par défaut sont celles de 2026 : vérifiez-les chaque année.
- **Biens en location** (si le module Immobilier est affiché) : la part des charges de copropriété récupérable sur le locataire, proposée à la saisie d'une dépense (deux tiers par défaut). Chaque dépense garde la sienne.
- **Seuils d'alerte** : espèces à investir sur le compte-titres et sur le PEA, garantie des assureurs par personne et par assureur, concentration maximale sur un seul titre, émetteur ou plateforme (0 : pas d'alerte). Pour les loyers non reçus : nombre de jours après l'échéance avant le rappel amiable, la relance, puis la mise en demeure.

### Répartition

- **Ma répartition cible** : un tableau avec une ligne par classe que vous détenez (Livrets, Fonds euros, Obligations, Actions, Immobilier, Crowdlending, Crypto), plus les classes que vous avez créées. Pour chaque ligne :
  - « Inclus » : la classe compte dans l'allocation ou non ;
  - la cible, en pourcentage ;
  - le rendement attendu, facultatif. Pour les livrets, la moyenne actuelle de vos livrets s'affiche comme repère.
  - Le total s'affiche sous le tableau, avec ce qui reste à répartir ou ce qui est en trop. Il doit faire 100 % pour enregistrer.
  - « Ajouter une classe » crée une classe personnalisée (par exemple « Métaux précieux ») : vous choisissez son nom et sa couleur, et vous pouvez la supprimer.
- **Part actions à l'âge de départ** (mode retraite) et **seuil d'alerte de rééquilibrage** : une alerte s'affiche si la part d'une classe s'écarte de sa cible de plus de ce pourcentage. En mode retraite, la part d'actions visée cette année s'affiche.
- Si d'anciennes cibles posées sur des comptes ont été retirées lors d'une mise à jour, un encadré les liste une fois. « Compris » le ferme.
- **Allocations personnalisées** : des lignes en plus de la répartition, qui donnent une part des versements à un compte ou à un type de compte, éventuellement jusqu'à une limite (en montant versé ou en valeur). Une ligne qui atteint sa limite peut passer le relais à une autre. Exemple affiché : 20 % des versements sur les livrets jusqu'à 10 000 € versés, puis vers l'assurance-vie.

### Établissements

- Une carte par banque, courtier, assureur ou plateforme, avec ses offres (PEA, compte-titres, assurance-vie, livrets, crowdlending, crypto), ses frais, sa note sur 10, et les comptes qui y sont rattachés. Un établissement sans compte porte la mention « À l'étude » : vous pouvez ajouter une offre que vous comparez avant d'ouvrir un compte.
- Trois tableaux de comparaison, triables, qui n'apparaissent que si au moins un établissement a l'offre concernée :
  - **Comparer le courtage** : frais d'un ordre de 100, 250, 500, 1 000 et 5 000 €, droits de garde, ETF monde éligible au PEA, obligations en direct, investissement programmé. La valeur la plus basse de chaque colonne est mise en avant.
  - **Comparer les assurances-vie** : frais sur versements, frais de gestion du fonds euros et des unités de compte, dernier taux et moyenne sur 5 ans du fonds euros, 100 % fonds euros possible, bonus conditionné, ETF monde, versements programmés dès, note.
  - **Comparer les plateformes crypto** : frais par opération, écart de prix estimé (spread), coût total d'un achat, note.
- **Frais par défaut** : courtage en pourcentage par ordre, courtage minimum, frais crypto par opération. Ils servent aux comptes rattachés à aucun établissement. Ce bloc a son propre bouton « Enregistrer ».

### Comptes

La liste de vos comptes : nom, type, établissement, date d'ouverture, taux, plafond, rôle dans le plan. Un compte archivé apparaît en grisé. Le tableau se trie par colonne. « Nouveau compte » ouvre la fiche de saisie.

### Actifs

La liste de vos titres (ETF, actions, obligations, cryptos…) : nom, ISIN, type, classe, allocation, source du cours, part cible. Au-dessus, le total des parts cibles des actions s'affiche, avec la mention « devrait faire 100 % » s'il n'y arrive pas. Deux listes se règlent directement dans le tableau :

- **Classe** : la classe par défaut du type de titre, ou une de vos classes personnalisées ;
- **Allocation cible** : par défaut, dans l'allocation, ou hors allocation.

### Cours

L'ordre des sources de cours, l'état de Twelve Data et l'état du cours de chaque titre. Voir le [guide des sources de cours](../sources-de-cours/guide.md).

### Application

- **Apparence** : le thème, gardé dans votre compte sur tous vos appareils.
- **Mot de passe**, **Double authentification** : voir le [guide des comptes et de la sécurité](../comptes-et-securite/guide.md).
- **Sauvegarde et transfert** : voir le [guide des sauvegardes](../sauvegardes/guide.md).
- **Données et application** : version de Hamac, base de données, sauvegardes automatiques, version du schéma, version de PostgreSQL.

## Comment faire

### Enregistrer les onglets Plan et Répartition

1. Modifiez un ou plusieurs champs, sur l'un ou l'autre onglet. Vos modifications restent en attente quand vous changez d'onglet.
2. Une barre apparaît en bas à droite : « Modifications non enregistrées », ou le nombre de points à corriger et l'onglet où ils se trouvent.
3. Cliquez sur « Enregistrer ». Le bouton reste grisé tant qu'un point est à corriger. « Annuler » revient aux valeurs enregistrées.

Les autres onglets enregistrent chaque fiche à part, avec son propre bouton.

### Passer du mode retraite au mode patrimoine

1. Onglet Plan, bloc Usage : cliquez sur « Gérer mon patrimoine ».
2. Enregistrez. La page Projection disparaît du menu. Vos âges de départ et d'horizon restent enregistrés pour le jour où vous reviendrez au mode retraite.

### Masquer une page du menu

1. Onglet Plan, bloc Modules : décochez la page.
2. Enregistrez.

### Créer une classe d'actifs

1. Onglet Répartition : « Ajouter une classe ».
2. Donnez-lui un nom (obligatoire, 40 caractères au plus), une couleur et une cible.
3. Enregistrez.
4. Onglet Actifs : choisissez cette classe dans la colonne Classe des titres concernés.

### Ajouter un établissement et sa grille de frais

1. Onglet Établissements : « Ajouter un établissement ».
2. Saisissez le nom et le type. À la création, le type coche les offres habituelles (par exemple PEA et compte-titres pour un courtier).
3. Cochez les offres proposées, puis renseignez les frais de chacune. Pour le courtage, une grille se compose de paliers (ordre jusqu'à tel montant : un montant fixe plus un pourcentage de l'ordre), avec un minimum et un maximum par ordre si besoin.
4. Bloc Fiscalité : indiquez si l'établissement prélève les impôts sur les intérêts et les dividendes, et si Hamac doit rédiger son récapitulatif fiscal (à cocher si l'établissement ne transmet rien au fisc).
5. Bloc Protection en cas de faillite : établissement garant et pays, s'ils diffèrent.
6. Enregistrez, puis rattachez vos comptes à cet établissement depuis l'onglet Comptes.

### Supprimer un établissement

Cliquez sur la corbeille de sa carte et confirmez. Les comptes rattachés gardent leur historique et repassent sur les frais par défaut.

## Comprendre

- **Retraite ou patrimoine.** En mode retraite, la part d'actions baisse chaque année entre l'âge de sécurisation et l'âge de départ, jusqu'à la « part actions à l'âge de départ ». Ce que les actions perdent va au fonds euros, ou aux obligations si le fonds euros n'est pas dans l'allocation. En mode patrimoine, la part reste celle du tableau.
- **Les classes.** Chaque compte et chaque titre suit une classe : celle de son type, ou celle que vous avez choisie sur sa fiche. Une classe cochée « Inclus » compte dans l'allocation. Un élément peut sortir de l'allocation ou y entrer seul, sur sa fiche.
- **Rendement attendu.** Les classes sans rendement renseigné n'entrent pas dans la projection.
- **Frais.** Pour un achat ou une vente sur un PEA ou un compte-titres, Hamac prend la grille de l'établissement du compte. Un PEA-PME suit la grille PEA. Pour la crypto, il prend les frais de la plateforme. Sans établissement, ou si l'établissement n'a pas l'offre, il prend les frais par défaut.
- **Contrôles.** Hamac refuse d'enregistrer des réglages incohérents, par exemple :
  - l'âge de sécurisation après l'âge de départ, ou un âge horizon qui ne dépasse pas l'âge de départ (en mode retraite) ;
  - une part d'actions au départ supérieure à la part actuelle (en mode retraite) ;
  - un plancher des livrets au-dessus du plafond ;
  - des relances de loyer qui ne se suivent pas (rappel, puis relance, puis mise en demeure) ;
  - une répartition qui ne fait pas 100 %.

## Limites

- Les taux fiscaux par défaut sont ceux de 2026. Hamac ne les met pas à jour tout seul : vérifiez-les chaque année sur votre avis d'imposition ou sur impots.gouv.fr.
- Certains réglages enregistrés avec le plan ne se modifient pas dans cette page : l'abattement de l'assurance-vie pour un couple, le taux forfaitaire d'impôt de 12,8 %, et les scénarios de baisse des actions et de la crypto. Le mode des versements (libre ou suggéré) se règle dans la page Versements.
- Une note sur 10 et les comparatifs reposent sur ce que vous saisissez : Hamac ne télécharge aucune grille tarifaire.
