# Mes comptes : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

« Mes comptes » met côte à côte chaque compte et chaque contrat : sa valeur, ce que vous y avez versé, ce qu'il a gagné. La page montre aussi ce qui pèse le plus dans votre patrimoine, ce qui est garanti si un établissement fait faillite, et l'écart entre votre répartition réelle et votre cible.

Tout est calculé à partir du [Journal](../journal/guide.md) et des [Versements](../versements/guide.md) programmés. La page ne se saisit pas : pour créer, modifier ou archiver un compte, voir « Comment faire ».

Quelques mots utilisés ici :

- une **enveloppe** est un cadre fiscal : livret réglementé, assurance-vie, PEA, compte-titres, PER, épargne salariale ;
- un **compte** est une enveloppe ouverte chez un établissement (« PEA chez telle banque »), ou une plateforme crypto ou de crowdlending. Pour l'assurance-vie et le PER assurantiel, on dit **contrat** ;
- un **support** est ce que vous placez dans un compte : fonds euros, ETF, action, obligation…

Tant qu'aucun compte n'existe, la page affiche l'accueil « Bienvenue dans Hamac ».

La page est la même dans les deux formats. Une différence : en format « retraite », la cible des actions baisse avec l'âge (voir « Comprendre les chiffres »), ce qui change la colonne « Part cible ».

## Ce que vous y voyez

### Tableau des comptes

Une ligne par compte ou contrat. Un compte archivé n'apparaît que s'il garde une valeur. Un clic sur un en-tête trie la colonne ; un clic sur une ligne déplie la courbe d'évolution de ce compte.

| Colonne | Contenu |
|---|---|
| Compte ou contrat | Son nom, et son type en dessous si le nom ne le dit pas. |
| Rôle | Le rôle noté sur la fiche du compte (par exemple « Matelas de sécurité »). |
| Versement mensuel | Le versement programmé ce mois-ci. |
| Valeur | Ce que vaut le compte aujourd'hui. |
| Part du patrimoine | Sa valeur rapportée au total du tableau. |
| Versé net | Ce que vous y avez mis, moins ce que vous en avez retiré. |
| Gain / perte | Valeur − versé net. |
| Gain (%) | Gain ÷ versé net. |

Une ligne **Total** termine le tableau.

### Évolution par compte

Un graphique avec une courbe par compte. Un clic sur la légende masque ou réaffiche une courbe. L'évolution apparaît après un mois d'historique.

### Concentration

Ce qui pèse le plus dans votre patrimoine financier. En haut : la part de la **première ligne**, celle des **cinq premières lignes**, le **patrimoine financier** et le nombre d'éléments **au-delà du seuil**. Puis des barres :

- **Titres, tous comptes confondus** : un même ETF détenu dans deux comptes fait une seule ligne. Huit lignes au plus, avec un lien pour tout afficher. Le fonds euros n'y figure pas.
- **Établissements** : la part de votre patrimoine chez chacun, sans alerte.
- **Émetteurs d'obligations**, s'il y en a. Les obligations de l'État ne déclenchent pas d'alerte.
- **Plateformes de crowdlending**, s'il y en a, avec la part des projets en retard ou en défaut.

Une barre rouge et l'étiquette « au-delà du seuil » signalent un titre, un émetteur ou une plateforme qui dépasse le seuil réglé dans Paramètres › Plan (« Concentration maximale », 20 % par défaut ; 0 coupe les alertes).

### Protection en cas de faillite

Cette carte n'apparaît que si vous avez au moins un compte avec de l'argent. En haut, quatre montants :

- **Sous les plafonds** : ce qui est couvert par une garantie légale ;
- **Au-delà d'un plafond** : ce qui dépasse, en rouge s'il y en a ;
- **Sans garantie** : crowdlending et crypto ;
- **À vérifier** : comptes sans établissement, établissements hors de France pour l'assurance ou hors Union européenne, et épargne salariale.

