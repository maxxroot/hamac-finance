# Projection : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page « Projection » estime, année par année, ce que deviendra votre épargne jusqu'à l'année de votre départ à la retraite. Elle part de ce que vous avez aujourd'hui et de tous les versements programmés dans « Versements ». Elle en déduit ensuite le revenu mensuel que ce capital pourrait vous verser jusqu'à l'âge horizon.

Vous pouvez aussi tester des « et si » (verser plus, partir plus tôt, des marchés moins bons) sans rien changer à votre plan.

**Selon le format de Hamac** (Paramètres › Plan › Usage) :

- « Préparer ma retraite » : la page est dans le menu et fonctionne comme décrit ici.
- « Gérer mon patrimoine » : la page n'est plus dans le menu. Si vous l'ouvrez par son adresse, un message explique qu'il n'y a pas de projection de retraite et renvoie vers Paramètres › Plan.

Tant que vous n'avez aucun compte, la page affiche l'écran d'accueil à la place de la projection.

Le tableau de bord reprend les mêmes chiffres dans sa carte « Projection à … ans » (format retraite seulement). Son lien « Simuler » mène ici.

## Ce que vous y voyez

1. **L'en-tête.** Il rappelle l'année du départ et précise que les chiffres sont avant impôts et hors crypto. Le bouton « Voir le tableau » affiche ou masque le tableau année par année (point 7).

2. **Quatre résultats.**
   - « Patrimoine en *année du départ* » : la valeur estimée ce jour-là, et en dessous la même somme en euros d'aujourd'hui.
   - « Fourchette (8 chances sur 10) » : la valeur basse et la valeur haute du patrimoine au départ, selon les marchés actions.
   - « Argent versé d'ici là » : tout ce que vous aurez mis de votre poche, avec en dessous les gains et les frais estimés.
   - « Revenu mensuel possible de *âge de départ* à *âge horizon* ans » : en euros d'aujourd'hui, et en dessous le même revenu en euros de l'année du départ.

   Quand un scénario « Et si… » est actif, chaque résultat qu'il change porte une étiquette « Scénario » avec la nouvelle valeur et l'écart.

3. **Le graphique « Projection par classe d'actifs »** (en euros courants). Une barre par année, découpée en Livrets, Fonds euros, Obligations et Actions. Une part « Autres classes » s'ajoute si vous en avez fait entrer dans la projection (voir « Comment faire »). Deux lignes en pointillé tracent la fourchette basse et la fourchette haute. Une ligne « Scénario » apparaît quand un scénario est actif.

4. **La carte « Et si… ».** Vous y saisissez un versement mensuel en plus pour chaque classe (Actions, Obligations, Fonds euros, Livrets), un autre âge de départ, un autre rendement des actions ou une autre inflation. Le titre indique « ne modifie pas le plan » ou « scénario actif ». Le bouton « Revenir au plan » efface le scénario.

5. **La carte « Dépenses imprévues ».** La liste des grosses dépenses que vous voulez provisionner (année, nom, montant), et un petit formulaire pour en ajouter (Quoi, Année, Montant).

6. **La carte « Après le départ : le capital investi pendant les retraits ».** Pour la première année de retraite puis toutes les cinq années : l'âge, ce qui est retiré dans l'année et le capital qui reste.

7. **Le tableau année par année** (après « Voir le tableau »). Pour chaque année : l'âge, la part d'actions visée, la dépense imprévue de l'année, la valeur des livrets, du fonds euros, des obligations et des actions, le patrimoine, sa valeur en euros d'aujourd'hui, l'argent versé depuis le début, les gains et les frais cumulés. L'année du départ est surlignée. Les livrets s'affichent en couleur d'alerte une année où ils restent sous le plancher.

8. **La note en bas de page.** Elle résume les règles du calcul (voir « Comprendre les chiffres »).

## Comment faire

**Tester un versement de plus.** Dans « Et si… », tapez un montant mensuel dans la classe voulue, par exemple 100 € dans « Actions ». Les résultats et la ligne « Scénario » du graphique se mettent à jour. Votre plan, lui, ne change pas.

**Tester un autre âge de départ.** Tapez l'âge dans « Âge de départ ». Il est pris en compte entre 50 et 75 ans. Si l'âge de sécurisation de votre plan est plus élevé que ce nouvel âge, le scénario le ramène à l'âge de départ.

**Tester d'autres marchés.** Changez « Rendement actions » ou « Inflation ».

**Revenir à votre plan.** Cliquez sur « Revenir au plan ». Le scénario disparaît aussi si vous remettez toutes les valeurs comme dans le plan.

**Ajouter une dépense imprévue.** Dans « Dépenses imprévues », indiquez ce que c'est, l'année et le montant, puis cliquez sur « Ajouter ». Le bouton reste grisé tant qu'un des trois champs est vide. La dépense est enregistrée et la projection la retire des livrets cette année-là.

**Supprimer une dépense imprévue.** Passez la souris sur la ligne et cliquez sur l'icône de corbeille.

**Changer durablement les hypothèses.** La page ne les modifie pas : elles se règlent dans Paramètres.
- Paramètres › Plan : année de naissance, âge de départ, âge de début de sécurisation, âge horizon, inflation, rendement réel pendant la retraite, plancher et plafond des livrets.
- Paramètres › Répartition : rendement attendu de chaque classe, part d'actions visée, part d'actions à l'âge de départ.
- Les versements eux-mêmes se programment dans la page « Versements ».

