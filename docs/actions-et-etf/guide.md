# Actions & ETF : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Actions & ETF** (menu Placements) montre les actions, les ETF, les fonds et les ETC que vous détenez, **tous comptes confondus** : combien de parts, combien vous les avez payées, ce qu'elles valent aujourd'hui et ce que vous avez gagné ou perdu. Pour le PEA, elle propose aussi le montant à investir ce mois-ci et sa répartition entre vos titres.

Pour voir un seul compte (votre PEA, votre compte-titres…) avec tout ce qu'il contient, cliquez sur son nom : il ouvre la [page du compte](../comptes/guide.md#la-page-dun-compte).

Rien ne se saisit directement sur cette page, sauf un cours à la main. Les positions sont recalculées à partir du **Journal** : chaque achat, vente, dividende ou versement que vous y notez met la page à jour.

Quelques mots utilisés sur la page :

- **ETF** : un fonds coté en bourse qui suit un indice (par exemple les 500 plus grandes entreprises américaines). On l'achète et on le vend comme une action.
- **ETC** : un titre coté adossé à une matière première, le plus souvent de l'or ou de l'argent physique stocké en coffre. Il ne contient pas d'actions : il compte dans la classe **Matières premières**, pas dans les Actions.
- **PRU** (prix de revient unitaire) : ce qu'une part vous a coûté en moyenne, frais d'achat compris.
- **Cours** : le prix d'une part sur le marché, à la dernière date connue.
- **Plus-value** : ce que vaut la position moins ce qu'elle vous a coûté. Elle est « latente » tant que vous n'avez pas vendu.
- **Espèces** : l'argent versé sur le compte et pas encore investi.

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu, avec la page Exposition réelle, si vous masquez le module « Actions » dans Paramètres › Plan › Modules. Sans aucun compte, elle affiche l'écran d'accueil.

## Ce que vous y voyez

En haut, deux boutons : **Ajouter un compte-titres**, et **Ajouter une opération** (un achat, sur le premier compte affiché).

Si vous n'avez pas encore de PEA, un encadré vous propose d'en créer un. Un PEA est limité à un par personne ; sa date d'ouverture compte pour la règle des 5 ans.

### Les comptes concernés

Une carte par compte, dans cet ordre : le PEA (et le PEA-PME), chaque compte-titres, puis chaque assurance-vie, PER ou plan d'épargne salariale qui détient au moins une action, un ETF, un fonds ou un ETC. Les comptes archivés ne sont pas affichés.

Chaque carte donne le nom du compte, son type, son établissement, la valeur de ses actions et ses espèces. **Le nom du compte ouvre sa page.** Un compte-titres sans action (par exemple un compte qui ne contient que des obligations) affiche « aucune action » et un bouton **Acheter des actions ou ETF**.

### Les chiffres d'ensemble

