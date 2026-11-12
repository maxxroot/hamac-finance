# Simulateurs : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page « Simulateurs » calcule ce qu'un placement vous rapporterait, avant et après impôts, avant d'y mettre de l'argent. Vous pouvez simuler cinq sortes de placements et les comparer côte à côte, pour un même montant :

- une obligation achetée en bourse ;
- des ETF ou des actions, en PEA, en compte-titres ou en assurance-vie ;
- le fonds euros d'une assurance-vie ;
- des prêts de crowdlending ;
- un livret ou un compte à terme.

Les règles fiscales appliquées sont citées sous chaque résultat.

**Rien n'est enregistré.** Vos simulations sont gardées dans l'adresse de la page. Mettez-la en favori pour y revenir, ou envoyez-la pour partager vos simulations. Elles n'utilisent pas vos comptes : seuls votre tranche d'imposition, la case « Imposition en couple » et les taux de Paramètres › Plan › Fiscalité sont repris.

La page est la même dans les deux formats de Hamac. Vous pouvez la retirer du menu en décochant le module « Simulateurs » dans Paramètres › Plan › Modules.

## Ce que vous y voyez

1. **L'en-tête**, qui rappelle que rien n'est enregistré.

2. **Les réglages communs** :
   - « Montant investi » : le même pour toutes les simulations (10 000 € au départ) ;
   - « Durée de comparaison » : « Celle de chaque placement » ou « La même pour toutes » ;
   - si la durée est commune : « Durée commune » (en années, 50 au plus) et « Taux de réinvestissement » (1,7 % par défaut, le taux du Livret A retenu par Hamac) ;
   - « Imposition des revenus » : « Le plus avantageux », « Prélèvement forfaitaire (12,8 %) » ou « Barème de l'impôt » ;
   - « Tranche d'imposition (TMI) » : celle des paramètres, ou une autre (0, 11, 30, 41 ou 45 %) ;
   - « Couple (imposition commune) ».

3. **Le tableau « Comparer ».** Une colonne par simulation. Pour chacune : rendement brut par an, rendement net d'impôts par an, gain avant impôts, impôt sur le revenu, prélèvements sociaux, gain net, valeur nette à la fin, durée, imposition retenue. La meilleure colonne pour le rendement net porte l'étiquette « meilleur ». Sous chaque nom, quatre icônes : modifier, renommer, dupliquer, supprimer. En dessous, un bouton par sorte de placement pour ajouter une simulation (8 au plus).

