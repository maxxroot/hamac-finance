# Actions & ETF : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Actions & ETF** (menu Placements) montre les actions, les ETF, les fonds et les ETC que vous détenez, compte par compte : combien de parts, combien vous les avez payées, ce qu'elles valent aujourd'hui et ce que vous avez gagné ou perdu. Pour le PEA, elle propose aussi le montant à investir ce mois-ci et sa répartition entre vos titres.

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

Puis un bloc par compte, dans cet ordre :

1. le PEA (et le PEA-PME) ;
2. chaque compte-titres qui contient au moins une action, un ETF ou un fonds ;
3. chaque assurance-vie, PER ou plan d'épargne salariale qui contient au moins une action, un ETF ou un fonds.

Les comptes archivés ne sont pas affichés. Les comptes-titres sans action ni ETF (par exemple un compte qui ne contient que des obligations) sont regroupés en bas, dans une version courte : nom, établissement, espèces, et un bouton **Acheter des actions ou ETF**.

### Dans chaque bloc

**L'en-tête** donne le nom du compte et son établissement, un bouton pour modifier le compte et un bouton **Évolution** qui déplie la courbe du compte, mois par mois, avec une courbe par titre.

**Quatre chiffres** :

- **Valeur totale** : la valeur du compte (titres et espèces), et sa part dans le total de vos comptes.
- **Gain / perte** : la valeur moins le versé net (vos versements moins vos retraits).
- **Espèces à investir** : l'argent non investi, et en dessous le versement mensuel programmé. Le chiffre passe en orange quand les espèces atteignent le seuil d'alerte réglé dans Paramètres › Plan › Seuils d'alerte (« Espèces du PEA à investir », 50 € par défaut), en rouge s'il est négatif.
- **Fiscalité allégée (5 ans)**, pour un PEA : la date des 5 ans, ou « depuis le … » si elle est passée, ou une invitation à renseigner la date d'ouverture. Pour les autres comptes, ce chiffre est remplacé par **Frais payés**.

**Un avertissement** apparaît si un titre n'a pas de cours : sa valeur affichée est alors son prix de revient.

**Le tableau des positions**, une ligne par titre : nom et ISIN, parts, PRU, investi, cours, valeur, plus-value en euros et en %, part réelle, cible, écart. Sous le cours, une petite mention indique d'où il vient (« marché », « manuel » ou « prix de revient ») et sa date. Cliquez sur un en-tête pour trier, sur une ligne pour déplier l'évolution du titre, sur un cours pour le saisir à la main. Une ligne **Total** termine le tableau.

**Trois cartes** :

- **Achat conseillé ce mois-ci** (PEA seulement) : le montant à investir ce mois-ci, puis sa répartition entre les titres qui ont une part cible.
- **Si les actions baissent** : ce que perdrait le compte si ses actions et ETF baissaient de 30 % puis de 50 %, en euros et en part de votre patrimoine. Une baisse n'est une perte que si l'on vend.
- **Frais** : le total des frais payés sur le compte, la grille de courtage qui s'applique (celle de l'établissement, sinon les frais par défaut), et les frais de gestion annuels des ETF.

**Les mouvements** du compte, repris du Journal (les 15 derniers), avec un bouton pour en ajouter. Pour un compte autre qu'un PEA, seuls les mouvements d'actions, d'ETF, de fonds et d'espèces sont montrés.

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

**Part réelle, cible, écart.** La part réelle est la valeur du titre divisée par la valeur de toutes les actions et ETF **de ce compte**. La cible est la part cible du titre. L'écart est la part réelle moins la cible.

**Gain / perte du compte.** Valeur du compte moins versé net. Ce chiffre comprend tout : plus-values, dividendes, frais, espèces.

**Achat conseillé (PEA).** Hamac compte les mois écoulés depuis le premier mois des versements (Paramètres › Plan), mois en cours compris. Il divise les espèces du PEA par le nombre de mois qui restent sur la durée choisie pour le compte. Une fois cette durée écoulée, il conseille d'investir toutes les espèces. Exemple : 1 200 € d'espèces, durée 12 mois, 4 mois écoulés : 1 200 ÷ 8 = 150 € ce mois-ci.

**Répartition de l'achat conseillé.** Hamac calcule, pour chaque titre qui a une part cible, la valeur qu'il devrait avoir après l'achat, et lui donne une part du montant proportionnelle à ce qui lui manque. Un titre déjà au-dessus de sa cible ne reçoit rien. Exemple : 300 € à investir, deux ETF à 50 % chacun, valant 700 € et 300 € : après achat le total ferait 1 300 €, soit 650 € chacun visés ; le premier ne manque de rien, le second reçoit les 300 €.

**Si les actions baissent.** Valeur des actions et ETF du compte × 30 % (puis × 50 %). La part du patrimoine rapporte cette perte au total de vos comptes.

**Frais de gestion des ETF.** Pour chaque ETF : valeur × frais annuels (TER), additionnés. Ces frais sont déjà déduits du cours : ce n'est pas une dépense à ajouter.

**Fiscalité allégée (5 ans).** Date d'ouverture du PEA + 60 mois.

## Limites

- Les cours viennent de sources publiques et peuvent manquer ou avoir un jour de retard. Un titre sans ISIN ni symbole doit avoir son cours saisi à la main.
- La part du patrimoine des chiffres « Valeur totale » et « Si les actions baissent » se calcule sur le total de vos comptes, sans l'immobilier ni les autres biens.
- Les parts cibles sont communes à tous vos comptes : l'achat conseillé du PEA les répartit entre tous les titres qui ont une cible, même ceux que le PEA ne détient pas encore.
- Le nombre de mois pour investir l'apport ne se règle que pour un PEA. Pour un PEA-PME, Hamac compte un mois : l'achat conseillé est alors toutes les espèces.
- Les seuils de baisse (30 % et 50 %) sont des valeurs fixes : la page ne propose pas de les changer.
- Le chiffre « Frais payés » et la ligne « Courtage payé » comprennent tous les frais du compte, y compris les opérations « Frais » du Journal, pas seulement le courtage.
- La page ne calcule pas l'impôt sur les ventes : voir la page Impôts.
