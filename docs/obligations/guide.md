# Obligations : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Obligations** (menu Placements) suit les obligations à taux fixe que vous gardez jusqu'à leur échéance : les obligations d'État (OAT de l'État français, OLO belges, Bund allemands…) et les obligations d'entreprise. Elle montre ce que vous détenez, les coupons à venir, le rendement de chaque ligne, et les achats que vous prévoyez.

Vous n'avez pas besoin de cours de bourse : Hamac calcule la valeur de chaque ligne à partir de son prix d'achat, de son coupon et de son échéance. À l'échéance, il compte tout seul le remboursement du nominal.

Quelques mots utilisés sur la page :

- **Nominal** : la somme que l'émetteur vous rembourse à l'échéance. Hamac compte une obligation en euros de nominal : 5 000 € de nominal, c'est 5 000 € remboursés à l'échéance.
- **Coupon** : l'intérêt annuel, en pourcentage du nominal. Une OAT à 3 % sur 5 000 € de nominal verse 150 € par an.
- **Échéance** : la date du remboursement. Les OAT françaises arrivent à échéance le 25 du mois ; les autres États ont leurs propres dates (une OLO belge tombe souvent le 22).
- **Prix en % du nominal** : une obligation s'achète à un prix exprimé en pourcentage. À 96 %, 5 000 € de nominal coûtent 4 800 € (hors coupon couru et frais). En dessous de 100 %, on dit « sous le pair ».
- **Coupon couru** : la part du prochain coupon déjà accumulée depuis le dernier versement. À l'achat, vous la payez au vendeur ; vous la récupérez avec le coupon suivant.
- **Rendement à l'échéance** : le rendement annuel réel de votre achat si vous gardez la ligne jusqu'au bout, frais compris. Il tient compte des coupons et de l'écart entre le prix payé et les 100 % remboursés.

Si vous préparez votre retraite (format « retraite »), la page montre aussi votre âge à chaque échéance. En format « patrimoine », l'âge n'apparaît nulle part sur la page. Elle disparaît du menu si vous masquez le module « Obligations » dans Paramètres › Plan › Modules. Sans aucun compte, elle affiche l'écran d'accueil.

## Ce que vous y voyez

