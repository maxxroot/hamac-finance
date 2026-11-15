# Performance : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page Performance répond à trois questions : combien l'argent a réellement rapporté, d'où vient ce gain, et comment il se compare à autre chose (un autre compte, un ETF, un indice).

Elle s'applique au patrimoine financier : comptes, contrats et plateformes. Les biens immobiliers, les autres biens et les crédits n'y entrent pas.

La page est la même en plan de retraite et en gestion de patrimoine. Elle fait partie du module « Performance », qu'on peut retirer du menu dans Paramètres › Plan › Modules.

## Ce que vous y voyez

En haut, deux réglages :

- **Ce qui est analysé** : tout le patrimoine financier, une enveloppe (PEA, assurance-vie, compte-titres…), un placement détenu en direct (crypto, crowdlending) ou un seul compte.
- **La période** : 3 mois, 1 an, 3 ans ou tout (par défaut).

Puis, dans l'ordre :

1. **Un avertissement**, s'il y a lieu : certains mois, une partie des titres n'avait aucun cours connu et compte à son prix de revient.
2. **Six chiffres** : Gain (en euros et en %), Rendement annualisé, Dividendes et intérêts, Frais payés, Plus forte baisse, Volatilité.
3. **Rendement cumulé** (en %) ou **Gain cumulé** (en €) : la courbe de la performance au fil de la période. Le bouton % / € change d'unité.
4. **D'où vient le gain** : le gain de la période découpé **par classe** (actions, obligations, fonds euros, crowdlending…) ou **par nature** (plus-values pas encore encaissées, plus-values encaissées, dividendes, intérêts, frais facturés à part, impôts prélevés, corrections et autres).
5. **Année par année** ou **Mois par mois** : un graphique en barres et un tableau (valeur au début, argent versé, gain, rendement, dividendes et intérêts, frais, valeur à la fin). En mode mois, une liste choisit l'année. Une ligne se déplie sur ses parts : les enveloppes et placements quand on regarde tout le patrimoine, les comptes quand on regarde une enveloppe qui en a plusieurs.
6. **Calendrier des mois** : une case par mois, colorée selon la hausse ou la baisse, avec le total de chaque année. Dessous : le meilleur mois, le pire, et le nombre de mois positifs.
7. **Classement des titres** : les cinq meilleurs titres de la période, puis les cinq moins bons, titres vendus compris.
8. **Le tableau par enveloppe** : une ligne par enveloppe ou placement, à déplier sur ses comptes, et une ligne Total. Colonnes : valeur, montant investi (ou versé sur la période), gain en euros et en %, rendement annualisé, hypothèse du plan, écart entre les deux, et gain après impôts (seulement sur toute la durée). Chaque colonne se trie d'un clic.
9. **Comparer** : deux éléments au choix, deux courbes qui partent de zéro au même point, et la phrase « les mêmes versements placés sur… auraient donné… » quand on compare un portefeuille à un titre.
10. **Une note** qui rappelle comment lire ces chiffres.

Le tableau année par année et le calendrier couvrent toujours tout l'historique, quelle que soit la période choisie en haut.

## Comment faire

**Regarder un seul compte** : choisissez-le sous « Comptes et contrats » dans la première liste. Tous les blocs suivent.

**Voir le détail d'une année** : dans le bloc Année par année, cliquez sur la ligne de l'année pour voir ses parts. Pour voir ses mois, passez sur « Mois » et choisissez l'année.

**Comparer son portefeuille à un indice** :

1. Dans le bloc Comparer, laissez « Tout le patrimoine financier » (ou un compte) dans « Ce que je compare ».
2. Dans « Avec », cliquez sur la loupe et cherchez un ETF par son nom ou son ISIN, par exemple « MSCI World ».
3. Choisissez un résultat. Le titre sert seulement à la comparaison : il n'est pas ajouté à vos placements.

Le choix est retenu par votre navigateur pour la prochaine visite. Les huit derniers titres cherchés restent dans la liste, sous « Titres recherchés ».

**Comparer deux de vos titres** : choisissez-les sous « Mes titres » dans les deux listes. Seuls les titres qui sont passés par votre portefeuille et qui ont des cours sur au moins deux mois y figurent.

## Comprendre les chiffres

**Gain** : sur toute la durée, la valeur d'aujourd'hui moins l'argent versé net. Sur une période, la valeur de fin moins la valeur de départ, moins l'argent versé pendant la période. Le pourcentage est, sur toute la durée, le gain divisé par l'argent versé ; sur une période, le rendement de la période (voir plus bas).

