# Journal : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

Le Journal liste toutes les opérations de vos comptes : apports, versements, retraits, achats, ventes, intérêts, dividendes, arbitrages, transferts, frais, impôts et corrections. C'est la seule saisie du quotidien. Hamac calcule tout le reste à partir de lui : valeur des comptes, plus-values, historique, impôts.

Les versements mensuels programmés (page [Versements](../versements/guide.md)) y apparaissent aussi, dès que leur jour de prélèvement est passé. Hamac les calcule : vous ne les saisissez pas.

Tant qu'aucun compte n'existe, la page affiche l'accueil « Bienvenue dans Hamac », qui propose de créer vos premiers comptes.

La page est la même en format « retraite » et en format « patrimoine ».

## Ce que vous y voyez

### En-tête

Trois boutons :

- **Importer** : lit un relevé de banque ou de courtier (CSV, OFX ou QIF).
- **Exporter** : télécharge en CSV les opérations affichées, filtres compris.
- **Nouvelle opération** : ouvre la fenêtre de saisie.

### Barre de filtres

- Une **recherche** dans le commentaire, le nom du titre, le nom du compte et le type d'opération.
- Le **compte** : une opération apparaît aussi sur le compte d'arrivée d'un transfert.
- Le **type d'opération**.
- L'**année**.
- Une **pastille de période** (« Du … au … ») quand vous arrivez depuis la page Historique. La croix la retire.
- À droite, le **nombre d'opérations** affichées.

### Tableau des opérations

Une ligne par opération, de la plus récente à la plus ancienne. Un clic sur un en-tête trie la colonne.

| Colonne | Contenu |
|---|---|
| Date | Date de l'opération. |
| Compte | Le compte, suivi de « → compte d'arrivée » pour un transfert. |
| Opération | Le type. Une petite icône de calendrier signale un versement programmé. |
| Titre | Le titre concerné. Pour un arbitrage : « support cédé → support reçu ». Pour un transfert vers un contrat : « → fonds euros d'arrivée ». |
| Montant | Positif et en vert pour l'argent qui entre, négatif et en rouge pour celui qui sort. Un achat et un transfert sont négatifs, sans couleur. Un arbitrage n'a pas de signe : l'argent reste dans le compte. |
| Quantité | Parts, unités de crypto, ou nominal d'une obligation. |
| dont frais | Les frais compris dans un achat, une vente ou un arbitrage. |
| Commentaire | Votre note, ou le libellé du relevé importé. |

Au survol d'une ligne apparaissent ses actions :

- opération saisie : un **crayon** (modifier) et une **corbeille** (supprimer, après confirmation) ;
- versement programmé : un **crayon** qui ouvre la page Versements, et un **calendrier barré** qui déclare ce mois manqué.

Un double-clic sur une ligne fait la même chose que le crayon.

## Comment faire

### Noter une opération

1. Cliquez sur **Nouvelle opération**.
2. Choisissez la **date** et le **compte**.
3. Choisissez l'**opération**. Seuls les types possibles sur ce compte sont proposés : pas d'achat sur un livret, pas d'arbitrage sur un PEA. Une aide sous la liste rappelle ce qu'il faut indiquer.
4. Remplissez les champs qui apparaissent, puis **Enregistrer**.

« Enregistrer et saisir une autre » garde le compte, le type, la date et le titre : pratique pour une série d'opérations.

Les erreurs ne s'affichent qu'à l'envoi, sous le champ concerné.

Dans tous les champs de montant, vous pouvez taper un calcul qui commence par **=**, comme dans un tableur : `=120+35,50-10` donne 145,50 €. Le résultat est arrondi au centime ; seul lui est enregistré.

| Ce qui s'est passé | Opération | Montant à indiquer |
|---|---|---|
| De l'argent déjà présent au début du suivi | Apport initial | La somme |
| Un virement en plus des versements mensuels | Versement | La somme versée |
| De l'argent retiré | Retrait | La somme retirée |
| De l'argent déplacé d'un compte à un autre | Transfert, puis le compte d'arrivée | La somme, sur une seule ligne |
| Un achat de parts, d'actions ou de crypto | Achat | Le total payé, frais compris |
| Une vente | Vente | Le total reçu, frais déduits |
| Des intérêts ou un coupon | Intérêts / coupon | Ce qui est arrivé sur le compte |
| Un dividende | Dividende | Ce qui est arrivé sur le compte |
| Des frais facturés à part | Frais | La somme prélevée |
| Des impôts débités à part | Impôts | La somme prélevée |
| La valeur réelle diffère du calcul | Correction | L'écart, négatif si besoin |

