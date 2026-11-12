# Obligations : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Obligations** (menu Placements) suit les obligations à taux fixe que vous gardez jusqu'à leur échéance : les OAT (emprunts de l'État français) et les obligations d'entreprise. Elle montre ce que vous détenez, les coupons à venir, le rendement de chaque ligne, et les achats que vous prévoyez.

Vous n'avez pas besoin de cours de bourse : Hamac calcule la valeur de chaque ligne à partir de son prix d'achat, de son coupon et de son échéance. À l'échéance, il compte tout seul le remboursement du nominal.

Quelques mots utilisés sur la page :

- **Nominal** : la somme que l'émetteur vous rembourse à l'échéance. Hamac compte une obligation en euros de nominal : 5 000 € de nominal, c'est 5 000 € remboursés à l'échéance.
- **Coupon** : l'intérêt annuel, en pourcentage du nominal. Une OAT à 3 % sur 5 000 € de nominal verse 150 € par an.
- **Échéance** : la date du remboursement. Les OAT arrivent à échéance le 25 du mois.
- **Prix en % du nominal** : une obligation s'achète à un prix exprimé en pourcentage. À 96 %, 5 000 € de nominal coûtent 4 800 € (hors coupon couru et frais). En dessous de 100 %, on dit « sous le pair ».
- **Coupon couru** : la part du prochain coupon déjà accumulée depuis le dernier versement. À l'achat, vous la payez au vendeur ; vous la récupérez avec le coupon suivant.
- **Rendement à l'échéance** : le rendement annuel réel de votre achat si vous gardez la ligne jusqu'au bout, frais compris. Il tient compte des coupons et de l'écart entre le prix payé et les 100 % remboursés.

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu si vous masquez le module « Obligations » dans Paramètres › Plan › Modules. Sans aucun compte, elle affiche l'écran d'accueil.

## Ce que vous y voyez