**Rendement annualisé** : le taux par an qui, appliqué à chaque versement depuis sa date, redonne la valeur finale. Sur une période, la valeur de départ compte comme un premier versement. Il ne s'affiche qu'à partir d'un an : sur 3 mois, la page montre à la place le rendement de la période. Sur tout le patrimoine et toute la durée, c'est le même chiffre que sur le tableau de bord.

**Rendement d'un mois, rendement cumulé et calendrier** : ils mesurent les placements seuls, sans l'effet de l'argent ajouté. Pour un mois : le gain du mois divisé par la valeur du début, plus les versements du mois pondérés par le temps qu'ils y ont passé. Exemple : 10 000 € au début du mois, 1 000 € versés au milieu du mois, 11 100 € à la fin. Le gain est de 100 €. La somme en jeu vaut environ 10 000 + 500 = 10 500 €. Le rendement du mois est donc d'environ 0,95 %. Les mois s'enchaînent ensuite : deux mois à +1 % font +2,01 %. Quand l'argent vient d'arriver (la somme en jeu est sous 10 % de la valeur), le mois n'a pas de taux : une petite somme donnerait un pourcentage démesuré.

**Gain cumulé** : en euros, ce que les placements ont rapporté depuis le début de la période, versements déduits. Son dernier point est le gain affiché en haut.

**Plus forte baisse** : la plus grande chute de la courbe de rendement cumulé, d'un plus haut au plus bas qui suit, avec le mois du point bas et la mention « rattrapée » si le plus haut a été retrouvé depuis. Une baisse suivie de sa remontée dans le même mois n'apparaît pas.

**Volatilité** : de combien la valeur varie en général sur un an, sans l'effet des versements. Elle est calculée à partir des rendements mensuels et demande au moins 12 mois.

**Dividendes et intérêts, frais payés** : ce qui a été reçu et payé pendant la période. Les frais comprennent ceux inclus dans le montant des achats et des ventes ; ceux-là pèsent déjà sur les plus-values, ce que le bloc « D'où vient le gain » rappelle.

**D'où vient le gain** : dans les deux vues, la somme des lignes redonne le gain de la période. Par classe, un titre compte dans la classe de son type, et les espèces d'un compte dans les Liquidités (sauf un livret, et l'argent d'un contrat sans support précisé, au fonds euros), comme dans la répartition. Chaque classe a aussi son rendement de la période, sans l'effet de l'argent ajouté. Les frais facturés à part et les impôts prélevés ont leur propre ligne, parce qu'ils ne se rattachent à aucune classe.

**Classement des titres** : pour chaque titre, plus-value pas encore encaissée, plus-value encaissée et revenus (dividendes, coupons, intérêts) de la période. Le pourcentage est le rendement du titre, calculé comme s'il était un compte à lui seul : achats en entrée, ventes et revenus en sortie.

**Hypothèse du plan** : le rendement attendu réglé dans les paramètres. Livrets : celui des livrets ; assurance-vie : celui du fonds euros ; PEA : celui des actions ; compte-titres : un mélange des rendements attendus selon ce qu'il contient (obligations par défaut). Le PER, l'épargne salariale, le crowdlending et la crypto n'en ont pas. L'écart est le rendement annualisé moins l'hypothèse.

**Gain après impôts** : ce qui resterait du gain si tout était retiré aujourd'hui, une fois payés les impôts calculés sur ce retrait.

**Transferts** : un transfert entre deux de vos comptes compte comme argent versé pour l'un et retiré pour l'autre. Sur tout le patrimoine, il s'annule.

**Comparer** : les deux courbes partent de zéro à la même date, la première où les deux ont des données. Un portefeuille se lit mois par mois, sans l'effet de l'argent ajouté. Deux titres se comparent sur leurs cours, jour par jour. Pour un titre, les dividendes des ETF sont comptés comme réinvestis quand la source de l'historique le permet ; sinon la note précise « cours seul ». La phrase « les mêmes versements… » rejoue vos versements et retraits, aux mêmes dates et pour les mêmes montants, sur le titre choisi, au cours connu à chaque date.

## Limites

- Les mois où des titres n'ont aucun cours connu comptent ces titres à leur prix de revient : la performance de ces mois paraît plus plate qu'elle ne l'a été.
- Le rendement d'un mois suppose une valeur connue seulement en fin de mois : ce qui se passe à l'intérieur d'un mois n'est pas vu.
- Le rendement annualisé n'est pas affiché sur moins d'un an.
- Le gain après impôts n'est donné que sur toute la durée.
- La comparaison dépend des cours disponibles chez les sources : un titre récent ou mal couvert peut n'avoir qu'un historique court, voire aucun.
- Le choix de la comparaison est gardé dans le navigateur : il ne suit pas d'un appareil à l'autre.
- Biens, autres biens et crédits ne sont pas analysés ici.
