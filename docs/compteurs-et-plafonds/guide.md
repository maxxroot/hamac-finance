# Compteurs et plafonds : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Compteurs et plafonds** (menu Fiscalité) rassemble ce qui avance avec le temps et ce qui limite vos versements :

- la date à laquelle un PEA atteint 5 ans et une assurance-vie 8 ans, deux caps où l'impôt baisse ;
- ce que vous avez déjà versé face au plafond de chaque enveloppe ;
- l'abattement annuel de l'assurance-vie déjà utilisé cette année ;
- les donations faites ou reçues, et les abattements qu'il reste.

Un complément, la **liste de fin d'année**, chiffre ce qui ne se fait que jusqu'au 31 décembre. Elle s'affiche en bas de la page Impôts, mais repose sur ces compteurs : elle est décrite ici.

Ce sont des estimations sans valeur officielle, à adapter à votre situation. La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu si vous masquez le module « Impôts » dans Paramètres › Plan › Modules.

## Ce que vous y voyez

### Ancienneté des contrats

Une ligne par PEA, PEA-PME et assurance-vie non archivés : le nom, « 5 ans » ou « 8 ans », puis :

- « Atteints le … » si la date est passée ;
- sinon la date et le nombre de mois restants ;
- « date d'ouverture à renseigner » si elle manque.

Sans PEA ni assurance-vie, la carte le dit.

### Plafonds de versement

Une ligne par plafond, avec une barre de remplissage : ce qui compte, le plafond, ce qui reste, et une note.

- **PEA** : vos versements face à 150 000 €.
- **PEA + PEA-PME** : les versements des deux plans ensemble face à 225 000 € (si vous avez un PEA-PME).
- **Chaque livret réglementé** (LEP, LDDS, Livret A) : son solde face à son plafond.
- **PER** : vos versements de l'année face à votre plafond de déduction, si vous l'avez indiqué dans Paramètres › Plan.

Sans aucun compte plafonné, la carte invite à indiquer votre plafond PER.

### Assurance-vie

Si vous avez une assurance-vie :

- l'abattement annuel sur les gains retirés (4 600 €, ou 9 200 € en couple) ;
- les gains déjà retirés cette année sur des contrats de plus de 8 ans ;
- ce qui reste possible sans impôt sur le revenu ;
- vos versements avant 70 ans et après 70 ans, qui ne suivent pas les mêmes règles pour la transmission.

### Donations

Le bouton **Noter une donation** ouvre une fenêtre. Puis deux tableaux :