Pour un **retrait**, Hamac affiche sous le montant l'argent **disponible** sur le compte à la date choisie. Dans une assurance-vie ou un PER, c'est ce qu'il y a sur le fonds euros choisi dans « Support ». Le bouton **Tout retirer** remplit le montant avec ce solde. Si vous indiquez plus que le solde, un avertissement apparaît, mais vous pouvez quand même enregistrer : c'est souvent le signe qu'un versement manque dans le journal.

Les intérêts d'un livret ou d'un fonds euros se datent du 31 décembre. De janvier à mars, le tableau de bord rappelle ceux d'un livret ou d'une assurance-vie qui manquent pour l'année écoulée.

### Acheter ou vendre un titre

1. Choisissez **Achat** ou **Vente**, puis le **titre**.
2. Indiquez la **quantité**.
3. Remplissez **soit le prix par unité, soit le montant total** : l'autre se calcule.
4. Les **frais** se calculent seuls d'après la grille de l'établissement (Paramètres › Établissements), ou d'après les frais par défaut s'il n'y en a pas. Si vous les modifiez, Hamac ne les recalcule plus.

Quand des frais existent, la fenêtre affiche aussi le prix unitaire frais compris.

Pour une **obligation**, la fenêtre demande le **nominal** (la somme remboursée à l'échéance), le **prix en % du nominal** et les frais. Elle calcule le **coupon couru** (les intérêts dus au vendeur depuis le dernier coupon) et le total.

### Acheter un titre pas encore connu

Dans la liste des titres, choisissez **« ＋ Nouveau titre »**. Un panneau permet de le décrire. Le titre et l'opération sont enregistrés ensemble : si l'opération est refusée, le titre n'est pas créé.

Depuis le Journal, les titres proposés sont ceux que le type de compte peut détenir. Un fonds euros n'est jamais proposé à l'achat : il se remplit par des versements.

### Déplacer de l'argent entre deux comptes

Choisissez **Transfert** sur le compte de départ, puis le compte d'arrivée dans **« Vers le compte »**. Il doit être différent. Une seule ligne suffit : elle fait baisser le premier compte et monter le second.

### Passer d'un support à un autre dans un contrat (arbitrage)

L'arbitrage existe pour l'assurance-vie, le PER, l'épargne salariale et les plateformes crypto.

1. Choisissez **Arbitrage**.
2. Indiquez le **support cédé** et le **support reçu**, qui doivent être différents.
3. Indiquez la **quantité** de chaque côté, sauf pour un fonds euros, qui se compte en euros.
4. Indiquez la **valeur de l'échange** en euros, telle que sur l'avis d'arbitrage, et les frais éventuels.

Une obligation n'est pas proposée : elle s'achète et se vend.

### Choisir le fonds euros d'un contrat

Dans un contrat d'assurance-vie ou de PER assurantiel, un champ **Support** apparaît pour les apports, versements, retraits, intérêts, frais, impôts, corrections et transferts. Laissé sur « Support par défaut », l'argent va au fonds euros par défaut du contrat. Vous pouvez aussi choisir un autre fonds euros, ou en créer un avec **« ＋ Nouveau fonds euros »** (à la création seulement).

Pour le coupon d'une obligation détenue dans le contrat, laissez le support par défaut et choisissez l'obligation dans « Titre concerné ».

### Noter le détail fiscal d'un dividende ou d'intérêts

Sur un compte-titres ou une plateforme de crowdlending, un bloc **« Détail fiscal (facultatif) »** apparaît pour un dividende ou des intérêts : revenu brut, acompte d'impôt, prélèvements sociaux et retenue à l'étranger, tels que sur le relevé. Le montant reste le net reçu.

Le bouton **« Calculer d'après les taux »** remplit ces champs à partir des taux de l'établissement ou de Paramètres › Plan. Si le brut moins les retenues ne tombe pas sur le montant reçu, un message signale l'écart.

### Corriger un écart avec la valeur réelle

Si la valeur relevée chez l'établissement diffère du calcul, ajoutez une **Correction** du montant de l'écart. Elle peut être négative. Elle ne peut pas être nulle.

### Modifier ou supprimer une opération

Survolez la ligne, puis cliquez sur le crayon ou la corbeille. La suppression demande confirmation. Tous les calculs, l'historique compris, suivent aussitôt.

### Un versement programmé n'a pas eu lieu

Sur la ligne du versement programmé, cliquez sur le **calendrier barré**, puis confirmez. Le mois est déclaré manqué pour tout son montant. Pour un montant partiel ou pour changer le montant mensuel, passez par la page Versements.

### Importer un relevé

1. Exportez vos opérations depuis le site de votre banque ou courtier, en **CSV, OFX ou QIF**.
2. Cliquez sur **Importer**, puis **Choisir un fichier**. Le format est reconnu tout seul.
3. Choisissez le **compte concerné**.
4. Choisissez le **type d'opération** : « Deviner d'après le libellé et le signe », ou un type imposé à toutes les lignes.
5. Pour un **CSV**, indiquez à quoi sert chaque colonne (date, montant signé, débit, crédit, libellé, type, quantité, ISIN, titre, frais). Hamac propose un choix d'après les en-têtes.
6. Si des **titres non reconnus** sont signalés, associez chacun à un titre existant, ou créez-le avec son type.
7. Vérifiez l'aperçu, cochez ou décochez des lignes, puis **Importer**.

Dans l'aperçu, chaque ligne a un état :

| État | Signification | Cochée par défaut |
|---|---|---|
| Nouveau | Rien de semblable au journal. | Oui |
| Déjà au journal | Une opération identique existe déjà, ou un transfert correspondant. | Non |
| Déjà programmé | Ce versement égale le versement programmé de ce mois : Hamac le compte déjà. | Non |
| ⚠ message | Une information manque ou est refusée (date, montant, titre…). | Impossible à cocher |

Hamac retient, pour un même format de fichier CSV (mêmes en-têtes) ou un même compte OFX, le rôle des colonnes, le compte choisi et le type imposé. Le prochain import les reprend.

### Exporter

**Exporter** télécharge un fichier `hamac-journal-<date>.csv` avec les opérations affichées : date, compte, opération, titre, ISIN, montant, quantité, frais, compte d'arrivée et commentaire. Les filtres s'appliquent, les versements programmés affichés sont inclus.

## Comprendre les chiffres

**Le sens d'un montant.** Un montant est toujours positif : le type d'opération dit si l'argent entre ou sort. Seule la correction peut être négative.

**Achat et vente.** Le montant d'un achat est le total débité, frais compris. Celui d'une vente est le total reçu, frais déduits. Exemple fictif : 10 parts à 50 € et 2 € de frais font un achat de 502 € ; la même vente donne 498 €.

**Obligation.** Total d'un achat = nominal × prix ÷ 100 + coupon couru + frais. Exemple fictif : nominal 1 000 €, prix 98 %, coupon couru 10 €, frais 2 € : 992 €. À la vente, les frais se retranchent.

**Versements programmés.** Le versement d'un mois apparaît une fois son jour de prélèvement passé (Paramètres › Plan, « Jour des versements »). Un mois manqué en partie apparaît pour la somme réellement versée, avec « … € manqués ce mois » en commentaire. Un mois manqué en entier n'apparaît pas.

**Plusieurs opérations le même jour.** Hamac les traite dans un ordre fixe : apports et versements d'abord, puis transferts, revenus, corrections, ventes, arbitrages, achats, et enfin retraits, frais et impôts. Un versement et un achat du même jour ne créent donc pas d'espèces négatives.

**Doublons à l'import.** Deux opérations sont jugées identiques quand elles ont la même date, le même type, le même montant au centime et le même titre, sur le même compte. Chaque opération déjà au journal n'excuse qu'une ligne du relevé : deux lignes identiques d'un relevé restent deux opérations. Un transfert est reconnu s'il a le même montant et une date proche de trois jours au plus.

**Type deviné.** Hamac lit le libellé (« achat », « dividende », « coupon », « frais », « prélèvements sociaux »…) et le signe du montant. Quand le relevé contient des débits, le sens de l'argent l'emporte sur le libellé : un « remboursement de frais » crédité devient une correction.

## Limites

- Un versement programmé ne se modifie pas ici : il se règle dans Versements.
- L'import ne crée pas de transfert, ne permet pas de choisir un fonds euros (l'argent d'un contrat va à son fonds par défaut) et ne crée pas d'obligation depuis l'aperçu (elles s'ajoutent dans Paramètres › Actifs).
- Un versement importé dont le montant diffère du versement programmé du mois n'est pas repéré : vérifiez-le.
- L'aperçu montre les 300 premières lignes. Les lignes suivantes sont importées selon leur état par défaut, sans pouvoir les décocher.
- Le détail fiscal ne s'affiche que sur un compte-titres ou une plateforme de crowdlending.
- Pour un achat d'unités de compte dans une assurance-vie ou un PER, les frais proposés sont les frais par défaut des paramètres, pas ceux de l'établissement.
- L'export CSV ne contient pas le support reçu ni les quantités d'un arbitrage, ni le détail fiscal. Les lignes n'y suivent pas forcément le tri affiché.
- La recherche ne regarde pas le support reçu d'un arbitrage ni le fonds d'arrivée d'un transfert.