Puis une ligne par **établissement garant** et par type de garantie : l'établissement (et les marques regroupées sous lui), les comptes concernés, la garantie, le montant, le plafond, une barre de la part garantie et le montant non garanti.

La date de vérification des règles et les sources officielles sont rappelées sur la carte.

### Allocation de la partie investie

Pour chaque classe d'actifs (livrets, fonds euros, obligations, actions, immobilier…) : la valeur, la part réelle, la part cible, l'écart et une action conseillée :

- **OK** : l'écart reste sous le seuil d'alerte ;
- **Renforcer** : la classe est en retard sur sa cible ;
- **Alléger (verser ailleurs)** : la classe dépasse sa cible.

Le titre rappelle votre âge et le seuil d'alerte (Paramètres › Répartition, « Seuil d'alerte de rééquilibrage »). On rééquilibre en orientant les prochains versements, sans vendre.

### État des livrets

Un message en bas de page :

- livrets **sous le plancher** : les reconstituer avant tout autre placement ;
- livrets **au-dessus du plafond** : transférer l'excédent vers le fonds euros ;
- sinon, livrets **dans la fourchette** du plan.

Plancher et plafond se règlent dans Paramètres › Plan › Règles des livrets.

## Comment faire

### Créer un compte

- Dans **Paramètres › Comptes**, cliquez sur **Nouveau compte**.
- Ou, sur la page d'un placement sans compte (Livrets, Fonds euros, Actions & ETF, Crowdlending), utilisez le bouton « Ajouter… ».
- Ou, au tout premier lancement, utilisez les boutons de l'accueil.

Dans la fiche :

1. Choisissez le **type de compte**. Un PEA et un PEA-PME ne peuvent exister qu'une fois : le type est grisé s'il est déjà ouvert. Même chose pour un LEP, un LDDS et un Livret A.
2. Donnez un **nom** (obligatoire) et rattachez l'**établissement**. Les établissements qui proposent ce type de compte sont listés en premier. Sans établissement, les frais par défaut s'appliquent et la protection en cas de faillite est « à vérifier ».
3. Indiquez la **date d'ouverture** : elle sert à la règle des 5 ans du PEA et des 8 ans de l'assurance-vie.
4. Notez un **rôle** si vous le souhaitez.
5. Selon le type, d'autres champs apparaissent : taux et plafond d'un livret, type de PER, fonds euros par défaut, frais d'une assurance-vie, clause bénéficiaire, délai pour investir l'apport d'un PEA, part détenue d'un compte joint.
6. Choisissez si le compte compte dans votre répartition cible (par défaut : comme sa classe).

Un nouveau contrat d'assurance-vie ou de PER assurantiel reçoit un fonds euros à son nom, sauf si vous en choisissez un existant ou « Aucun ».

Seuls un compte-titres, une plateforme crypto et un « autre livret » peuvent être joints. Pour eux, indiquez la **part détenue** (50 % à deux).

### Modifier un compte

Dans Paramètres › Comptes, ou avec le crayon sur les pages Livrets, Fonds euros et Actions & ETF. Le type d'un compte qui a déjà des opérations ne peut plus changer.

### Archiver un compte

Ouvrez sa fiche, cochez **« Archivé »**, puis enregistrez. Le compte disparaît des listes de saisie, et ses versements programmés s'arrêtent à partir du prochain mois non encore prélevé. Son historique est conservé. Un compte archivé ne bloque plus l'ouverture d'un autre PEA ou livret du même type.

### Supprimer un compte

Dans Paramètres › Comptes, avec la corbeille, après confirmation. La suppression est refusée si le compte a des opérations, ou si une plateforme a des projets : archivez-le plutôt. Son fonds euros par défaut est supprimé avec lui s'il ne sert nulle part ailleurs.

### Régler la protection d'un établissement

