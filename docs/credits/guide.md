# Crédits : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Crédits** suit vos emprunts : crédit immobilier, crédit travaux, crédit à la consommation, crédit auto ou autre. À partir du montant, du taux et de la durée, Hamac calcule l'échéance, le capital restant dû, le coût des intérêts et de l'assurance, année par année. Si votre banque vous donne d'autres chiffres, vous pouvez les reprendre d'un relevé.

Le capital restant dû, pour la part à votre charge, est retiré de votre patrimoine net. La page aide aussi à décider s'il vaut mieux rembourser par avance ou placer la même somme, et montre le poids de vos crédits par rapport à votre patrimoine et à vos revenus.

La page apparaît dans le menu si le module « Crédits » est activé (Paramètres › Plan › Modules).

## Ce que vous y voyez

1. **En-tête** avec le bouton « Nouveau crédit ».
2. **Trois chiffres :**
   - *Capital restant dû*, pour la part à votre charge ;
   - *Mensualités*, pour la part à votre charge, assurance comprise ;
   - *Patrimoine net*, après crédits.
3. **Le tableau des crédits en cours** (non archivés), un crédit par ligne :
   - le nom, le type et le bien rattaché ;
   - *Taux* : le taux d'intérêt, et le taux de l'assurance si elle est en pourcentage ;
   - *Mensualité* : l'échéance du mois, assurance comprise, avec la part d'assurance et, si le crédit est partagé, la part à votre charge ;
   - *Coût total* : intérêts et assurance sur toute la durée ;
   - *Capital restant dû*, avec le badge « d'après relevé » s'il vient d'un relevé, et la part à votre charge ;
   - *Échéances restantes* et date de *Fin* ;
   - modifier et supprimer.

   Un clic sur une ligne ouvre son **détail** :
   - les totaux de capital, d'intérêts et d'assurance sur toute la durée ;
   - un graphique en barres, année par année : capital remboursé, intérêts, assurance ;
   - « Voir le détail par année » : le même tableau en chiffres, avec le reste dû en fin d'année ;
   - les **remboursements anticipés** du crédit, avec le bouton « Ajouter ».
4. **Poids des crédits**, s'il reste au moins un crédit avec des échéances à payer :
   - *Patrimoine financé à crédit* : la part de ce que vous possédez qui est encore due ;
   - *Taux d'effort* : vos mensualités rapportées à vos revenus nets, en rouge au-delà de 35 % ; sans revenus saisis, un lien vers Paramètres › Plan ;
   - *Mensualités*, assurance comprise ;
   - pour chaque bien qui a un crédit : une barre qui montre la part encore due à la banque ;
   - un tableau : taux, taux assurance comprise, intérêts et assurance qui restent à payer.
5. **Rembourser par avance ou placer ?**, s'il reste au moins un crédit avec des échéances : un formulaire de comparaison et son résultat.
6. **Crédits archivés** : montant emprunté et date à laquelle le crédit a été soldé.

Le tableau de bord vous prévient aussi quand vos mensualités dépassent 35 % de vos revenus nets.

## Comment faire

**Ajouter un crédit.**

1. Cliquez sur « Nouveau crédit ».
2. Choisissez le type. Un crédit immobilier ou travaux peut être rattaché à un bien.
3. Indiquez le montant emprunté, le taux d'intérêt annuel hors assurance, la durée en mois et la date de la première échéance.
4. Indiquez l'assurance (voir plus bas).
5. Un aperçu affiche l'échéance du mois, le capital restant dû aujourd'hui, la dernière échéance et le coût total. Validez.

**Un crédit remboursé à deux.** Saisissez le crédit entier et mettez 50 % dans « Part à ma charge ». Si vous saisissez directement votre part du crédit, laissez 100 %.

**L'assurance emprunteur.** Trois façons de la saisir, selon votre offre :

- *Montant fixe* : le montant par mois ;
- *Capital emprunté* : un taux annuel appliqué au montant emprunté, la prime ne change pas ;
- *Capital restant dû* : un taux annuel appliqué à ce qui reste à rembourser, la prime baisse avec le temps.

Si la quotité assurée n'est pas de 100 %, multipliez le taux par la quotité.

**Un différé.** Indiquez le nombre de premières échéances en différé (comprises dans la durée) et son type :

- *Partiel* : vous ne payez que les intérêts ;
- *Total* : vous ne payez rien, les intérêts s'ajoutent au capital.

L'assurance reste due pendant le différé.

**Reprendre les chiffres d'un relevé.** Dans « Saisie manuelle », indiquez l'échéance hors assurance, ou le capital restant dû et sa date. Le capital et sa date vont ensemble. Le calcul repart du relevé à cette date.

**Rattacher un crédit à un bien.** Dans le formulaire, choisissez le bien concerné (crédit immobilier ou travaux seulement). Le crédit apparaît alors dans l'onglet Finances du bien et compte dans sa valeur nette.

**Noter un remboursement anticipé.**

1. Ouvrez le détail du crédit, puis « Ajouter » dans Remboursements anticipés.
2. Indiquez la date, le capital remboursé, l'indemnité payée à la banque (facultative) et ce qui change ensuite : la durée ou la mensualité.
3. Enregistrez. L'échéancier, le capital restant dû et le graphique se recalculent.

**Comparer « rembourser ou placer ».** Dans la dernière carte, choisissez le crédit, la somme disponible (pour le crédit entier), ce qui change après le remboursement, l'indemnité et le placement de comparaison. L'indemnité est préremplie avec le maximum légal ; changez-la si votre contrat prévoit moins, souvent 0 €. Le rendement du placement est prérempli d'après les hypothèses du plan, net d'impôts ; « Autre taux » permet d'en saisir un.