- **Valeur des actions et ETF** : la valeur de toutes les lignes du tableau, et sa part dans le total de vos comptes.
- **Plus-value latente** : cette valeur moins ce que les titres vous ont coûté (l'investi, en dessous).
- **Espèces à investir** : l'argent non investi sur vos PEA et comptes-titres. Le chiffre passe en orange quand les espèces des PEA atteignent le seuil d'alerte réglé dans Paramètres › Plan › Seuils d'alerte (« Espèces du PEA à investir », 50 € par défaut), en rouge s'il est négatif. L'argent non investi d'un contrat d'assurance-vie n'y figure pas : il est sur le fonds euros.
- **Frais de gestion des ETF / an**, et en dessous le courtage payé sur ces titres depuis le début.

**Un avertissement** apparaît si un titre n'a pas de cours : sa valeur affichée est alors son prix de revient.

### Le tableau des lignes

**Une ligne par titre et par compte** : un ETF détenu dans le PEA et dans un compte-titres fait deux lignes. Colonnes : nom et ISIN, compte, parts, PRU, investi, cours, valeur, plus-value en euros et en %, part. Sous le cours, une petite mention indique d'où il vient (« marché », « manuel » ou « prix de revient ») et sa date.

Cliquez sur un en-tête pour trier (par exemple sur **Compte** pour regrouper les lignes de chaque compte), sur une ligne pour déplier l'évolution du titre dans ce compte, sur un cours pour le saisir à la main, sur le nom du compte pour ouvrir sa page. Une ligne **Total** termine le tableau.

### Les cartes

- **Achat conseillé ce mois-ci**, une par PEA : le montant à investir ce mois-ci, puis sa répartition entre les titres qui ont une part cible.
- **Si les actions baissent** : ce que perdraient vos actions et ETF s'ils baissaient de 30 % puis de 50 %, en euros et en part de votre patrimoine. Une baisse n'est une perte que si l'on vend.
- **Parts cibles**, si au moins un titre en a une : pour chaque titre, sa part réelle tous comptes confondus, sa part cible et l'écart.

### Les mouvements

Les 20 derniers achats, ventes et dividendes de ces titres, tous comptes confondus, repris du Journal, avec un bouton pour en ajouter. Les versements et retraits d'espèces sont sur la page de chaque compte.

## Comment faire

**Ouvrir un PEA ou un compte-titres.** Cliquez sur « Ajouter un PEA » (encadré du haut) ou « Ajouter un compte-titres ». Renseignez l'établissement et la date d'ouverture. Pour un PEA, indiquez aussi le nombre de mois sur lesquels étaler l'investissement de l'apport de départ (12 par défaut).

**Noter un achat.** Cliquez sur « Ajouter une opération ». Choisissez le compte, le titre (ou « Nouveau titre » : la recherche par nom ou par ISIN remplit la fiche), la quantité et le montant total débité, frais compris. Les frais sont proposés d'après la grille de l'établissement ; vous pouvez les corriger.

**Noter une vente ou un dividende.** Passez par le Journal, ou par le bouton des mouvements du compte. Pour une vente, le montant est le net reçu, frais déduits.

**Saisir un cours à la main.** Cliquez sur le cours dans le tableau, indiquez le prix et la date, puis Enregistrer. C'est utile quand aucune source ne trouve le cours. Un cours automatique plus récent le remplacera ensuite.

**Fixer une part cible pour un titre.** Dans Paramètres › Actifs, ouvrez le titre et remplissez « Part cible parmi les actions ». La somme des parts cibles doit faire 100 %. Le même écran contient les « Frais de gestion annuels (TER) » de l'ETF.

**Actualiser les cours.** Les cours se mettent à jour automatiquement sur le serveur. Le bouton « Cours il y a … » en haut de l'écran relance l'actualisation et liste les titres qui n'ont pas pu l'être.

## Comprendre les chiffres

**Parts.** La somme des quantités achetées, moins celles vendues.

**Investi et PRU.** L'investi est ce qu'il reste du prix payé, frais d'achat compris. À chaque vente, l'investi baisse en proportion des parts vendues : si vous vendez la moitié de vos parts, la moitié de l'investi sort. Le PRU est l'investi divisé par le nombre de parts. Exemple : 10 parts achetées 1 000 € frais compris, puis 10 parts achetées 1 200 € ; investi 2 200 €, PRU 110 €. Après la vente de 5 parts, l'investi tombe à 1 650 € et le PRU reste 110 €.

**Cours.** Hamac garde le cours le plus récent connu. À date égale, un cours saisi à la main l'emporte sur un cours automatique. Sans aucun cours, le titre est compté à son prix de revient.

**Valeur et plus-value.** Valeur = parts × cours. Plus-value = valeur − investi. Plus-value en % = plus-value ÷ investi.

**Part.** Dans le tableau, la valeur de la ligne divisée par la valeur de toutes les lignes, tous comptes confondus.

**Parts cibles : réelle, cible, écart.** La part réelle d'un titre additionne ses lignes dans tous les comptes, puis la divise par la valeur de toutes les lignes. La cible est la part cible du titre, qui vaut pour l'ensemble de vos comptes. L'écart est la part réelle moins la cible. Exemple : un ETF Monde à 70 % de cible, détenu pour 600 € dans le PEA et 400 € dans un compte-titres, sur 1 400 € d'actions en tout : part réelle 71,4 %, écart +1,4 %.

**Achat conseillé (PEA).** Hamac compte les mois écoulés depuis le premier mois des versements (Paramètres › Plan), mois en cours compris. Il divise les espèces du PEA par le nombre de mois qui restent sur la durée choisie pour le compte. Une fois cette durée écoulée, il conseille d'investir toutes les espèces. Exemple : 1 200 € d'espèces, durée 12 mois, 4 mois écoulés : 1 200 ÷ 8 = 150 € ce mois-ci.

**Répartition de l'achat conseillé.** Hamac calcule, pour chaque titre qui a une part cible, la valeur qu'il devrait avoir après l'achat, et lui donne une part du montant proportionnelle à ce qui lui manque. Un titre déjà au-dessus de sa cible ne reçoit rien. Exemple : 300 € à investir, deux ETF à 50 % chacun, valant 700 € et 300 € : après achat le total ferait 1 300 €, soit 650 € chacun visés ; le premier ne manque de rien, le second reçoit les 300 €.

**Si les actions baissent.** Valeur de toutes les lignes × 30 % (puis × 50 %). La part du patrimoine rapporte cette perte au total de vos comptes.

**Frais de gestion des ETF.** Pour chaque ETF : valeur × frais annuels (TER), additionnés. Ces frais sont déjà déduits du cours : ce n'est pas une dépense à ajouter.

La date des 5 ans du PEA, le gain du compte et sa grille de courtage sont sur la [page du compte](../comptes/guide.md#la-page-dun-compte).

## Limites

- Les cours viennent de sources publiques et peuvent manquer ou avoir un jour de retard. Un titre sans ISIN ni symbole doit avoir son cours saisi à la main.
- La part du patrimoine des chiffres « Valeur des actions et ETF » et « Si les actions baissent » se calcule sur le total de vos comptes, sans l'immobilier ni les autres biens.
- Les parts cibles sont communes à tous vos comptes : l'achat conseillé du PEA les répartit entre tous les titres qui ont une cible, même ceux que le PEA ne détient pas encore.
- Le nombre de mois pour investir l'apport ne se règle que pour un PEA. Pour un PEA-PME, Hamac compte un mois : l'achat conseillé est alors toutes les espèces.
- Les seuils de baisse (30 % et 50 %) sont des valeurs fixes : la page ne propose pas de les changer.
- Le courtage payé ne compte que les frais inclus dans les achats et ventes de ces titres, pas les opérations « Frais » du Journal.
- La page ne calcule pas l'impôt sur les ventes : voir la page Impôts.