Sur la fiche de l'établissement (Paramètres › Établissements), indiquez l'**établissement garant** s'il diffère du nom de la marque, et le **pays** (France, autre pays de l'Union européenne, hors Union européenne). Pour l'assurance-vie, le nom de l'**assureur** de l'offre sert de garant. Le plafond de la garantie des assureurs se règle dans Paramètres › Plan (« Garantie des assureurs (FGAP) »).

## Comprendre les chiffres

**Valeur.** Espèces du compte + valeur de ses supports (au dernier cours connu, ou au prix calculé d'une obligation, ou à 1 € la part d'un fonds euros) + projets de crowdlending en cours.

**Versé net.** Apports initiaux + versements + versements programmés déjà prélevés − retraits. Un transfert compte comme un retrait pour le compte de départ et un versement pour le compte d'arrivée : au total, il s'annule. Les intérêts, dividendes, frais et corrections ne changent pas le versé net : ils font partie du gain.

Exemple fictif : 5 000 € d'apport, 12 versements de 100 €, un retrait de 500 €. Versé net : 5 700 €. Si le compte vaut 6 000 €, le gain est de 300 €, soit 5,3 %.

**Part du patrimoine.** Valeur du compte ÷ total de la colonne Valeur. Ce tableau montre les comptes entiers, y compris les comptes joints.

**Concentration.** Les parts sont calculées sur le patrimoine financier, en ne comptant que votre part des comptes joints.

**Protection.** Pour chaque compte, Hamac prend votre part et la découpe selon la garantie qui la couvre :

| Ce qui est détenu | Garantie | Plafond, établissement en France |
|---|---|---|
| Livret bancaire, espèces d'un PEA, d'un compte-titres ou d'un PER bancaire | Dépôts | 100 000 € par établissement garant |
| Livret A, LDDS, LEP | Plafond distinct, qui s'ajoute | 100 000 € |
| Titres d'un PEA, d'un compte-titres ou d'un PER bancaire | Titres | 70 000 € |
| Assurance-vie, PER assurantiel | Assurance, par assureur, tous contrats confondus | 70 000 € par défaut (réglable) |
| Épargne salariale | À part | Pas de plafond calculé |
| Crowdlending, crypto | Aucune | — |

Pour un établissement d'un autre pays de l'Union européenne : 100 000 € sur les dépôts (livrets réglementés compris, sans plafond distinct), 20 000 € au moins sur les titres, et l'assurance « à vérifier ». Hors de l'Union européenne : tout est « à vérifier ».

Les titres restent à vous en cas de faillite : leur garantie ne joue que s'ils ne peuvent pas être restitués.

**Allocation.** La partie investie additionne ce qui compte dans la répartition cible : espèces et supports des comptes inclus, biens immobiliers inclus, et autres biens rangés dans une classe personnalisée. Pour un compte joint, seule votre part compte. Part réelle = valeur de la classe ÷ partie investie. Écart = part réelle − part cible.

En format « retraite », la cible des actions baisse chaque année entre l'âge de sécurisation et l'âge de départ, jusqu'à la cible prévue au départ. Ce qu'elle perd va au fonds euros, ou à défaut aux obligations, si cette classe est dans l'allocation. En format « patrimoine », les cibles restent celles de Paramètres › Répartition.

## Limites

- La page montre les valeurs du jour. Pour une autre date, voir la page Historique.
- La valeur dépend des cours : un titre sans cours récent est valorisé au dernier cours connu, ou à son prix de revient s'il n'en a aucun.
- La protection applique des règles générales, vérifiées à la date indiquée sur la carte. Elle ne connaît pas les cas particuliers : plusieurs titulaires, contrats souscrits par un intermédiaire, garanties propres à un pays.
- Les sommes « à vérifier » ne sont comptées ni comme garanties, ni comme non garanties.
- La concentration ne juge pas le contenu des ETF : pour cela, voir la page Exposition réelle.
- Le versé net ne distingue pas l'argent venu d'un autre compte par transfert de l'argent neuf.
