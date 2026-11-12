# Autres biens : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Autres biens** (menu Placements) regroupe ce qui n'est ni un compte ni de l'immobilier : l'or et les métaux précieux, les bijoux et objets d'art ou de collection, les véhicules, les parts d'une société non cotée, un compte courant d'associé, l'argent prêté à un proche, et tout autre bien.

Pour chaque bien, elle donne sa valeur, la part qui vous revient, ce que rapporterait une vente rapide, et une estimation de l'impôt si vous le vendiez aujourd'hui.

Ces biens comptent dans votre **patrimoine net** (tableau de bord, historique). Ils n'entrent dans votre répartition que si vous leur donnez une classe d'actifs que vous avez créée.

Quelques mots utilisés sur la page :

- **Part détenue** : votre part du bien, par exemple 50 % pour un bien à deux.
- **Démembrement** : la propriété est partagée entre l'**usufruit** (le droit d'utiliser le bien ou d'en toucher les revenus) et la **nue-propriété** (le bien lui-même, qui revient en entier au nu-propriétaire à la fin de l'usufruit). Dans Hamac, seules les parts de société peuvent être démembrées.
- **Décote de vente rapide** : ce qu'on perd en vendant vite, en pourcentage.
- **Compte courant d'associé** : de l'argent que vous avez prêté à une société dont vous êtes associé.

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu si vous masquez le module « Autres biens » dans Paramètres › Plan › Modules.

## Ce que vous y voyez

En haut, le bouton **Nouveau bien**.

**Trois chiffres**, pour les biens non archivés :

- **Valeur détenue** : la valeur de la part qui vous revient, tous biens confondus.
- **En cas de vente rapide** : la même valeur, après la décote de chaque bien.
- **Impôt si tout était vendu** : la somme des impôts estimés, au régime le plus avantageux pour chaque bien.

**Le tableau des biens**, une ligne par bien (les biens archivés sont grisés) :

- **Bien** : le nom, puis le type, la part détenue et le droit détenu s'ils ne sont pas complets, et « estimé le … » ou « selon l'échéancier » pour un prêt ;
- **Valeur** : la valeur du bien entier ;
- **Valeur détenue** : votre part ;
- **Vente rapide** : votre part après décote, et en dessous le délai pour vendre ou récupérer l'argent (« immédiat » ou « 6 mois », par exemple) ;
- **Impôt à la vente** : le montant, « Exonéré », ou « non estimé ». Un tiret pour un bien archivé ;
- en bout de ligne, des boutons pour modifier ou supprimer.

Cliquez sur une ligne pour la déplier :

- **Impôt si vendu aujourd'hui** : le montant de chaque régime possible, avec le détail du calcul, le plus avantageux mis en avant, et une remarque ;
- **Estimations** : la valeur actuelle et les estimations passées, avec un petit formulaire pour en ajouter une. Ce bloc n'existe pas pour un prêt avec échéancier.

Sous le tableau : la date de vérification des règles d'impôt et leurs sources (BOFiP et douane).

## Comment faire

**Ajouter un bien.** « Nouveau bien » : choisissez le type. Hamac propose la décote et le délai habituels du type (vous pouvez les changer) :

| Type | Décote de vente rapide | Délai | Baisse de valeur par an |
|---|---|---|---|
| Or et métaux précieux | 5 % | immédiat | — |
| Bijou, objet d'art, de collection | 30 % | 6 mois | — |
| Véhicule | 15 % | 1 mois | 15 % |
| Parts de société non cotée | 30 % | 12 mois | — |
| Compte courant d'associé | — | 12 mois | — |
| Argent prêté | — | — | — |
| Autre bien | 30 % | 3 mois | — |

Puis le nom, la valeur estimée du bien entier et sa date, la date et le prix d'achat (ils servent au calcul de l'impôt), et votre part.

**Suivre une somme prêtée.** Choisissez « Argent prêté à un proche ». Si le prêt a un échéancier, remplissez la somme prêtée, le taux, la durée et la première échéance : la somme encore due se calcule toute seule, comme le capital restant d'un crédit. Sinon, saisissez la somme encore due et le délai prévu de remboursement. La fenêtre rappelle qu'un prêt de plus de 5 000 € se déclare aux impôts (formulaire 2062).

**Déclarer des parts en usufruit ou en nue-propriété.** Pour des parts de société, choisissez le droit détenu, puis la date de naissance de l'usufruitier (usufruit à vie) ou la date de fin (usufruit à durée fixe).

