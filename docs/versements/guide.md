# Versements : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page Versements programme vos virements mensuels, compte par compte : « à partir de tel mois, tant par mois sur ce compte ». Hamac considère chaque mois écoulé comme versé, sans que vous le saisissiez. Vous déclarez seulement les mois où le virement n'a pas eu lieu.

Les versements ponctuels notés dans le [Journal](../journal/guide.md) s'ajoutent au calendrier, pour tout voir au même endroit.

Tant qu'aucun compte n'existe, la page affiche l'accueil « Bienvenue dans Hamac ».

La page diffère selon le format choisi dans Paramètres › Plan › Usage :

- en format « retraite », le calendrier va jusqu'à décembre de l'année de départ à la retraite ;
- en format « patrimoine », il va jusqu'à décembre, dix ans après l'année en cours (ou après le premier mois des versements s'il est plus tard).

## Ce que vous y voyez

### Les deux onglets

- **Gestion libre** : vous fixez le montant de chaque compte.
- **Gestion suggérée** : vous indiquez ce que vous pouvez épargner chaque mois, et Hamac propose un montant par compte.

Le choix est enregistré dans vos paramètres.

### En gestion libre : « Programmation »

- Le rappel du jour et du premier mois des versements (réglés dans Paramètres › Plan).
- Un formulaire : **compte**, **à partir de** (un mois), **montant par mois**, bouton **Programmer**.
- Pour chaque compte qui a un versement programmé : le montant **actuel** par mois, et chaque palier (« dès tel mois : tel montant ») avec une corbeille pour le retirer.

### En gestion suggérée : « Ma capacité d'épargne » et « Répartition suggérée »

- Le **montant que vous pouvez épargner chaque mois**, avec un bouton pour l'enregistrer.
- Un tableau par compte : versement **actuel**, montant **suggéré**, **écart**, et **pourquoi** (la règle qui a donné ce montant).
- Des messages en orange quand une part ne trouve pas de compte.
- Un champ **« Appliquer à partir de »** (un mois) et le bouton **« Appliquer ces montants »**.

### Colonne de droite

- **Ce mois-ci** : le total des versements programmés du mois, le jour du prélèvement et le nombre de comptes concernés. « versés » si le jour est passé, « prélevés » sinon.
- **Mois manqués** : un formulaire (compte, mois, montant non versé) et la liste des mois déjà déclarés, chacun avec sa corbeille.

### « Répartition conseillée des versements » (gestion libre)

Cette carte n'apparaît que si vous avez défini des allocations personnalisées dans Paramètres › Répartition. Pour chaque ligne : sa part des versements, le montant conseillé par mois, le montant programmé, l'écart (en orange s'il est notable) et l'avancement vers sa limite (« limite atteinte », « sans fin », ou une barre).

### Calendrier

Un tableau mois par mois :

| Colonne | Contenu |
|---|---|
| Mois | Le mois en cours est surligné. |
| Âge | Votre âge cette année-là (année − année de naissance). |
| Une colonne par compte | Le versement du mois. En orange si un mois manqué l'a réduit. « + … ponctuel » sous le montant si un versement du journal tombe ce mois-là. |
| Total | Versements programmés et ponctuels du mois. |
| État | « ✓ versé » ou « à venir ». |

Par défaut, le calendrier montre de trois mois avant à quatorze mois après aujourd'hui. « Tout afficher » montre tout le calendrier. Le survol d'une case détaille les versements ponctuels et signale un mois manqué.

Les comptes affichés sont ceux qui ont un versement programmé, plus ceux qui ont reçu un versement ponctuel (même archivés).

## Comment faire

### Programmer un versement mensuel

1. Restez sur **Gestion libre**.
2. Choisissez le **compte**, le **mois** de départ et le **montant par mois**.
3. Cliquez sur **Programmer**.

Le montant vaut à partir de ce mois, jusqu'au prochain palier. Les mois précédents ne changent pas.

### Changer le montant

Programmez le nouveau montant à partir du mois concerné. Si un palier existe déjà pour ce compte et ce mois, il est remplacé.

### Arrêter un versement

Programmez **0** à partir du mois où il s'arrête.

### Retirer un palier

Cliquez sur la corbeille du palier. Le palier précédent s'applique de nouveau à ces mois. Attention : si c'était le seul palier, le compte n'a plus de versement programmé, y compris pour les mois passés.

### Déclarer un mois manqué

1. Dans **Mois manqués**, choisissez le compte et le mois.
2. Indiquez le **montant non versé** (tout ou partie du versement).
3. Cliquez sur **Déclarer**.

Le Journal permet aussi de déclarer un mois manqué en entier, depuis la ligne du versement programmé.

### Laisser Hamac proposer les montants

1. Passez sur **Gestion suggérée**.
2. Indiquez votre **capacité d'épargne mensuelle**.
3. Lisez la répartition proposée et ses raisons.
4. Choisissez le mois de départ, puis **Appliquer ces montants**. La capacité est enregistrée en même temps si vous l'avez changée.

Seuls les comptes dont le montant change reçoivent un nouveau palier.

## Comprendre les chiffres

**Montant d'un mois.** C'est le dernier palier commencé à ce mois ou avant, moins les mois manqués déclarés. Il ne descend jamais sous zéro. Rien n'est compté avant le premier mois des versements (Paramètres › Plan).

Exemple fictif : 200 € par mois dès janvier, 300 € dès mai, et 100 € déclarés manqués en juin. Avril : 200 €. Mai : 300 €. Juin : 200 €.

**Versé ou à venir.** Le versement d'un mois compte une fois son jour de prélèvement passé. Le jour se règle dans Paramètres › Plan (« Jour des versements ») ; un 31 devient le 30 en avril et le 28 ou 29 en février. Avant le premier mois des versements, un mois est « versé » s'il contient un versement ponctuel.

**Versements ponctuels.** Ce sont les opérations « Versement » du Journal. Les apports initiaux, les transferts et les retraits n'y figurent pas.

**Effet sur vos comptes.** Chaque versement programmé prélevé s'ajoute à la valeur et au versé net du compte. Dans un contrat d'assurance-vie ou de PER, il va sur le fonds euros par défaut du contrat.

**Répartition suggérée.** Hamac répartit votre capacité dans cet ordre :

1. vos **allocations personnalisées** (part des versements), sans dépasser ce qui reste avant leur limite ;
2. vos **livrets**, s'ils sont sous le plancher (Paramètres › Plan › Règles des livrets), le mieux rémunéré d'abord et sans dépasser son plafond de dépôt ; cette étape est sautée si une allocation personnalisée vise déjà les livrets ;
3. le reste selon votre **répartition cible**, vers les classes d'actifs en retard sur leur cible, sans rien vendre.

Entre plusieurs comptes d'une même ligne, l'argent se partage selon les versements actuels, sinon selon la valeur, sinon à parts égales. Les montants sont arrondis à l'euro, et le total suggéré égale la capacité, sauf ce qu'aucun compte ne peut recevoir (signalé).

**Répartition conseillée (gestion libre).** Montant conseillé = part de la ligne × total programmé ce mois. Quand une ligne atteint sa limite, sa part passe à la ligne choisie, ou se partage entre les autres.

## Limites

- Un seul palier par compte et par mois.
- Le montant d'un versement programmé ne se règle qu'au mois, pas au jour : tous les comptes sont prélevés le même jour.
- Archiver un compte arrête ses versements programmés à partir du prochain mois non encore prélevé. Ses mois passés restent comptés, mais sa colonne quitte le calendrier, sauf s'il a reçu des versements ponctuels.
- La colonne « Âge » s'affiche aussi en format « patrimoine ».
- « Appliquer ces montants » enregistre les comptes un par un : une erreur en cours de route laisse les premiers changés.
- Un versement ponctuel saisi dans le Journal ne réduit pas le versement programmé du même mois : les deux s'ajoutent.
