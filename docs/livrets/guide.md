# Livrets : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page Livrets suit votre épargne de précaution : LEP, LDDS, Livret A et autres livrets. Elle montre le solde de chacun, sa marge avant le plafond de dépôt, les intérêts de l'année et l'historique des taux. Elle vous dit aussi si l'ensemble de vos livrets reste entre le plancher et le plafond que vous vous êtes fixés.

Les mouvements (versements, retraits, intérêts) se saisissent dans le [Journal](../journal/guide.md). Les versements mensuels se programment dans [Versements](../versements/guide.md).

Tant qu'aucun compte n'existe, la page affiche l'accueil « Bienvenue dans Hamac ». S'il y a des comptes mais aucun livret, elle propose d'en créer un.

La page est la même dans les deux formats. Elle peut être masquée du menu dans Paramètres › Plan › Modules.

## Ce que vous y voyez

### En-tête

Le bouton **Nouvelle opération** ouvre la saisie sur un versement dans votre premier livret.

### Quatre chiffres

- **Total des livrets**, avec la fourchette du plan (plancher – plafond).
- **Taux moyen pondéré** : le taux moyen de vos livrets, chacun compté selon son solde.
- **Intérêts estimés** de l'année, calculés par quinzaines, versements programmés compris.
- **Intérêts acquis à ce jour** : la part de ces intérêts déjà gagnée. Ils seront crédités le 31 décembre.

### État des livrets

Le même message que sur [Mes comptes](../comptes/guide.md) : sous le plancher, au-dessus du plafond, ou dans la fourchette.

### Tableau des livrets

Une ligne par livret non archivé. Un clic sur un en-tête trie la colonne ; un clic sur une ligne déplie sa courbe d'évolution.

| Colonne | Contenu |
|---|---|
| Livret | Son nom, son type s'il diffère du nom, et son rôle. |
| Établissement | L'établissement qui le tient. |
| Taux actuel | Le taux en vigueur aujourd'hui, et la date depuis laquelle il s'applique. |
| Plafond | Le plafond de dépôt. |
| Versement mensuel | Le versement programmé ce mois-ci. |
| Solde | Ce que contient le livret aujourd'hui. |
| Marge avant plafond | Plafond − solde. En rouge si le solde dépasse le plafond. |
| Intérêts de l'année | Estimation de l'année, et la part déjà acquise. |
| Intérêts encaissés | Tous les intérêts notés au journal pour ce livret, depuis le début. |
| (crayon) | Modifier la fiche du livret. |

Sous le tableau, quand vous avez plusieurs livrets, une ligne « Ordre de remplissage » les énumère avec leur plafond.

### Historique des taux

Un formulaire (livret, date de début, taux) et la liste de tous les taux enregistrés, du plus récent au plus ancien, chacun avec une corbeille. Le titre rappelle que les taux réglementés changent souvent au 1er février et au 1er août.

### Mouvements

Les dernières opérations de vos livrets, reprises du Journal, avec un bouton pour en ajouter une.

## Comment faire

### Créer un livret

Cliquez sur **Ajouter un livret** (page vide), ou passez par Paramètres › Comptes › Nouveau compte.

1. Choisissez le type **Livret**, puis le livret : LEP, LDDS, Livret A ou Autre livret. Un LEP, un LDDS ou un Livret A déjà ouvert est grisé : un seul par personne.
2. Le nom et le **plafond de dépôt** se remplissent selon le type. Vous pouvez les modifier.
3. Rattachez l'établissement.
4. Indiquez le **taux actuel**, net, tel qu'affiché par la banque, et la date **« En vigueur depuis le »** (aujourd'hui si vide).

Ensuite, notez le solde de départ par un **Apport initial** dans le Journal.

### Enregistrer un changement de taux

Dans **Historique des taux**, choisissez le livret, la date à partir de laquelle le nouveau taux s'applique et le taux, puis **Enregistrer**. L'ancien taux reste dans l'historique : les intérêts de l'année tiennent compte des deux.

Vous pouvez aussi changer le taux dans la fiche du livret (crayon), avec sa date.

### Noter les intérêts de l'année

En janvier, ajoutez dans le Journal une opération **Intérêts / coupon** sur le livret, datée du 31 décembre, pour le montant crédité par la banque. De janvier à mars, le tableau de bord vous rappelle les livrets dont les intérêts de l'année écoulée manquent.

### Remettre vos livrets dans la fourchette

- Sous le plancher : versez sur vos livrets avant tout autre placement.
- Au-dessus du plafond : transférez l'excédent vers le fonds euros, par un **Transfert** dans le Journal.

Plancher et plafond se règlent dans Paramètres › Plan › Règles des livrets.

## Comprendre les chiffres

**Solde.** Apports, versements, versements programmés prélevés, intérêts et transferts reçus, moins retraits, frais, impôts et transferts sortants, plus les corrections.

**Intérêts par quinzaines.** C'est la règle des livrets réglementés. L'année compte 24 quinzaines : du 1er au 15, puis du 16 à la fin du mois.

- Un dépôt rapporte à partir de la quinzaine qui suit. Un versement du 10 mars compte à partir du 16 mars.
- Un retrait cesse de rapporter dès le début de la quinzaine où il a lieu.
- Chaque quinzaine rapporte : solde × taux de cette quinzaine ÷ 24.
- Les intérêts crédités au 31 décembre rapportent à partir du 1er janvier suivant.

Exemple fictif : 6 000 € toute l'année à 3 % rapportent 6 000 × 3 % = 180 €. Si 1 200 € arrivent le 10 juillet, ils rapportent à partir du 16 juillet, soit 11 quinzaines : 1 200 × 3 % × 11 ÷ 24 = 16,50 € de plus.

L'**estimation** prend les opérations du journal et les versements programmés de toute l'année, même à venir. Les **intérêts acquis** s'arrêtent à la quinzaine en cours, incluse.

**Taux de chaque quinzaine.** C'est le dernier taux enregistré dont la date de début est au plus tard le premier jour de la quinzaine. Sans taux daté en vigueur à cette date, Hamac prend le taux de la fiche.

**Taux moyen pondéré.** Σ (solde × taux actuel) ÷ total des soldes.

**Plafond de dépôt.** Pré-rempli avec le plafond légal : 10 000 € pour le LEP, 12 000 € pour le LDDS, 22 950 € pour le Livret A, aucun pour un autre livret. Les intérêts capitalisés peuvent le dépasser : c'est pourquoi une marge négative est possible.

**Fourchette du plan.** Le total de tous vos livrets est comparé au plancher et au plafond de Paramètres › Plan. Au-dessus du plafond, l'excédent est total − plafond.

## Limites

- Hamac ne calcule pas d'office les intérêts au journal : vous les notez vous-même, au montant crédité.
- L'estimation suppose que le taux reste celui enregistré jusqu'à la fin de l'année.
- Le calcul applique la règle des quinzaines à tous les livrets, y compris un « autre livret » dont la banque calculerait autrement.
- Les plafonds légaux pré-remplis sont ceux connus à l'écriture du code : vérifiez-les.
- « Ordre de remplissage » liste les livrets par nom. Ce n'est pas l'ordre suivi par la gestion suggérée des versements, qui remplit d'abord le livret le mieux rémunéré.
- Un livret archivé disparaît du tableau et du total de la page, mais s'il garde un solde, il compte encore dans le message sur la fourchette du plan.
- « Intérêts encaissés » cumule toutes les années.