**Mettre à jour une valeur.** Dépliez la ligne et ajoutez une estimation datée. Une estimation plus récente devient la valeur du bien ; l'ancienne rejoint l'historique. Une estimation plus ancienne s'ajoute à l'historique. Changer la date d'estimation dans la fiche du bien garde aussi l'ancienne valeur dans l'historique.

**Inclure un bien dans la répartition.** Si vous avez créé des classes d'actifs (Paramètres › Répartition), la fiche propose une « Classe d'actifs » ; choisissez-en une, puis si le bien est dans l'allocation ou non.

**Archiver un bien vendu.** Modifiez-le et cochez « Archivé ». Il ne compte plus dans le patrimoine, y compris dans l'historique passé. Pour le faire disparaître, supprimez-le : ses estimations sont supprimées avec lui.

## Comprendre les chiffres

**Valeur du bien entier.**

- Avant la date d'achat : 0 €.
- Prêt avec échéancier : la somme prêtée avant la première échéance, puis le capital restant dû.
- Sinon : la dernière estimation connue à la date. Avec une baisse de valeur par an, elle diminue chaque année depuis cette estimation. Exemple : une voiture estimée 20 000 € avec 15 % de baisse par an vaut 17 000 € un an plus tard, 14 450 € deux ans plus tard.

**Valeur détenue.** Valeur du bien entier × part détenue × part du droit détenu (100 % en pleine propriété).

**Part du droit détenu (parts de société démembrées).** Elle suit le barème fiscal de l'article 669 du code général des impôts :

- usufruit à vie : 90 % de la valeur si l'usufruitier a moins de 21 ans, puis 10 points de moins par tranche de dix ans, jusqu'à 10 % à partir de 91 ans. Exemple : à 65 ans, l'usufruit vaut 40 % et la nue-propriété 60 % ;
- usufruit à durée fixe : 23 % par période de dix ans, toute période commencée comptant pour une entière, sans dépasser l'usufruit à vie ;
- la nue-propriété vaut le reste. Si l'usufruitier n'est pas renseigné, le bien compte en entier.

La valeur change donc avec l'âge de l'usufruitier.

**Vente rapide.** Valeur détenue × (1 − décote).

**Impôt à la vente**, pour votre part (valeur du bien × part détenue), selon le type :

- **Or et métaux précieux** : taxe forfaitaire de 11,5 % du prix de vente, quelle que soit la plus-value. Si vous avez indiqué le prix et la date d'achat, Hamac calcule aussi le régime des plus-values et garde le moins cher.
- **Bijoux, objets d'art, de collection ou d'antiquité** : exonérés si le prix de vente est de 5 000 € ou moins ; sinon taxe forfaitaire de 6,5 % du prix de vente, ou régime des plus-values si c'est moins.
- **Véhicule** : exonéré (sauf véhicule de collection, imposé comme un objet de collection : Hamac ne fait pas cette distinction).
- **Autre bien** : exonéré à 5 000 € ou moins ; sinon régime des plus-values, si le prix et la date d'achat sont connus.
- **Parts de société** : non estimé (plus-value de valeurs mobilières).
- **Compte courant et argent prêté** : le remboursement du capital n'est pas imposé ; les intérêts le sont, l'année où vous les recevez.

**Régime des plus-values.** Plus-value = prix de vente − prix d'achat (pour votre part). Après deux ans de détention, elle est réduite de 5 % par année entière ; elle est exonérée après 22 ans. Ce qui reste est imposé à 19 % plus 17,2 % de prélèvements sociaux. Exemple : de l'or acheté 10 000 €, vendu 15 000 € après 10 ans : plus-value 5 000 €, abattement 40 %, reste 3 000 €, impôt 3 000 × 36,2 % = 1 086 €. La taxe forfaitaire serait 15 000 × 11,5 % = 1 725 € : Hamac retient 1 086 €.

## Limites

- Les valeurs sont celles que vous saisissez : Hamac ne connaît pas le cours de l'or ni la cote d'un véhicule.
- L'impôt est une estimation, sans valeur officielle. Le régime des plus-values suppose de prouver le prix et la date d'achat (facture), et un lot identifiable pour l'or.
- Le total « Impôt si tout était vendu » compte 0 € pour les biens « non estimés » (parts de société, autre bien sans prix d'achat).
- Le taux de 17,2 % de prélèvements sociaux sur ces plus-values est marqué « à confirmer » dans le code.
- Les véhicules de collection et les meubles meublants ne sont pas distingués.
- Un bien archivé disparaît aussi de l'historique passé, pas seulement à partir de sa vente.
- Les intérêts d'un prêt ou d'un compte courant ne sont pas suivis sur cette page.