En haut, le bouton **Ajouter une opération** (un achat d'obligation sur votre premier compte-titres). Si vous n'avez pas de compte-titres, un encadré vous propose d'en créer un : les obligations se détiennent dans un compte-titres, ou dans une assurance-vie.

**Les comptes concernés** : une carte par compte qui détient des obligations (ou par compte-titres, tant que vous n'en avez aucune), avec son nominal et, pour un compte-titres, ses espèces. Le nom du compte ouvre sa [page](../comptes/guide.md#la-page-dun-compte).

**Huit chiffres**, sur deux rangées. La première dit ce que vous détenez et ce que cela rapporte :

- **Nominal détenu** : le total du nominal de vos lignes, et en dessous ce qu'elles vous ont coûté.
- **Coupons annuels bruts** : ce que vos lignes versent par an avant impôts, et en dessous le rendement actuariel moyen (le rendement à l'échéance).
- **Rendement net de fiscalité** : le même rendement, une fois déduits les impôts sur les coupons et sur la prime de remboursement (l'écart entre les 100 % remboursés et le prix payé). En dessous, la fiscalité restant due. Passez la souris sur la tuile (ou sélectionnez-la au clavier) pour voir le détail : l'impôt sur les coupons à venir et l'impôt sur les primes de remboursement, chacun avec son taux.
- **Performance cumulée** : les plus-values latentes de vos lignes, les plus-values réalisées (lignes remboursées ou vendues) et les coupons perçus. En dessous, la part des coupons.

La seconde dit ce qui arrive :

- **Flux à 12 mois** : les coupons et les remboursements des douze prochains mois, c'est-à-dire l'argent à réinvestir bientôt.
- **Prochaine échéance** : la date du prochain remboursement, et en dessous la date et le montant brut du prochain coupon.
- **Coupons perçus** : les coupons notés dans le Journal, comparés aux coupons échus, ceux que vos lignes ont dû verser jusqu'à aujourd'hui. Si un coupon manque, la tuile passe en orange et indique combien ne sont pas saisis.
- **Espèces en attente** : l'argent non investi des comptes-titres qui détiennent des obligations (tous vos comptes-titres tant que vous n'en avez aucune). Un compte-titres qui détient aussi des actions affiche le même montant ici et dans Actions & ETF : c'est de l'argent disponible pour l'une ou l'autre. Le chiffre passe en orange au-delà du seuil d'alerte réglé dans Paramètres › Plan › Seuils d'alerte (« Espèces du compte-titres à investir », 1 000 € par défaut), avec la mention « De quoi acheter une ligne ».

**L'acompte sur les coupons**, sous les chiffres : pour l'année en cours, chaque courtier qui prélève les impôts est marqué « dispensé » ou « retenu » (acompte de 12,8 %), avec un lien vers la page Impôts où la dispense se coche, année par année et établissement par établissement. De septembre au 30 novembre, la ligne rappelle de demander la dispense pour l'année suivante.

**Le tableau de vos obligations**, dans cet ordre :

Chaque ligne indique son **compte** : un clic sur son nom ouvre la page du compte. Une obligation d'État porte le drapeau de son pays devant son nom.

1. les lignes **détenues**, triées par échéance : nom ; compte ; mois d'échéance ; taux du coupon ; nominal ; coût frais compris ; valeur ; plus-value ; rendement à l'échéance ; votre âge à l'échéance (format retraite seulement) ; années restantes. Cliquez sur un en-tête pour trier. Cliquez sur une ligne pour la déplier : coupon annuel brut (nominal × taux, et le nombre de détachements par an), prix d'achat pied de coupon en % du nominal, coupon couru du jour, coupons perçus (et ceux non saisis), performance cumulée, rendement net de fiscalité, puis l'évolution de la ligne ;
2. les lignes **prévues** : votre libellé, l'année visée, le nominal, votre âge cette année-là (format retraite seulement), un lien pour saisir l'achat et un bouton pour supprimer la ligne ;
3. les lignes **échues** (barrées) : date d'échéance, coupon, la plus-value réalisée au remboursement avec les coupons perçus, et le rendement réalisé.

**Six graphiques** (passez la souris pour les montants) :

- **Échéancier des remboursements** : le nominal remboursé chaque année, États et entreprises, et vos achats prévus en pointillés. Les années vides se voient : ce sont les trous à combler. En format retraite, votre âge est sous chaque année et l'année de la retraite est marquée.
- **Échéancier des flux** : coupons et remboursements au pair, année par année.
- **Évolution de l'encours** : une barre pour aujourd'hui, puis une au 31 décembre de chaque année jusqu'à la dernière échéance, en deux parts : l'**encours** (l'argent encore placé dans vos lignes) et les **flux encaissés** (coupons et remboursements, détaillés au survol). D'année en année, l'encours se transforme en flux encaissés ; la hauteur de la barre, c'est tout ce que vos obligations actuelles vous auront donné à cette date.
- **Coupons perçus et échus** : chaque année, la barre pleine montre les coupons perçus (notés dans le Journal), le contour en pointillés les coupons échus. Une barre plus basse que son contour signale un coupon non saisi.
- **Répartition par émetteur** : la part des États et des entreprises, votre premier émetteur, puis le nominal de chaque émetteur. Chaque État compte à part et se reconnaît à son drapeau, suivi du nom du pays.
- **Rendement actuariel par maturité** : un point par ligne, plus gros quand le nominal est plus grand. Vous voyez si vos lignes longues rapportent vraiment plus que les courtes.

**Prévoir un achat** : un petit formulaire pour ajouter une ligne prévue (libellé, année d'échéance visée, nominal).

**Un rappel** : un coupon n'est pas un rendement. Achetée sous le pair, une obligation rapporte plus que son coupon. En format retraite, le rappel donne aussi une piste pour l'échéance : avant l'âge de sécurisation, racheter une ligne plus longue ; après, transférer vers le fonds euros.

**Les mouvements** de vos comptes-titres (obligations et espèces), repris du Journal.

## Comment faire

**Acheter une obligation.** Cliquez sur « Ajouter une opération ». Choisissez le titre, ou « Nouvelle obligation » : indiquez le type (obligation d'État ou d'entreprise), le coupon et l'échéance. Pour une obligation d'État, choisissez le pays dans la liste : tapez quelques lettres (« belg ») puis cliquez sur le pays ou validez avec Entrée ; la France est proposée d'abord, et un ISIN saisi désigne le pays tout seul (BE… pour la Belgique). Pour une entreprise, indiquez l'émetteur. L'échéance se donne en mois et année pour une OAT (remboursée le 25) ou une entreprise, et à la date exacte pour un autre État. Le nom se forme tout seul (« OAT 3 % mai 2033 », « OLO 3 % juin 2033 »). La recherche par ISIN peut remplir ces champs, pays compris. Saisissez ensuite le nominal et le prix en % du nominal : Hamac calcule le coupon couru, propose les frais et donne le total débité (nominal × prix + coupon couru + frais). Le coupon couru se corrige comme les frais : tapez le montant de votre avis d'opéré s'il diffère (jours comptés autrement par la banque, par exemple) ; « Calculer » revient au calcul. Si une obligation identique existe déjà (même ISIN, ou même émetteur, coupon et échéance ; pour un État, le même pays), Hamac propose de la reprendre.

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

**Âge à l'échéance.** L'année d'échéance moins votre année de naissance (Paramètres › Plan). Format retraite seulement.

**Rendement net de fiscalité.** Le rendement à l'échéance, une fois retirés les impôts. Sur un compte-titres : les coupons sont imposés à 12,8 % (ou à votre tranche si elle est plus basse) plus les prélèvements sociaux, et le gain au remboursement (100 % moins ce que vous avez payé) de la même façon. Exemple fictif : 10 000 € de nominal achetés 9 600 €, coupon 3 % sur 5 ans ; avec 12,8 % + 18,6 %, le rendement passe d'environ 3,9 % à environ 2,7 %. Dans une assurance-vie, l'impôt dépend de l'âge du contrat (12,8 % avant 8 ans, 7,5 % après) plus 17,2 % de prélèvements sociaux ; Hamac ne compte pas l'abattement annuel. Une obligation achetée au-dessus de 100 % ne crée pas de gain : rien n'est compté sur son remboursement.

**Coupons perçus et échus.** Hamac retrouve les dates de coupon de chaque ligne et le nominal que vous déteniez la veille. Un coupon noté dans le Journal jusqu'à 15 jours avant ou 45 jours après la date est rapproché. Les coupons des 10 derniers jours ne sont pas encore réclamés. Le montant pris est le brut si vous l'avez rempli dans le détail fiscal, sinon le montant reçu.

**Rendement réalisé (ligne échue).** Le rendement annuel de ce que vous avez vraiment payé et reçu : achats, coupons notés, remboursement. Un coupon oublié le fait baisser.

**À l'échéance.** Le nominal revient en espèces sur le compte le jour de l'échéance. Le gain affiché sur la ligne échue est le nominal moins le coût ; les coupons reçus n'y sont pas, ils sont dans les intérêts du compte.

## Limites

- Seules les obligations à taux fixe gardées jusqu'à l'échéance sont bien suivies. La valeur calculée n'est pas un prix de marché : si les taux bougent, une revente avant l'échéance peut se faire à un autre prix.
- Les coupons reçus se saisissent à la main. Le prochain coupon affiché est une prévision.
- La valeur monte en ligne droite vers 100 % : c'est une approximation simple, pas la méthode actuarielle.
- Le chiffre « Espèces en attente » ne porte que sur les comptes-titres, même si vous détenez des obligations dans une assurance-vie. Les mouvements affichés sont ceux de vos obligations (achats, coupons, remboursements), sans les versements ni les opérations sur actions du même compte.
- Le rendement après impôts est une estimation : il suppose les taux d'aujourd'hui jusqu'à l'échéance, ne compte pas l'abattement de l'assurance-vie, et ne déduit pas une perte au remboursement de vos autres plus-values.
- La trajectoire suppose que vous gardez chaque ligne jusqu'au bout et ne compte pas le placement des coupons et des remboursements.
- Une ligne prévue ne devient pas un achat toute seule : il faut saisir l'achat, puis supprimer la ligne prévue.
- Le rappel sur l'âge de sécurisation s'affiche aussi dans le format « patrimoine », où ce réglage n'existe pas.
- La page ne calcule pas l'impôt sur les coupons : voir la page Impôts.

**Corriger le pays d'une obligation d'État.** Ouvrez la fiche du titre (Paramètres › Titres, ou le nom du titre) : le champ « Pays de l'État émetteur » se cherche de la même façon. Les obligations d'État saisies avant ce choix ont reçu le pays de leur ISIN, sinon la France. Si le pays est faux, corrigez-le, puis vérifiez la date d'échéance et le nom : une OLO enregistrée comme OAT avait reçu le 25 du mois.