- **Par personne** : abattement utilisé sur l'abattement total, restant, don familial d'argent restant, montant au-delà (en rouge s'il y en a), date de renouvellement.
- **La liste des donations** notées, avec modifier et supprimer.

Une note rappelle les règles du don familial d'argent et des présents d'usage.

### Sources

En bas de page : la date de vérification des règles et les liens vers les sources officielles (service-public.gouv.fr pour les donations, AMF pour les plafonds du PEA).

### Liste de fin d'année

En bas de la page **Impôts**, une ligne repliée : « Liste de fin d'année », le nombre de gestes à faire avant le 31 décembre et, si elle se chiffre, l'économie d'impôt totale. Dépliée, elle montre un geste par carte, avec une case à cocher, l'économie estimée, le détail, des lignes concrètes et un lien « Voir le détail ». En novembre et en décembre, le tableau de bord la rappelle quand au moins un geste fait économiser de l'impôt.

Les gestes possibles :

1. **Réaliser des moins-values sur le compte-titres**, si vous avez des plus-values imposables cette année et des titres en perte.
2. **Utiliser l'abattement de l'assurance-vie**, s'il en reste et qu'un contrat a plus de 8 ans et du gain.
3. **Verser sur le PER avant le 31 décembre**, s'il reste du plafond de déduction.
4. **Vérifier les plafonds disponibles** (PEA, livrets réglementés), s'il en reste.
5. **Préparer la déclaration du printemps**, toujours présent.

## Comment faire

**Suivre la date des 5 ans ou des 8 ans**
1. Ouvrez Paramètres › Comptes et modifiez le compte.
2. Renseignez sa date d'ouverture.
3. La date apparaît dans « Ancienneté des contrats ».

**Suivre le plafond PER**
1. Relevez le plafond de déduction sur votre avis d'impôt.
2. Saisissez-le dans Paramètres › Plan › Fiscalité, champ « Plafond de déduction PER ».
3. La ligne « Versements sur le PER » apparaît dans les plafonds.

**Noter une donation**
1. Cliquez sur **Noter une donation**.
2. Choisissez le sens (« Je donne » ou « Je reçois »), la date, la personne et son lien avec le donateur. L'aide du champ affiche l'abattement correspondant.
3. Choisissez le type : donation, don familial de sommes d'argent, ou présent d'usage (non compté).
4. Saisissez le montant, et un commentaire si besoin (acte notarié, déclaration 2735…).
5. Cliquez sur **Enregistrer**. Pour corriger ou supprimer, utilisez les actions au bout de la ligne.

Écrivez le nom de la personne de la même façon à chaque fois : les donations sont regroupées par sens, par nom (sans tenir compte des majuscules) et par lien.

**Utiliser la liste de fin d'année**
1. En novembre, ouvrez Impôts et dépliez la liste en bas de page.
2. Lisez chaque geste et suivez « Voir le détail ».
3. Cochez ce qui est fait. Les cases sont gardées pour l'année et repartent à zéro l'année suivante.

## Comprendre les chiffres

**Ancienneté.** Date d'ouverture + 5 ans pour un PEA ou PEA-PME, + 8 ans pour une assurance-vie.

**Versements du PEA.** Hamac compte les versements bruts : le versé net, plus ce qui est ressorti (retraits et transferts sortants). Un retrait ne libère donc pas de plafond. Les plus-values et les dividendes ne comptent pas : la valeur du plan peut dépasser 150 000 €.

**Livrets.** Hamac compare le solde au plafond : celui que vous avez noté sur le livret, sinon le plafond légal (LEP 10 000 €, LDDS 12 000 €, Livret A 22 950 €). Les intérêts peuvent faire dépasser le plafond.

**PER.** Versements bruts depuis le 1er janvier : versements bruts d'aujourd'hui moins ceux du 31 décembre précédent.

**Abattement de l'assurance-vie.** Un retrait contient une part de gain. Hamac la calcule la veille du retrait : part de gain = retrait × (1 − versé net / valeur du contrat). Exemple fictif : un contrat vaut 20 000 € pour 12 000 € versés, soit 40 % de gain. Un retrait de 5 000 € fait sortir 2 000 € de gain. Seuls les retraits de l'année sur des contrats qui avaient déjà 8 ans comptent. Ce qui reste = abattement − gains retirés.

**Avant et après 70 ans.** Hamac compte vos versements bruts jusqu'au 1er janvier de l'année de vos 70 ans (d'après votre année de naissance), et le reste après.

**Donations.** Chaque abattement vaut par donateur et par bénéficiaire, et se renouvelle tous les 15 ans. Hamac additionne les donations des 15 dernières années pour chaque personne. Abattements utilisés :

| Lien du bénéficiaire avec le donateur | Abattement tous les 15 ans |
|---|---|
| Enfant | 100 000 € |
| Parent ou grand-parent | 100 000 € |
| Époux ou partenaire de Pacs | 80 724 € |
| Petit-enfant | 31 865 € |
| Frère ou sœur | 15 932 € |
| Neveu ou nièce | 7 967 € |
| Arrière-petit-enfant | 5 310 € |
| Autre | aucun |

Le **don familial de sommes d'argent** ajoute 31 865 € pour un enfant, un petit-enfant, un arrière-petit-enfant, ou un neveu ou une nièce (si le donateur n'a pas de descendant). Il faut un donateur de moins de 80 ans et un bénéficiaire majeur. Un don de ce type s'impute d'abord sur ces 31 865 €, le reste sur l'abattement de parenté. Exemple fictif : à un enfant, un don familial de 40 000 € utilise 31 865 € de don familial et 8 135 € d'abattement. Ce qui dépasse les abattements est soumis aux droits de donation. La date de renouvellement est celle où la plus ancienne donation comptée aura 15 ans. Les présents d'usage (anniversaire, mariage, dans la mesure de vos revenus) ne comptent pas.

**Liste de fin d'année.** Les économies sont estimées avec les taux de Paramètres › Plan :

- **Moins-values** : la perte utilisable est la plus petite entre vos plus-values imposables de l'année et le total de vos pertes latentes. Économie = perte utilisable × (taux d'impôt + prélèvements sociaux). Le taux d'impôt est le plus bas entre votre tranche et 12,8 %. Racheter aussitôt le même titre pour la seule économie d'impôt peut être contesté (abus de droit).
- **Assurance-vie** : économie = abattement restant × le plus bas entre votre tranche et 7,5 %. Pour chaque contrat éligible, Hamac donne le retrait qui fait sortir ce gain : abattement restant / part de gain du contrat. Exemple fictif : 4 600 € d'abattement, un contrat dont 40 % de la valeur est du gain : un retrait de 11 500 €. On peut ensuite reverser la somme. Les prélèvements sociaux restent dus sur les gains des unités de compte.
- **PER** : économie = plafond restant × votre tranche. Avec une tranche à 0 %, rien n'est économisé. L'argent reste bloqué jusqu'à la retraite et la sortie sera imposée.
- **Plafonds** et **déclaration** : pas de chiffre. La déclaration rappelle de choisir entre le prélèvement forfaitaire et le barème (une option pour tous les revenus de l'année) et de contrôler chaque document fiscal avec l'[aide à la déclaration](../aide-a-la-declaration/guide.md).

## Limites

- Les conditions du don familial (âge du donateur, majorité du bénéficiaire, absence de descendant pour un neveu ou une nièce) ne sont pas vérifiées : à vous de les respecter.
- L'âge de 70 ans est compté au 1er janvier de l'année, pas à la date exacte de votre anniversaire.
- Les versements avant et après 70 ans sont affichés, mais leurs règles de transmission ne sont pas calculées.
- Plafonds des livrets : comparés au solde, intérêts compris.
- Le plafond PER n'est suivi que si vous l'avez saisi. Hamac ne le calcule pas : il reprend le montant lu sur votre avis d'impôt.
- La liste de fin d'année n'est pas une recommandation personnalisée.
- Les règles ont été vérifiées le 11 novembre 2026. Elles changent : la date de vérification est rappelée en bas de page.
