# Tableau de bord : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

Le tableau de bord est la page d'accueil. Il montre en un coup d'œil où en est votre patrimoine, comment il a évolué, si votre répartition suit la cible, et ce qui demande une action de votre part.

La page change selon l'usage choisi dans Paramètres › Plan :

- **Préparer ma retraite** : l'en-tête rappelle votre âge, l'âge de départ visé et le nombre d'années de versements restantes. Une carte montre la projection à la retraite.
- **Gestion de patrimoine** : l'en-tête indique « Gestion de patrimoine ». Il n'y a pas de projection de retraite. À la place, si vous avez des biens, d'autres biens, des crédits ou un compte joint, une carte « Actifs et dettes » résume le patrimoine net.

Tant qu'aucun compte n'existe, la page affiche l'accueil « Bienvenue dans Hamac » avec les premières étapes (profil, comptes).

## Ce que vous y voyez

1. **Les chiffres clés**, en haut :
   - **Patrimoine financier** (ou **Patrimoine net** si vous avez des biens, d'autres biens, des crédits ou un compte joint). Sous le montant, le détail : « Précaution » et « Investi », ou « Financier », « Immobilier », « Autres biens » et « Crédits ». Une ligne indique aussi le gain ou la perte depuis la fin du mois précédent.
   - **Versé net** : l'argent que vous avez mis, retraits déduits.
   - **Gain / perte** : en euros, et en pourcentage de l'argent versé.
   - **Rendement annualisé** : ce que l'ensemble a rapporté par an depuis le départ.
   - **Épargne par mois** : le total de vos versements programmés en cours.
2. **Évolution** : un graphique de la valeur totale et du montant investi, avec la zone de gain ou de perte entre les deux. Le sélecteur choisit la période (3 mois, 1 an, 3 ans, tout). Le lien « Historique » mène à la page du même nom.
3. **Allocation** : pour chaque classe d'actifs, la barre montre la part réelle et le trait vertical la cible. « Renforcer » ou « Alléger » apparaît quand l'écart dépasse le seuil réglé.
4. **Mes comptes** : vos comptes du plus gros au plus petit, avec leur gain en pourcentage. Au-delà de six, les plus petits sont regroupés.
5. **La carte du milieu**, selon l'usage :
   - en retraite, **Projection à N ans** : patrimoine prévu à la date de départ, en euros de l'époque et en euros d'aujourd'hui, argent versé d'ici là, revenu mensuel possible, et une fourchette selon les marchés ;
   - en gestion de patrimoine, **Actifs et dettes** (seulement si vous avez des biens, d'autres biens, des crédits ou un compte joint) : patrimoine financier, immobilier, autres biens, crédits restant dus, patrimoine net et mensualités.
6. **À regarder** : les points qui demandent une action, les plus graves d'abord. Les cinq premiers sont affichés, le bouton « Voir les N autres » montre le reste. « Rien à signaler » s'il n'y a rien.
7. **Projets en cours** (si le module Projets est actif et qu'un projet est en cours) : pour chacun, la somme réunie, la cible, la date, et le versement mensuel nécessaire.

## Comment faire

**Voir l'évolution sur une autre durée** : dans la carte Évolution, cliquez sur 3M, 1A, 3A ou Tout. Passez la souris sur le graphique pour lire le montant d'un mois. Un clic sur la légende masque ou réaffiche une courbe.

**Régler la cible de répartition** : si la carte Allocation est vide, suivez le lien vers Paramètres › Répartition. Le seuil d'écart qui déclenche « Renforcer » ou « Alléger » se règle au même endroit.

**Agir sur un point à regarder** : la plupart des lignes de « À regarder » sont des liens. Un clic ouvre la page où agir (Journal, Livrets, Versements, Paramètres…).

**Aller plus loin sur la projection** : le lien « Simuler » de la carte Projection ouvre la page Projection.

## Comprendre les chiffres

**Patrimoine financier** : la somme de la valeur de tous vos comptes. Un compte clôturé dont la valeur est à zéro ne compte plus.

**Patrimoine net** : patrimoine financier pour votre part des comptes joints, plus la valeur des biens et des autres biens pour la part que vous détenez, moins le capital restant dû des crédits pour votre part. Dès qu'un compte joint existe, le patrimoine financier pour votre part diffère du total des comptes : c'est pourquoi la page passe alors au patrimoine net, même sans bien ni crédit.

**Précaution et Investi** : la précaution est la classe « précaution » (en pratique, les livrets). L'investi est tout le reste.

**Gain depuis la fin du mois précédent** : le gain d'aujourd'hui moins le gain de la fin du mois dernier. Un versement fait ce mois-ci ne compte donc pas comme un gain.

**Versé net** : apports initiaux, versements ponctuels et versements programmés, moins les retraits. Un transfert entre deux de vos comptes ne change pas le total.

**Gain / perte** : valeur actuelle moins versé net. Le pourcentage est ce gain divisé par le versé net. Exemple : 20 000 € versés, valeur 22 000 €, gain de 2 000 €, soit +10 %.

**Rendement annualisé** : le taux par an qui, appliqué à chaque versement depuis sa date, redonne la valeur d'aujourd'hui. Il tient donc compte du moment où l'argent est arrivé. Exemple : 10 000 € versés en une fois il y a deux ans, qui valent 11 025 € aujourd'hui, font 5 % par an. Il ne s'affiche qu'après un an d'historique ; sinon, la raison est écrite à la place (« Moins d'un an d'historique », « Aucun versement », « Valeur nulle »).

**Épargne par mois** : la somme des versements programmés qui s'appliquent ce mois-ci, tous comptes confondus.

**Allocation** : la part de chaque classe est calculée sur la « partie investie », c'est-à-dire seulement les éléments inclus dans l'allocation (le montant est rappelé sous la carte). Pour un compte joint, seule votre part compte. En plan de retraite, la cible des actions baisse peu à peu à partir de l'âge de sécurisation, au profit du fonds euros (ou des obligations). L'écart est mesuré en points : avec une cible de 60 % et une part réelle de 66 %, l'écart est de 6 points. Au-delà du seuil (5 points par défaut), la classe est marquée.

**Projection** (retraite) : elle prolonge le patrimoine financier actuel et vos versements programmés jusqu'à l'année de départ, avec les rendements attendus des paramètres. « En € d'aujourd'hui » retire l'inflation. Le revenu mensuel possible est le montant qu'on peut retirer chaque mois, de l'âge de départ à l'âge de fin choisi, en consommant la partie investie. La fourchette vient de 300 simulations où le rendement des actions varie au hasard chaque année : 10 % des simulations finissent sous le bas de la fourchette, 10 % au-dessus du haut.

**À regarder** : les points sont classés en « Critique », « À faire » puis « Info ». Les points « OK » ne sont pas montrés ici. On y trouve notamment : incohérences du journal, livrets sous le plancher ou au-dessus du plafond, classe qui s'écarte de sa cible, cours manquants ou anciens, clause bénéficiaire à rédiger, écart avec un relevé, sommes au-delà de la garantie en cas de faillite, titre ou plateforme qui pèse trop lourd, frais élevés, anniversaires fiscaux proches, intérêts de l'année passée à saisir (de janvier à mars), échéances de crowdlending dépassées, rappels des biens loués (loyers non reçus, fin de bail, DPE, documents).

## Limites

- Le graphique d'évolution ne montre que le patrimoine financier : les biens et les crédits n'y figurent pas.
- La liste « À regarder » est courte : le détail de chaque point n'est pas affiché ici, seulement son titre.
- La projection est faite avant impôts. Rien n'est garanti hors livrets, fonds euros et obligations gardées jusqu'à l'échéance. La carte indique « hors crypto » ; en réalité, la crypto et le crowdlending n'entrent dans la projection que si vous leur avez donné un rendement attendu dans Paramètres › Répartition.
- Les titres sans aucun cours connu sont comptés à leur prix de revient : le patrimoine peut alors paraître plus stable qu'il ne l'est.
- L'alerte sur les compositions d'ETF en échec n'apparaît que pour l'administrateur de l'instance.
- Le rendement annualisé n'a pas de sens sur moins d'un an : il n'est pas affiché.
