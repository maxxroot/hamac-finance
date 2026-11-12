# Historique : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page Historique sert à remonter le temps. Elle montre où en était votre patrimoine à une date, ce qui a changé jusqu'à une autre date, et les grandes étapes de votre parcours.

Rien n'est enregistré mois après mois : tout est reconstruit à partir du journal des opérations et des cours connus à chaque date. Si vous corrigez une opération ancienne, tout l'historique se corrige avec elle.

La page est la même en plan de retraite et en gestion de patrimoine. Elle fait partie du module « Historique », qu'on peut retirer du menu dans Paramètres › Plan › Modules.

## Ce que vous y voyez

1. **Le choix de la période** : une liste « Du » (le tout début, ou la fin d'un mois), une liste « Au » (aujourd'hui, ou la fin d'un mois), et quatre raccourcis : 1 mois, 1 an, Depuis janvier, Depuis le début. Par défaut, la page montre la dernière année. Le titre qui suit rappelle la période, par exemple « De fin mars 2025 à aujourd'hui ».
2. **Le résumé** : une phrase qui dit de combien le patrimoine financier a changé, puis la part qui vient de votre épargne et celle qui vient des placements, et l'épargne moyenne par mois.
3. **Mois par mois** : pour chaque mois, l'argent apporté et le gain ou la perte des placements, en barres. Au-delà de trois ans, une barre par an. Dessous : les mois sans versement, le meilleur et le pire mois.
4. **Par rapport au plan** : ce que le plan prévoyait pour la période, ce qui s'est réellement passé, et l'écart, découpé entre l'épargne et les placements. Un graphique compare la courbe prévue à la courbe réelle.
5. **La situation** : un tableau à deux colonnes (début et fin) avec l'écart. Lignes : patrimoine financier, argent versé net, gain, et, si vous avez des biens ou des crédits, biens (part détenue), autres biens, crédits restant dus et patrimoine net.
6. **Répartition par classe** : la part de chaque classe d'actifs au début et à la fin.
7. **Ce qui s'est passé** : une cascade qui part de la valeur de départ, ajoute ou retire chaque cause d'écart et arrive à la valeur de fin. Une liste en haut de la carte la restreint à un seul compte. Un lien ouvre le journal sur les opérations de la période.
8. **Les grandes étapes** : ouvertures et clôtures de comptes, premiers achats et ventes de titres, paliers franchis, gros versements et retraits, plus forte baisse des marchés, biens et crédits. Des pastilles filtrent par famille.
9. **Compte par compte** : pour chaque compte, sa valeur au début et à la fin, l'argent apporté et le gain. Un compte clôturé porte la mention « clôturé ».
10. **Titres achetés et vendus** : les lignes de titres nouvelles, renforcées, allégées ou vendues en entier sur la période. Les lignes inchangées sont masquées par défaut.
11. **Le tableau mois par mois** (bouton « Voir le tableau mois par mois ») : chaque fin de mois depuis le début, avec la valeur de chaque classe, le total, le versé net, le gain, et les biens et crédits s'il y en a.

Tant que le journal est vide, la page indique que l'historique commence avec la première opération.

## Comment faire

**Choisir une période** : utilisez un raccourci, ou choisissez les deux dates dans « Du » et « Au ». La période est inscrite dans l'adresse de la page : vous pouvez la garder en favori ou y revenir.

**Voir ce qui a changé depuis une étape** : cliquez sur une grande étape. La période devient « de la fin du mois précédent à … », pour que l'étape y soit incluse.

**Voir toutes les étapes** : par défaut, seules celles de la période sont listées, les dix plus récentes d'abord. « Voir toutes les étapes » montre tout le parcours, « Afficher les N autres » déroule la suite.

**Suivre un seul compte dans la cascade** : choisissez-le dans la liste en haut de la carte « Ce qui s'est passé ». Le lien vers le journal suit ce choix. Les autres cartes restent sur tout le patrimoine.

**Retrouver les opérations de la période** : cliquez sur « Voir les N opérations de la période » sous la cascade. Le journal s'ouvre avec les dates de la période, et le compte si vous en avez choisi un.

## Comprendre les chiffres

**Les dates** : « Fin mars 2025 » veut dire le dernier jour de mars 2025. Pour le mois en cours, le point est aujourd'hui. Une période « de fin mars à fin juin » couvre avril, mai et juin.

**Valeur à une date** : chaque compte est valorisé avec le dernier cours connu à cette date. Un titre sans aucun cours connu compte à son prix de revient.

**Argent apporté** : versements (apports, versements ponctuels et versements programmés) moins retraits. Sur tout le patrimoine, un transfert entre deux de vos comptes s'annule. Sur un seul compte, il compte comme argent reçu ou envoyé.

**Gain des placements** : la variation de valeur moins l'argent apporté. C'est ce que les placements ont rapporté ou fait perdre.

**Part de l'épargne** : argent apporté ÷ (argent apporté + gain). Exemple : sur un an, 6 000 € apportés et 2 000 € de gain, la hausse de 8 000 € vient à 75 % de l'épargne et à 25 % des placements. Ce partage n'est montré que si les deux sont positifs ; sinon, une phrase donne les deux montants.

**Mois sans versement** : un mois où aucun versement n'a été fait, même si un retrait a eu lieu.

**Par rapport au plan** : le plan part de la valeur de chaque classe au début de la période. Chaque mois, chaque classe grandit à son rendement attendu, et les versements programmés s'ajoutent dans la classe des espèces de leur compte. Pour un mois déclaré manqué, le plan compte quand même le versement prévu : le manque apparaît dans l'écart d'épargne. Les rendements attendus sont ceux réglés aujourd'hui dans les paramètres (livrets, fonds euros, obligations, actions, et ceux saisis pour l'immobilier, le crowdlending et la crypto). Une classe sans rendement attendu est comptée sans gain.

L'écart total se découpe en deux : l'épargne (ce que vous avez apporté de plus ou de moins que prévu) et les placements (ce qu'ils ont rapporté de plus ou de moins que prévu). Exemple : le plan prévoyait 12 000 € à la fin, la valeur réelle est 12 400 € ; vous êtes en avance de 400 €. Si vous avez versé 100 € de plus que prévu, les placements expliquent les 300 € restants. Sous un petit écart (0,5 % de la valeur prévue, et au moins 20 €), la page affiche « Dans les clous ».

**La situation** : l'écart est la différence entre les deux colonnes, avec le pourcentage quand il a un sens. Pour les crédits, une baisse est une bonne nouvelle : elle est affichée en vert.

**Répartition par classe** : la part de chaque classe dans le patrimoine financier, au début et à la fin. Ce n'est pas la même base que la carte Allocation du tableau de bord, qui ne compte que les éléments inclus dans l'allocation.

**La cascade** : valeur de départ, puis l'argent (versements, transferts reçus, retraits, transferts envoyés), puis le gain découpé par nature (plus-values pas encore encaissées, plus-values encaissées, dividendes, intérêts, frais facturés à part, impôts prélevés, corrections et autres), et enfin la valeur d'arrivée. La somme tombe toujours juste. Quand les variations sont petites devant le total, l'échelle est resserrée pour qu'elles restent visibles ; la carte le signale.

**Les grandes étapes** :

- ouverture d'un compte : la date d'ouverture saisie, sinon sa première opération ; clôture : la dernière opération d'un compte archivé ;
- premier achat de chaque titre, et chaque vente qui vide une ligne ;
- paliers : 1 000 €, 2 000 €, 5 000 €, 10 000 €, 20 000 €, 50 000 €… la première fois que le patrimoine financier les dépasse ; un seul par mois, le plus haut ;
- gros versements et retraits : à partir de 5 000 € et d'au moins 10 % du patrimoine financier de la fin du mois précédent ;
- marchés : le point bas de la plus forte baisse des placements, si elle dépasse 5 %, puis le mois où elle est rattrapée ;
- achat et vente d'un bien, première échéance d'un crédit, crédit soldé ou remboursé.

**Titres achetés et vendus** : une ligne est jugée sur son prix de revient, qui ne bouge qu'avec les achats et les ventes. « Investi en plus » est la variation de ce prix de revient : une vente partielle le réduit à proportion des parts vendues. Sous 50 centimes d'écart (ou 0,1 % du prix de revient de départ, si c'est plus), la ligne est « inchangée ».

**Comptes clôturés** : ils restent comptés. Leur argent versé et leur gain font partie du parcours.

## Limites

- Les cours retenus sont ceux de la fin de chaque mois : ce qui se passe à l'intérieur d'un mois n'est pas visible.
- Un titre sans cours connu à une date compte à son prix de revient : sa valeur paraît stable.
- Le plan est recalculé avec les réglages d'aujourd'hui, pas avec ceux en vigueur à l'époque.
- Le résumé, le mois par mois, le plan et la répartition portent sur le patrimoine financier ; les biens et les crédits n'apparaissent que dans « La situation » et le tableau mois par mois.
- Le lien « Régler les rendements attendus » de la carte du plan ouvre la page Projection. Les rendements se règlent en fait dans Paramètres › Répartition, et en gestion de patrimoine la page Projection ne propose aucun réglage.
- Le versé net de « La situation » compte les comptes clôturés ; celui du tableau mois par mois peut ne pas les compter. Les deux chiffres peuvent donc différer quand un compte clôturé a un versé net non nul.
