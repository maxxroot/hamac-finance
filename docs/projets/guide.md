# Projets : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page « Projets » suit ce que vous préparez : un achat, des études, des travaux. Pour chaque projet, vous indiquez la somme à réunir, la date, et les comptes où vous mettez l'argent de côté. Hamac vous dit où vous en êtes, si vous êtes en avance ou en retard, et combien mettre de côté chaque mois pour y arriver.

La page est la même dans les deux formats de Hamac (« Préparer ma retraite » et « Gérer mon patrimoine »). Vous pouvez la retirer du menu en décochant le module « Projets » dans Paramètres › Plan › Modules. Cela ne supprime aucun projet.

Les projets en cours apparaissent aussi sur le tableau de bord, dans la carte « Projets en cours » (les six premiers, par date), tant que le module est actif.

**Les donations ne sont pas sur cette page.** Elles se notent et se suivent dans Fiscalité › « Compteurs et plafonds » (voir son [guide](../compteurs-et-plafonds/guide.md)).

## Ce que vous y voyez

1. **L'en-tête**, avec le bouton « Nouveau projet ».

2. **Une alerte**, seulement si un compte est affecté à vos projets pour plus que ce qu'il contient. Elle nomme les comptes concernés.

3. **Une ligne de résumé** : le nombre de projets en cours et la somme totale à mettre de côté chaque mois.

4. **Une carte par projet en cours.** Elle montre :
   - le nom, la date visée et le nombre de mois restants ;
   - le statut : « Atteint », « En avance », « En retard » ou « Date passée » ;
   - les boutons « Modifier » et « Supprimer » ;
   - la somme réunie sur la somme visée, le pourcentage et une barre d'avancement ;
   - « À mettre de côté : … par mois », avec le rendement supposé, ou « Il manque … : la date est passée » ;
   - la liste des comptes qui financent le projet, avec leur part (« 50 % du compte » ou « 3 000 € réservés ») et ce qu'ils apportent aujourd'hui ;
   - un avertissement si la date approche alors que l'argent est surtout en actions, matières premières ou crypto ;
   - votre commentaire.

   Sans projet, la page affiche « Aucun projet. Ajoutez ce que vous voulez financer, avec sa somme et sa date. »

5. **La section « Terminés ou abandonnés »**, pour les projets archivés. Ils sont grisés, sans statut ni montant mensuel.

**La fenêtre d'un projet** (création ou modification) contient : Projet (le nom), Somme à réunir, Pour le (date visée), Depuis le (début de l'effort), Rendement supposé par an, les comptes qui financent le projet, un commentaire, et en modification la case « Terminé ou abandonné (archivé) ».

## Comment faire

**Créer un projet.**
1. Cliquez sur « Nouveau projet ».
2. Donnez un nom, la somme à réunir et la date visée.
3. « Depuis le » vaut aujourd'hui par défaut. Mettez la date à laquelle vous avez commencé à épargner pour ce projet : elle sert à dire si vous êtes en avance ou en retard.
4. Laissez le rendement à 0 % par prudence, ou mettez par exemple le taux du livret si l'argent y reste.
5. Dans « Ajouter un compte… », choisissez un compte où vous mettez cet argent. Recommencez pour chaque compte.
6. Cliquez sur « Ajouter ». Le bouton reste grisé tant que le nom, la somme ou la date manquent, ou si la date visée précède le début.

**Choisir la part d'un compte.** Pour chaque compte, deux façons :
- « En pourcentage » : une part de la valeur du compte. La somme suit la valeur du compte, à la hausse comme à la baisse.
- « Montant réservé » : une somme fixe, qui ne change pas tant que vous ne la modifiez pas. Elle est limitée à ce que contient le compte.

Un compte ne peut servir qu'une fois par projet. Pour le retirer, cliquez sur l'icône de corbeille de sa ligne.

**Modifier un projet.** Cliquez sur « Modifier » sur sa carte, changez ce qu'il faut, puis « Valider ».

**Archiver un projet terminé ou abandonné.** Ouvrez-le avec « Modifier », cochez « Terminé ou abandonné (archivé) », puis « Valider ». Il passe dans « Terminés ou abandonnés ». Décochez la case pour le remettre en cours.

**Supprimer un projet.** Cliquez sur « Supprimer » et confirmez. La suppression est définitive.

**Corriger une alerte de compte trop affecté.** Baissez la part ou le montant réservé du compte dans un ou plusieurs projets en cours, jusqu'à ne pas dépasser sa valeur.

## Comprendre les chiffres

**Somme réunie.** L'addition de ce que chaque compte apporte :
- en pourcentage : la part indiquée de la valeur actuelle du compte. Pour un compte joint, seule votre part du compte compte ;
- en montant réservé : le montant, sans dépasser la valeur du compte.

Exemple : 50 % d'un livret de 10 000 € et 3 000 € réservés sur un PEA de 20 000 € font 8 000 € réunis.

**Avancement.** La somme réunie divisée par la somme visée, sans dépasser 100 %.

**Statut.**
- « Atteint » : la somme réunie atteint la somme visée.
- « Date passée » : la date visée est arrivée et la somme n'est pas réunie.
- « En avance » ou « En retard » : Hamac compare la somme réunie à ce que vous auriez en épargnant au même rythme chaque mois, du début à la date visée. Exemple : pour 12 000 € en 24 mois, après 12 mois, on attend 6 000 €. Avec 7 000 €, vous êtes en avance ; avec 5 000 €, en retard.

**À mettre de côté par mois.** Le versement mensuel qui, ajouté à ce qui est déjà réuni, atteint la somme visée à la date, au rendement supposé. Ce qui est déjà réuni rapporte aussi ce rendement. Exemple : 12 000 € à réunir en 24 mois, rien de réuni, 0 % : 500 € par mois. Avec un rendement positif, il faut un peu moins.

**Somme à mettre de côté chaque mois (résumé).** L'addition des montants mensuels de tous les projets en cours.

**Avertissement de risque.** Il apparaît quand la date visée est dans 36 mois ou moins et que plus de 30 % de l'argent du projet est en actions, matières premières ou crypto. Cette part se calcule selon le contenu de chaque compte affecté. Une baisse des marchés juste avant la date ferait manquer la somme.

**Compte trop affecté.** Pour chaque compte, Hamac additionne ce qui lui est demandé par tous les projets en cours (archivés exclus). Si le total dépasse la valeur du compte, l'alerte s'affiche. Ici, le montant réservé compte en entier, même s'il dépasse la valeur du compte.

## Limites

- **Les projets ne changent pas la projection de retraite.** Leur argent reste compté dans la page « Projection », et la date du projet n'y retire rien.
- **Le montant mensuel est indicatif.** Hamac ne crée pas de versement programmé : c'est à vous de le mettre en place dans « Versements ».
- **Un projet dont la date est passée** ajoute toute la somme manquante au total « à mettre de côté chaque mois » du résumé, et non un montant mensuel.
- **Moins d'un mois avant la date**, la carte affiche déjà « la date est passée », alors que le statut peut encore être « En avance » ou « En retard ».
- **Le rendement supposé** est le même pour tout l'argent du projet, quel que soit le compte.
- **Supprimer un compte** le retire de tous les projets qu'il finançait.