**Faire entrer une autre classe dans la projection** (crowdlending, crypto, immobilier, ou une classe que vous avez créée). Dans Paramètres › Répartition, la classe doit compter dans la répartition et avoir un rendement attendu renseigné. Elle apparaît alors dans « Autres classes ».

## Comprendre les chiffres

**Le point de départ.** C'est la valeur actuelle de vos placements, rangée en quatre classes : livrets, fonds euros, obligations, actions. Les autres classes (crypto, crowdlending, immobilier, classes créées) ne sont comptées que si elles remplissent la condition ci-dessus.

**Chaque année**, dans l'ordre :

1. Chaque classe rapporte son rendement attendu, moins les frais annuels estimés de vos établissements.
2. Les versements programmés de l'année s'ajoutent en fin d'année, moins les frais sur versements. Un versement va dans la classe que son compte représente :

   | Compte | Classe dans la projection |
   |---|---|
   | Livret | Livrets |
   | Assurance-vie, PER assurantiel | Fonds euros |
   | PER bancaire, épargne salariale, PEA, PEA-PME | Actions |
   | Compte-titres | Obligations |

3. La dépense imprévue de l'année, s'il y en a une, est retirée des livrets.
4. Si les livrets dépassent le plafond de votre plan, l'excédent part au fonds euros.
5. Si les livrets passent sous le plancher, le fonds euros les complète autant qu'il le peut.
6. À partir de l'âge de sécurisation, les versements prévus en actions vont au fonds euros. Si la part des actions dépasse la part visée pour cet âge, l'excédent passe au fonds euros. La part visée baisse en ligne droite, de la part de votre répartition à l'âge de sécurisation jusqu'à la « part actions à l'âge de départ ».

Les versements s'arrêtent après l'année de vos *âge de départ* ans. Votre âge une année donnée est cette année moins votre année de naissance.

**En euros d'aujourd'hui.** La somme est divisée par l'inflation cumulée depuis cette année. Par exemple, avec 2 % d'inflation par an, 100 000 € dans 10 ans valent environ 82 000 € d'aujourd'hui.

**Argent versé d'ici là.** Ce que vous avez déjà versé (versements moins retraits, hors comptes crypto et crowdlending non projetés), plus tous les versements prévus jusqu'au départ, frais compris.

**Gains.** Le patrimoine moins l'argent versé, plus les dépenses imprévues déjà payées. Une dépense ne fait donc pas baisser les gains.

**Frais estimés.** Le cumul des frais sur versements (assurance-vie), du courtage des achats (un achat par mois en PEA, un par an en compte-titres), des droits de garde, et des frais annuels sur l'encours (frais de gestion du fonds euros, droits de garde en pourcentage). Ils viennent des tarifs saisis pour vos établissements.

**La fourchette.** Hamac refait la projection 300 fois. Chaque fois, les actions ont un rendement différent chaque année, tiré au hasard autour de votre hypothèse, avec des écarts du niveau des marchés actions (16 % par an). Les autres classes gardent leur rendement. La valeur basse est dépassée dans 9 cas sur 10, la valeur haute dans 1 cas sur 10. Il y a donc 8 chances sur 10 de finir entre les deux. Le tirage est toujours le même : la fourchette ne bouge pas d'une visite à l'autre.

**Le revenu mensuel possible.** Hamac prend le capital investi au départ, sans les livrets, et le convertit en euros d'aujourd'hui. Il calcule le montant mensuel fixe qui épuise ce capital à l'âge horizon, en supposant qu'il rapporte le « rendement réel pendant la retraite » (rendement après inflation). Par exemple, 120 000 € d'aujourd'hui sur 25 ans, avec un rendement réel nul, donnent 400 € par mois. Avec un rendement réel positif, le montant est un peu plus élevé. Le revenu « en *année du départ* » est le même montant en euros de cette année-là.

**Après le départ.** Le retrait mensuel augmente avec l'inflation. Le capital restant rapporte le rendement réel plus l'inflation. Le capital s'approche de zéro à l'âge horizon.

## Limites

- **Avant impôts.** Ni l'impôt sur le revenu ni les prélèvements sociaux ne sont retirés, ni pendant l'épargne ni pendant les retraits.
- **Modèle par année.** Les versements arrivent en fin d'année. La première année du tableau est la valeur d'aujourd'hui : les versements qui restent à faire cette année ne sont pas comptés.
- **Classes simplifiées.** Un versement en assurance-vie compte comme du fonds euros, même s'il va sur des unités de compte. Un versement en compte-titres compte comme des obligations. Ce qui est déjà placé, en revanche, est rangé selon son vrai contenu.
- **Crypto et crowdlending** ne sont pas projetés, sauf si vous leur donnez un rendement attendu (voir « Comment faire »).
- **Dépenses imprévues.** Seules celles des années après l'année en cours, jusqu'à l'année du départ, sont comptées. Les projets de la page « Projets » ne sont pas retirés de la projection.
- **Plafond des livrets.** C'est le plafond de votre plan, pour l'ensemble des livrets, et non le plafond légal de chaque livret.
- **Rééquilibrage partiel.** Après l'âge de sécurisation, la part d'actions est ramenée vers le bas si elle dépasse sa cible, jamais vers le haut.
- **La fourchette** ne fait varier que les actions. L'inflation, le fonds euros et les obligations suivent toujours leur hypothèse.
- **Frais moyens.** Les frais sur l'encours sont une moyenne pondérée par la valeur actuelle des comptes. Les frais des PER et de l'épargne salariale ne sont pas comptés.
- **Rien n'est garanti**, hormis les livrets, le fonds euros et les obligations gardées jusqu'à l'échéance.