En haut, le bouton **Ajouter une opération** (un achat d'obligation sur votre premier compte-titres). Si vous n'avez pas de compte-titres, un encadré vous propose d'en créer un : les obligations se détiennent dans un compte-titres, ou dans une assurance-vie.

**Quatre chiffres** :

- **Nominal détenu** : le total du nominal de vos lignes, et en dessous ce qu'elles vous ont coûté.
- **Coupons annuels bruts** : ce que vos lignes versent par an avant impôts, et en dessous le rendement à l'échéance moyen.
- **Prochaine échéance** : la date du prochain remboursement, et en dessous la date et le montant brut du prochain coupon.
- **Espèces en attente** : l'argent non investi de vos comptes-titres. Le chiffre passe en orange au-delà du seuil d'alerte réglé dans Paramètres › Plan › Seuils d'alerte (« Espèces du compte-titres à investir », 1 000 € par défaut), avec la mention « De quoi acheter une ligne ».

**Le tableau de vos obligations**, dans cet ordre :

1. les lignes **détenues**, triées par échéance : nom, type (OAT ou entreprise) et ISIN ; échéance ; coupon et prochain coupon ; nominal ; coût frais compris ; valeur ; plus-value ; rendement à l'échéance ; votre âge à l'échéance ; années restantes. Cliquez sur un en-tête pour trier, sur une ligne pour déplier son évolution ;
2. les lignes **prévues** : votre libellé, l'année visée, le nominal, votre âge cette année-là, un lien pour saisir l'achat et un bouton pour supprimer la ligne ;
3. les lignes **échues** (barrées) : date d'échéance, coupon, et le gain réalisé au remboursement.

**Prévoir un achat** : un petit formulaire pour ajouter une ligne prévue (libellé, année d'échéance visée, nominal).

**Un rappel** : un coupon n'est pas un rendement. Achetée sous le pair, une obligation rapporte plus que son coupon. Le rappel donne aussi une piste pour l'échéance : avant l'âge de sécurisation, racheter une ligne plus longue ; après, transférer vers le fonds euros.

**Les mouvements** de vos comptes-titres (obligations et espèces), repris du Journal.

## Comment faire

**Acheter une obligation.** Cliquez sur « Ajouter une opération ». Choisissez le titre, ou « Nouvelle obligation » : indiquez le type (OAT ou entreprise), le coupon, le mois d'échéance, l'émetteur pour une entreprise. Le nom se forme tout seul (« OAT 3 % mai 2033 »). La recherche par ISIN peut remplir ces champs. Saisissez ensuite le nominal et le prix en % du nominal : Hamac calcule le coupon couru, propose les frais et donne le total débité (nominal × prix + coupon couru + frais). Si une obligation identique existe déjà (même ISIN, ou même émetteur, coupon et échéance), Hamac propose de la reprendre.

**Noter un coupon reçu.** Dans le Journal, ajoutez une opération « Intérêts / coupon » sur le compte et choisissez l'obligation. Les coupons ne s'ajoutent pas tout seuls.

**Prévoir un achat.** Dans « Prévoir un achat », donnez un libellé (par exemple « Échéance vers 2034 »), l'année visée et le nominal, puis Ajouter. Le jour de l'achat, cliquez sur l'icône du panier de la ligne prévue pour ouvrir la saisie, puis supprimez la ligne prévue.

**Indiquer une date de coupon.** Si le calendrier des coupons ne correspond pas à l'échéance (premier coupon décalé, coupon semestriel), renseignez une date de coupon connue et le nombre de coupons par an sur la fiche du titre (Paramètres › Actifs).

**Utiliser un cours à la place du calcul.** Sur la fiche du titre, choisissez la source « saisi à la main » et indiquez le cours en % du nominal, sans le coupon couru. Hamac l'utilise alors à la place de la valeur calculée.

## Comprendre les chiffres

**Coût.** Le total débité à l'achat : prix, coupon couru et frais. Plusieurs achats de la même ligne s'additionnent.

**Valeur.** Pour chaque achat, Hamac part du prix payé (sans les frais ni le coupon couru) et le fait monter ou descendre en ligne droite jusqu'à 100 % le jour de l'échéance. Il ajoute le coupon couru du jour. Exemple : 10 000 € de nominal achetés à 96 % pour une échéance à 4 ans ; deux ans plus tard, le prix compté est 98 %, soit 9 800 €, plus le coupon couru.

**Plus-value.** Valeur moins coût. Juste après l'achat, elle est légèrement négative : les frais sont dans le coût, pas dans la valeur.

**Coupons annuels bruts.** Nominal × taux du coupon, pour chaque ligne, additionnés.

**Prochain coupon.** Hamac retrouve le calendrier des coupons à partir de l'échéance (ou de la date de coupon indiquée). Si plusieurs lignes versent un coupon le même jour, leurs montants s'additionnent. Un dernier coupon peut être réduit si le remboursement tombe en cours de période.

**Rendement à l'échéance.** Le taux annuel qui égalise le prix payé (frais et coupon couru compris) et tous les coupons restants plus le remboursement à 100 %, chacun ramené à sa date. Pour une ligne achetée en plusieurs fois, c'est la moyenne des achats, pondérée par leur coût. La moyenne du haut de page est pondérée de la même façon.

**Âge à l'échéance.** L'année d'échéance moins votre année de naissance (Paramètres › Plan).

**À l'échéance.** Le nominal revient en espèces sur le compte le jour de l'échéance. Le gain affiché sur la ligne échue est le nominal moins le coût ; les coupons reçus n'y sont pas, ils sont dans les intérêts du compte.

## Limites

- Seules les obligations à taux fixe gardées jusqu'à l'échéance sont bien suivies. La valeur calculée n'est pas un prix de marché : si les taux bougent, une revente avant l'échéance peut se faire à un autre prix.
- Les coupons reçus se saisissent à la main. Le prochain coupon affiché est une prévision.
- La valeur monte en ligne droite vers 100 % : c'est une approximation simple, pas la méthode actuarielle.
- Le chiffre « Espèces en attente » et les mouvements ne portent que sur les comptes-titres, même si vous détenez des obligations dans une assurance-vie.
- Une ligne prévue ne devient pas un achat toute seule : il faut saisir l'achat, puis supprimer la ligne prévue.
- Le rappel sur l'âge de sécurisation s'affiche aussi dans le format « patrimoine », où ce réglage n'existe pas.
- La page ne calcule pas l'impôt sur les coupons : voir la page Impôts.
