# Fonds euros : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

Le fonds euros est le support à capital garanti d'un contrat d'assurance-vie ou de PER assurantiel. Ce n'est pas une enveloppe : c'est un support du contrat, à côté des unités de compte (ETF, fonds…). Il appartient à l'assureur, et deux contrats du même assureur peuvent avoir le même.

La page montre vos fonds euros **tous contrats confondus** : le solde, les intérêts et les taux servis de chaque fonds, dans chaque contrat.

Ce qui concerne un contrat en entier est sur la [page du contrat](../comptes/guide.md#la-page-dun-compte), qu'on ouvre en cliquant sur son nom : sa valeur et ses unités de compte, son ancienneté et la règle des 8 ans, la clause bénéficiaire, la garantie, les frais, et le contrôle avec la valeur relevée chez l'assureur.

Les mouvements se saisissent dans le [Journal](../journal/guide.md).

Un PER bancaire n'a pas de fonds euros : il n'apparaît pas ici. Les contrats archivés non plus.

Tant qu'aucun compte n'existe, la page affiche l'accueil « Bienvenue dans Hamac ». S'il y a des comptes mais aucun contrat, elle propose d'en créer un.

La page est la même dans les deux formats. Elle peut être masquée du menu dans Paramètres › Plan › Modules.

## Ce que vous y voyez

### En-tête

Trois boutons : **Arbitrage**, **Verser sur un autre fonds euros** et **Ajouter une opération** (un versement). Ils s'ouvrent sur le premier contrat ; le contrat se change dans la saisie.

### Les contrats

Une carte par contrat d'assurance-vie ou de PER assurantiel : son nom (qui ouvre sa page), son établissement, l'argent placé sur ses fonds euros et, pour une assurance-vie, où en est la règle des 8 ans (« 8 ans passés », la date à venir, ou la date d'ouverture à renseigner).

### Les chiffres d'ensemble

- **Encours des fonds euros** : le solde de tous vos fonds euros, et sa part dans le total de vos comptes.
- **Intérêts reçus** : tous les intérêts notés sur ces fonds depuis l'ouverture des contrats.
- **Taux moyen servi** : la moyenne des taux servis de chaque fonds, pondérée par son solde, à côté de l'hypothèse de rendement du plan.
- **Versements mensuels** : les versements programmés ce mois-ci sur ces contrats.

### Le tableau des fonds

**Une ligne par fonds euros et par contrat** : le fonds par défaut de chaque contrat, ceux qui ont un solde et ceux qui ont des taux saisis. Colonnes : nom du fonds (avec l'étiquette « support par défaut » s'il l'est), contrat, solde, intérêts reçus, dernier taux servi et son année, taux moyen servi, part. Cliquez sur un en-tête pour trier, sur le nom du contrat pour ouvrir sa page.

Cliquez sur une ligne pour la déplier : le tableau des **taux servis** (année, taux net, intérêts saisis cette année-là, la plus récente en haut), un formulaire pour en ajouter, et l'évolution du fonds dans ce contrat.

### Les mouvements

Les 20 dernières opérations de vos contrats, repris du Journal.

## Comment faire

### Créer un contrat

Cliquez sur **Ajouter un contrat** (page vide), ou passez par Paramètres › Comptes › Nouveau compte, type Assurance-vie ou PER (assurantiel). Renseignez l'établissement et la date d'ouverture.

Le champ **Fonds euros par défaut** propose :

- « Nouveau fonds euros, à son nom » (création seulement) : Hamac crée un fonds euros nommé d'après le contrat ;
- un fonds euros existant, par exemple celui d'un autre contrat du même assureur ;
- « Aucun » : l'argent hors unités de compte reste en espèces dans le contrat.

### Changer le fonds euros par défaut

Ouvrez la fiche du contrat (crayon) et choisissez un autre fonds dans **Fonds euros par défaut**. Tout l'argent du contrat qui ne vise pas de fonds précis passe sur le nouveau fonds, y compris celui des opérations passées. Les taux servis du contrat le suivent, sauf pour les années que le nouveau fonds a déjà. L'ancien fonds est supprimé s'il ne sert plus nulle part.

### Verser sur un autre fonds euros

Cliquez sur **Verser sur un autre fonds euros** : la saisie s'ouvre sur un versement avec un nouveau fonds euros à nommer, tel qu'il figure sur le relevé de l'assureur. Pour un fonds qui existe déjà, choisissez-le dans le champ **Support** de la saisie.

### Passer du fonds euros à une unité de compte

Cliquez sur **Arbitrage**. Indiquez le support cédé, le support reçu, la quantité côté unité de compte, la valeur de l'échange en euros et les frais. Rien n'est imposable : l'argent reste dans le contrat. Voir le [Journal](../journal/guide.md#passer-dun-support-à-un-autre-dans-un-contrat-arbitrage).

### Contrôler le calcul avec le relevé de l'assureur

1. Relevez la valeur du contrat sur le site de l'assureur.
2. Ouvrez la page du contrat (cliquez sur son nom). Dans **Contrôle avec le relevé**, saisissez la **valeur relevée** et sa **date**, puis **Enregistrer le relevé**.
3. S'il y a un écart, ajoutez dans le Journal une **Correction** du montant de l'écart, datée du relevé.

### Saisir les taux servis

Dépliez la ligne du fonds dans le tableau, indiquez l'**année** et le **taux**, puis **Ajouter**. Une année déjà saisie est remplacée. La corbeille retire une année.

### Noter les intérêts de l'année

Chaque début d'année, ajoutez dans le Journal une opération **Intérêts / coupon** sur le contrat, datée du 31 décembre, au montant crédité. Laissez le support par défaut, ou choisissez le fonds concerné. De janvier à mars, le tableau de bord rappelle les contrats d'assurance-vie dont les intérêts de l'année écoulée manquent.

## Comprendre les chiffres

**Un fonds euros n'a pas de cours.** Une part vaut 1 €. Son solde est la somme des euros qui y entrent, moins ceux qui en sortent.

**Ce qui va sur le fonds par défaut.** L'argent du contrat sans support précisé : apports, versements, versements programmés, retraits, intérêts, dividendes, frais, impôts, corrections, et l'argent des achats et ventes d'unités de compte. Un achat d'unités de compte fait donc baisser le fonds par défaut ; une vente le fait monter.

Exemple fictif : 10 000 € versés sur le fonds, 3 000 € d'unités de compte achetées, 150 € d'intérêts. Solde du fonds : 7 150 €.

**Intérêts reçus.** Les intérêts notés sur ce fonds, ou sans support s'il est le fonds par défaut. Le coupon d'une obligation détenue dans le contrat n'en fait pas partie.

**Taux moyen servi.** Pour chaque fonds, la moyenne simple des taux saisis, sans tenir compte du solde de chaque année. Le chiffre du haut de page pondère ces moyennes par le solde actuel de chaque fonds : 3 000 € à 3 % et 1 000 € à 2 % donnent 2,75 %. Ces taux sont informatifs : la projection utilise l'hypothèse de rendement du fonds euros de vos paramètres, et les intérêts réels viennent du Journal.

**Contrôle avec le relevé.** Hamac recalcule la valeur du contrat à la date du relevé, pas à aujourd'hui, et la compare à la valeur relevée. Un écart de moins de 1 € est attribué aux arrondis et affiché comme concordant.

**Fiscalité allégée.** Date d'ouverture + 8 ans. Sans date d'ouverture, la page du contrat demande de la renseigner.

**Garantie FGAP.** Plafond de la garantie des assureurs (Paramètres › Plan, 70 000 € par défaut) − valeur du contrat. Exemple fictif : un contrat de 50 000 € laisse 20 000 € de marge.

## Limites

- La marge FGAP de la page du contrat porte sur ce seul contrat. Or le plafond s'applique par assureur, tous contrats confondus : pour le calcul complet, voir la carte « Protection en cas de faillite » de [Mes comptes](../comptes/guide.md).
- Les frais affichés viennent de l'offre de l'établissement, pas des frais saisis sur la fiche du contrat.
- Les taux servis ne servent à aucun calcul.
- Seul le dernier relevé est affiché. Les relevés précédents restent enregistrés, mais ne se consultent ni ne se suppriment depuis la page.
- La règle des 8 ans et la clause bénéficiaire ne s'affichent que pour l'assurance-vie, pas pour le PER.
- Le rappel des intérêts de janvier ne concerne pas les PER.
- La page vide propose de créer une assurance-vie : pour un PER, passez par Paramètres › Comptes.
- Hamac ne calcule pas les intérêts du fonds euros : vous les notez au montant crédité par l'assureur.