**Faire apparaître le taux d'effort.** Indiquez les revenus nets du foyer par mois dans Paramètres › Plan.

**Archiver un crédit soldé.** Ouvrez-le et cochez « Archivé » : il ne compte plus dans le patrimoine. Pour le rétablir, ouvrez-le dans « Crédits archivés » et décochez la case. La vente d'un bien peut aussi solder ses crédits (voir le [guide de l'immobilier](../immobilier/guide.md)).

**Supprimer un crédit.** Le bouton de suppression demande confirmation. Les remboursements anticipés du crédit sont supprimés avec lui.

## Comprendre les chiffres

**L'échéance.** Pour un prêt à taux fixe, l'échéance hors assurance est constante. Exemple : 100 000 € à 3 % sur 20 ans donnent 554,60 € par mois. Avec une assurance de 0,30 % par an sur le capital emprunté (25 € par mois), la mensualité est de 579,60 €. À taux zéro, l'échéance est le montant divisé par le nombre de mois.

**Le capital restant dû.** Ce qui reste à rembourser après la dernière échéance passée. Une échéance compte dès sa date. Un remboursement anticipé compte dès sa date, même s'il ne s'applique à l'échéancier qu'à l'échéance suivante. Avant la première échéance, le capital restant dû est le montant emprunté ; dans l'Historique, en revanche, le crédit ne compte qu'à partir de sa première échéance.

**La part à votre charge.** Capital restant dû et mensualité × part à votre charge. Pour un crédit d'un bien détenu par une SCI, vos parts de la société s'appliquent en plus.

**Après un remboursement anticipé.**

- *Réduire la durée* : la mensualité reste la même, le crédit se termine plus tôt.
- *Réduire la mensualité* : la durée reste la même, la mensualité est recalculée sur le capital restant.

L'indemnité est comptée avec les intérêts du mois.

**Le coût total.** Tous les intérêts et toute l'assurance sur la durée du crédit, indemnités de remboursement anticipé comprises.

**Patrimoine financé à crédit.** Capital restant dû à votre charge ÷ tout ce que vous possédez (patrimoine financier, immobilier et autres biens), avant dettes.

**Taux d'effort.** Mensualités à votre charge, assurance comprise ÷ revenus nets du foyer par mois. Au-delà de 35 %, les banques refusent en général un nouveau crédit immobilier (décision du Haut Conseil de stabilité financière du 29 septembre 2021). Exemple : 1 400 € de mensualités pour 4 000 € de revenus font 35 %.

**Part de chaque bien encore due.** Capital restant dû à votre charge sur les crédits du bien ÷ valeur de votre part du bien.

**Taux assurance comprise.** Le taux qui égale le capital restant dû à toutes les échéances restantes, assurance incluse. C'est ce que rapporte, sans risque, chaque euro remboursé par avance. Dans l'exemple plus haut, il est d'environ 3,50 % au lieu de 3 %.

**Indemnité maximale.** Pour un crédit immobilier ou travaux : six mois d'intérêts sur la somme remboursée, au taux du crédit, sans dépasser 3 % du capital restant dû avant le remboursement. Exemple : 20 000 € remboursés sur un crédit à 3 % donnent au plus 300 €. Pour un crédit à la consommation ou auto : rien si les remboursements anticipés des douze derniers mois ne dépassent pas 10 000 € ; sinon 1 % de la somme s'il reste plus d'un an, 0,5 % sinon. Pour un « autre crédit », l'aide renvoie à votre contrat.

**Rembourser ou placer.** Hamac compare, à la date de fin prévue du crédit, deux usages de la même somme :

- *Rembourser* : chaque mois, ce que vous ne payez plus à la banque est placé au rendement choisi, jusqu'à la fin prévue ;
- *Placer* : la somme, indemnité comprise, est placée d'un coup au même rendement, jusqu'à la même date.

Le résultat donne l'écart entre les deux, les intérêts et l'assurance économisés, la nouvelle date de fin ou la nouvelle mensualité, et le **taux d'équilibre** : au-delà de ce rendement net, placer rapporte plus. Les montants sont pour votre part.

**Les placements de comparaison.** Livret réglementé au taux du plan ; fonds euros après prélèvements sociaux ; obligations après prélèvement forfaitaire (impôt et prélèvements sociaux) ; actions sur un PEA de plus de cinq ans, après prélèvements sociaux. Les taux viennent de vos hypothèses dans Paramètres › Plan.

## Limites

- Seuls les prêts à taux fixe, à échéances mensuelles, sont calculés. Pour un prêt à taux variable, in fine ou à paliers, reprenez l'échéance et le capital restant dû de vos relevés.
- Les règles de l'indemnité et du taux d'effort viennent de sources secondaires, vérifiées le 11 novembre 2026 : les textes officiels restent à relire. Elles ne disent pas ce que prévoit votre contrat.
- La comparaison « rembourser ou placer » ne tient pas compte du risque du placement, ni des intérêts déductibles d'un bien loué. L'argent remboursé ne revient pas : gardez de quoi faire face aux imprévus. Elle part toujours d'aujourd'hui.
- Le taux d'effort ne connaît que les revenus que vous saisissez. Les loyers perçus ne s'y ajoutent pas d'eux-mêmes (les banques en retiennent en général 70 %).
- Un crédit archivé à la main, sans vente de bien, disparaît de l'Historique, y compris pour les dates où il courait. Un crédit soldé par la vente d'un bien y reste jusqu'à la date de vente.
- Si l'échéance saisie à la main est plus forte que nécessaire, le capital tombe à zéro avant la fin, mais la mensualité reste comptée jusqu'à la durée saisie. Corrigez alors la durée.
- Le chiffre *Patrimoine net* de la page compte aussi les autres biens, même si son sous-titre ne cite que le financier et l'immobilier.