4. **La fiche de la simulation choisie.** Son nom, les boutons « Dupliquer » et « Supprimer », le formulaire du placement, et à côté le résultat :
   - le rendement brut et le rendement net d'impôts, par an ;
   - montant investi, gain avant impôts, impôt sur le revenu, prélèvements sociaux, gain net, date de fin ;
   - quand le choix existe, « Prélèvement forfaitaire ou barème ? » avec les deux résultats et celui qui est retenu ;
   - des remarques sur les règles appliquées à ce cas ;
   - les sources (liens vers les textes officiels).

   Si les données ne permettent pas de calcul (par exemple une échéance avant la date d'achat), un message le dit à la place du résultat.

5. **Le tableau « Année par année ».** Pour chaque année : l'argent reçu ou versé, l'impôt sur le revenu, les prélèvements sociaux et le net. Cliquez sur une année pour voir chaque opération, avec sa date et son explication.

**Les formulaires** de chaque placement :

| Placement | Champs |
|---|---|
| Obligation | Prix d'achat (en % du nominal, sans le coupon couru), coupon annuel, coupons par an, date d'achat, frais d'achat (en % et fixes), échéance, durée de détention (0 : jusqu'à l'échéance), prix de revente (0 : estimé) |
| ETF et actions | Enveloppe (PEA, compte-titres, assurance-vie en unités de compte), durée, rendement attendu par an, dividendes versés (compte-titres seulement), frais d'achat ou sur versement (en % et fixes), frais annuels (en % et fixes), frais de vente (sauf assurance-vie), ancienneté du PEA ou du contrat, date d'achat |
| Fonds euros | Taux servi (net des frais de gestion), durée, frais sur versement, ancienneté du contrat, date du versement |
| Crowdlending | Taux annuel, durée du prêt (en mois), remboursement (mensualités constantes, ou intérêts chaque mois et capital à la fin), part en défaut, date du prêt |
| Livret ou compte à terme | Type (Livret A, LDDS, LEP, exonérés ; ou livret bancaire, compte à terme, imposés), taux annuel, durée, date du dépôt |

Avec une durée commune, le champ de durée est grisé : il suit la durée commune.

## Comment faire

**Comparer deux placements.** Cliquez sur le bouton du placement voulu sous le tableau « Comparer » (par exemple « ETF et actions »). Une colonne s'ajoute et sa fiche s'ouvre. Remplissez le formulaire. Les résultats se mettent à jour à chaque frappe.

**Tester un seul changement.** Ouvrez une simulation et cliquez sur « Dupliquer ». Changez un seul réglage dans la copie, puis comparez les deux colonnes.

**Comparer sur la même durée.** Dans « Durée de comparaison », choisissez « La même pour toutes » et indiquez la durée. Toutes les simulations s'arrêtent alors le même jour.

**Renommer une simulation.** Cliquez sur l'icône crayon sous son nom, ou tapez dans le champ « Nom de la simulation ».

**Annuler une suppression.** Juste après avoir supprimé une simulation, cliquez sur « Annuler » dans le bandeau qui apparaît au-dessus du tableau.

**Garder ses simulations.** Mettez l'adresse de la page en favori. Elle contient tous vos réglages.

**Choisir l'imposition.** « Le plus avantageux » calcule les deux et garde celle qui laisse le plus grand gain net pour cette simulation. Choisissez « Barème » ou « Prélèvement forfaitaire » si vous savez déjà ce que vous choisirez sur votre déclaration.

## Comprendre les chiffres

**Rendement par an.** C'est le rendement annualisé (le taux de rendement interne, ou TRI) : il tient compte de la date de chaque somme versée ou reçue. Le **brut** ne retire aucun impôt. Le **net** retire l'impôt sur le revenu et les prélèvements sociaux. Les frais sont toujours retirés, dans les deux.

**Gain net.** Tout ce que vous recevez, moins ce que vous avez versé, après impôts. **Valeur nette à la fin** = montant investi + gain net.

**Un exemple simple.** 10 000 € sur un compte à terme à 3 % pendant un an : 300 € d'intérêts.
- Au prélèvement forfaitaire : 12,8 % d'impôt (38,40 €) et 18,6 % de prélèvements sociaux (55,80 €). Il reste 205,80 €, soit environ 2,06 % net.
- Au barème, tranche à 11 % : la part de CSG déductible (6,8 %) réduit le revenu imposé à 279,60 €, d'où 30,76 € d'impôt. Il reste 213,44 €. « Le plus avantageux » retient donc le barème.

**Les taux utilisés** (réglages par défaut de Hamac, modifiables en partie dans Paramètres › Plan › Fiscalité) :

| Règle | Valeur |
|---|---|
| Prélèvement forfaitaire (impôt) | 12,8 % |
| Prélèvements sociaux, cas général | 18,6 % pour les revenus à partir de 2026 (2025 pour les plus-values), 17,2 % avant |
| Prélèvements sociaux, assurance-vie | 17,2 % |
| Dividendes au barème | abattement de 40 % |
| CSG déductible au barème | 6,8 % du revenu, comptée la même année |
| PEA | plus d'impôt sur le revenu après 5 ans, seulement les prélèvements sociaux |
| Assurance-vie après 8 ans | abattement de 4 600 € par an (9 200 € en couple) sur les gains, puis 7,5 % au prélèvement forfaitaire |
| Pertes de crowdlending | déduites des intérêts de la même année et des 5 suivantes, 8 000 € par an au plus |

**Placement par placement.**
- **Obligation.** Les coupons sont imposés comme des intérêts l'année où vous les recevez. Le premier coupon est imposé en entier, même si vous avez payé du coupon couru à l'achat. Gardée jusqu'à l'échéance, l'obligation achetée sous 100 % donne une « prime de remboursement », imposée comme des intérêts. Achetée au-dessus de 100 %, la perte au remboursement ne se déduit pas. Revendue avant, le gain est une plus-value. Sans prix de revente saisi, Hamac l'estime en supposant que les taux du marché n'ont pas bougé depuis l'achat.
- **ETF et actions.** En compte-titres, les dividendes sont imposés chaque année et la plus-value à la vente. En PEA, rien pendant la détention ; à la sortie, prélèvements sociaux seuls après 5 ans d'ancienneté, impôt en plus avant. En assurance-vie, rien pendant la détention ; au rachat, prélèvements sociaux et impôt, avec l'abattement et le taux réduit après 8 ans.
- **Fonds euros.** Les intérêts sont crédités chaque fin d'année et les prélèvements sociaux retenus aussitôt dans le contrat. L'impôt sur le revenu vient au rachat.
- **Crowdlending.** Les intérêts sont reçus chaque mois et imposés l'année où ils arrivent. La part en défaut ne rembourse rien. Sa perte est constatée à la fin prévue du prêt et réduit l'impôt sur le revenu des intérêts de cette simulation.
- **Livret ou compte à terme.** Livret A, LDDS et LEP : rien à payer. Livret bancaire ou compte à terme : impôt et prélèvements chaque année sur les intérêts.

L'ancienneté (5 ans du PEA, 8 ans du contrat) se compte depuis l'ouverture de l'enveloppe : l'ancienneté saisie plus la durée de la simulation.

**La durée commune.** Chaque placement est ramené à la même date de fin :
- l'obligation est revendue à cette date, ou remboursée avant si son échéance arrive plus tôt ;
- le prêt est arrêté à cette date, le capital restant dû compté à sa valeur ;
- les autres placements sont gardés jusque-là.

L'argent reçu avant la fin (coupons, dividendes, remboursements) est replacé jusqu'à la fin au taux de réinvestissement, déjà net d'impôts. Le détail montre alors une ligne « Sommes replacées jusqu'à la fin ».

**Année par année.** Les intérêts qui restent placés (fonds euros, livret) ne sont pas de l'argent reçu : ils comptent pour l'impôt de l'année, et le retrait final les comprend.

## Limites

- **Le barème dépend de vos autres revenus.** Le choix du barème vaut pour tous vos revenus de placement de l'année. « Le plus avantageux » ne regarde que la simulation affichée.
- **Assurance-vie** : Hamac suppose que l'abattement annuel est entièrement disponible et que vos versements sur le contrat restent sous 150 000 €.
- **Crowdlending** : seuls les intérêts de cette simulation absorbent la perte. Avec d'autres prêts en cours, elle se déduirait davantage. Les prélèvements sociaux déjà payés ne sont pas repris. Si la durée commune arrête le prêt avant sa fin, la perte n'est pas comptée du tout.
- **Le prix de revente estimé** d'une obligation suppose des taux de marché inchangés. Si les taux montent, le prix sera plus bas.
- **Les rendements saisis sont des hypothèses**, constants chaque année. La page ne mesure pas le risque.
- **Le taux de réinvestissement** par défaut (1,7 %) est fixé dans Hamac. Il ne suit pas les changements du taux du Livret A.
- **Le PEA** : un retrait avant 5 ans clôt en principe le plan ; la simulation ne compte que l'impôt.
- **Une adresse modifiée à la main** ou abîmée reprend les valeurs par défaut pour ce qui est illisible.
