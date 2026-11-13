# Aide à la déclaration : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Aide à la déclaration** (menu Fiscalité) prépare votre déclaration de revenus du printemps. Pour une année de revenus, elle dit **quoi reporter, dans quelle case, et d'après quelles opérations** du Journal. Le document s'appelle le « Récapitulatif fiscal ».

> Document d'aide établi à partir de vos saisies. Il ne remplace ni l'IFU de l'établissement ni la notice officielle, et vous restez responsable de votre déclaration.

L'**IFU** (imprimé fiscal unique) est le document annuel que votre banque ou votre courtier vous envoie et transmet aussi au fisc. Les montants qu'il contient sont en général déjà préremplis sur votre déclaration.

La page couvre les comptes-titres, le crowdlending et la crypto. Les autres comptes (livrets, PEA, assurance-vie, PER…) sont listés à part, sans calcul : leur établissement fournit le document fiscal. La page ne calcule pas l'impôt final : pour une estimation, voyez la page [Impôts](../impots/guide.md).

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu si vous masquez le module « Impôts » dans Paramètres › Plan › Modules. Sans aucun compte, elle affiche l'écran d'accueil.

## Ce que vous y voyez

### En-tête et choix

- Deux boutons : **Détail (CSV)** et **Imprimer ou enregistrer en PDF**.
- **Année de revenus** : de l'année de votre première opération concernée à l'année en cours. Par défaut, l'an dernier, celle qui se déclare au printemps.
- **Document** : « Récapitulatif fiscal complet », ou « Récapitulatif fiscal – *nom de l'établissement* » pour chaque établissement dont Hamac rédige la fiche.
- Si aucun établissement n'a de fiche, un message indique où cocher la case.

### Titre du document

Le nom du document, une étiquette « À saisir » sur une fiche d'établissement, puis : « Revenus 2025 · Déclaration 2026 · Édité le … ». Deux encadrés suivent :

- **l'année de validité des règles** : « Règles vérifiées le … d'après : … » si l'année a été vérifiée ; sinon, en orange, « Aucune règle vérifiée pour les revenus … : numéros de case repris des revenus …, à titre indicatif » ;
- le rappel que c'est un document d'aide.

### Contrôles

- Sur le récapitulatif complet : un message vert quand la somme des fiches correspond au récapitulatif.
- Un encadré « points à contrôler » liste les anomalies (en rouge, les erreurs). Exemples : une vente sans achat connu, un compte sans établissement, une cession d'obligation, un écart avec le document de l'établissement, un retrait d'assurance-vie ou de PEA non calculé ici, une année aux cases non vérifiées.

### Récapitulatif fiscal complet

1. **Cases à reporter** : case, formulaire (2042 ou 2042 C), libellé, part **à saisir**, part **à contrôler avec l'IFU**, total, statut. Les plus-values sont un montant « global » : elles se calculent tous établissements confondus.
2. **Répartition par établissement** : revenus bruts, acompte retenu, résultat des cessions, cessions crypto. Cliquez sur le nom d'un établissement « à saisir » pour ouvrir sa fiche.
3. **Plus et moins-values de valeurs mobilières** (si vous avez vendu) : plus-values, moins-values, résultat de l'année, moins-values des années passées imputées, moins-values encore reportables et jusqu'à quand.
4. **Actifs numériques (portefeuille global)** (si vous avez vendu des cryptos) : total des cessions, résultat net, seuil d'exonération atteint ou non.
5. **Autres comptes** : chaque compte non couvert, avec la raison (« Rien à déclarer sans retrait… », « voir l'IFU de l'assureur »…).
6. **Rappels** : formulaires à joindre et options à choisir.

### Fiche d'un établissement

1. **Comptes concernés**.
2. **Cases à reporter** : case, formulaire, libellé, montant, statut.
3. **Détail des revenus** : chaque dividende ou intérêt, avec le reçu, le brut, l'acompte, les prélèvements sociaux, la retenue étrangère et le statut.
4. **Cessions de titres (détail pour la 2074)** : quantité, prix de cession net, prix de revient, plus ou moins-value, puis le résultat de cet établissement avant compensation avec les autres.
5. **Cessions d'actifs numériques (détail pour la 2086)** : prix de cession, frais, valeur globale du portefeuille, prix d'acquisition imputé, plus ou moins-value.
6. **Comparer avec le document de l'établissement** : une ligne par case, avec le montant de Hamac, un champ pour le montant du document, et l'écart.

### Les statuts

- **Calculé** : Hamac a toutes les données.
- **À vérifier** : une hypothèse a été faite (taux de retenue supposé, distribution d'ETF, obligation, crédit d'impôt étranger, valeur crypto estimée…).
- **Donnée manquante** : il manque une information, par exemple l'achat d'un titre vendu.

Une ligne prend le statut le plus défavorable de ses opérations.

## Comment faire

**Faire rédiger la fiche d'un établissement**
1. Ouvrez Paramètres › Établissements et modifiez l'établissement.
2. Dans la section Fiscalité, cochez « Hamac rédige le récapitulatif fiscal de cet établissement ».
3. Cochez-la seulement si l'établissement ne transmet rien au fisc. Ses montants deviennent « à saisir ».
4. Sans la case, ses montants sont « à contrôler » avec son IFU : ils sont normalement déjà préremplis, ne les déclarez pas une seconde fois.

**Régler les retenues d'un établissement**
1. Dans la même section, cochez ou décochez « L'établissement prélève les impôts sur les intérêts et dividendes ».
2. S'il prélève à d'autres taux que ceux de Paramètres › Plan, indiquez seulement le taux qui diffère (0 s'il ne retient rien).
3. Pour un revenu précis, vous pouvez aussi noter au Journal le brut et les retenues lus sur le relevé : ils priment.

**Préparer la déclaration**
1. Choisissez l'année de revenus.
2. Lisez les contrôles et corrigez ce qui est en rouge (souvent une opération manquante au Journal).
3. Dans « Cases à reporter », recopiez la colonne « À saisir » sur votre déclaration en ligne.
4. Comparez la colonne « À contrôler avec l'IFU » avec ce qui est prérempli.
5. Lisez les rappels : formulaires 2074, 2086, 2047, 3916 ou 3916-bis selon votre cas.

**Comparer avec le document de l'établissement**
1. Ouvrez la fiche de l'établissement.
2. Dans le dernier bloc, recopiez les montants de son document fiscal, case par case.
3. L'écart s'affiche aussitôt. Cliquez sur **Enregistrer les montants** pour les garder : un écart d'au moins 1 € apparaît alors dans les points à contrôler.

**Imprimer ou garder un PDF**
1. Choisissez l'année et le document.
2. Cliquez sur **Imprimer ou enregistrer en PDF**, puis choisissez « Enregistrer au format PDF » dans la fenêtre d'impression du navigateur.
3. Les boutons et les listes de choix ne sont pas imprimés. Le bloc de comparaison ne l'est que si vous y avez saisi au moins un montant. Attention : en mode discret, les montants apparaissent quand même sur le papier.

**Exporter le détail**
Cliquez sur **Détail (CSV)** : un fichier `recapitulatif-fiscal-<année>.csv` contient chaque revenu, cession et cession crypto, avec l'établissement, le traitement, le brut, les retenues, le prix de revient, le gain, le statut et la remarque.

## Comprendre les chiffres

**Brut et retenues d'un revenu.** Vous saisissez ce qui arrive sur le compte. Hamac retrouve le brut :

- si vous avez noté le brut et les retenues, il les prend ;
- si l'établissement ne prélève rien, le montant reçu est le brut ;
- sinon, il applique les taux de l'établissement, ou ceux de Paramètres › Plan : 12,8 % d'acompte (0 % sur les intérêts d'une année et d'un établissement où vous êtes dispensé, cochés dans la page Impôts) et les prélèvements sociaux de l'année. Ce dernier cas est « À vérifier », sauf si les deux taux sont réglés sur l'établissement ou si Hamac rédige sa fiche.

Exemple fictif, revenus 2026, taux par défaut : un dividende de 68,60 € reçu donne 100 € bruts (case 2DC), 12,80 € d'acompte (case 2CK) et 18,60 € de prélèvements sociaux. Les 100 € comptent aussi en case 2BH, puisque les prélèvements sociaux ont déjà été retenus.

**Les cases.** Pour les revenus 2025 (vérifiées le 9 novembre 2026, d'après la Brochure pratique IR 2026 d'impots.gouv.fr) :

| Case | Formulaire | Ce que Hamac y met |
|---|---|---|
| 2DC | 2042 | Dividendes bruts. Distributions d'ETF ou de fonds : « À vérifier », la répartition avec les intérêts est sur le relevé. |
| 2TR | 2042 | Intérêts bruts (hors crowdlending). |
| 2TT | 2042 | Intérêts bruts des prêts participatifs et des minibons (crowdlending). |
| 2BH | 2042 | Revenus bruts sur lesquels les prélèvements sociaux ont déjà été retenus. |
| 2CK | 2042 | Acompte d'impôt déjà retenu. |
| 2AB | 2042 | Retenues à l'étranger, toujours « À vérifier » (le crédit d'impôt dépend de la convention du pays). |
| 3VG | 2042 C | Plus-value des comptes-titres, après compensation entre établissements et imputation des moins-values passées. |
| 3VH | 2042 C | Moins-value de l'année seulement. |
| 3AN | 2042 C | Plus-value crypto de l'année (0 si exonérée), report de la 2086. |
| 3BN | 2042 C | Moins-value crypto de l'année, report de la 2086. |

**À saisir ou à contrôler.** Chaque case additionne les fiches. La part « à saisir » vient des établissements dont Hamac rédige la fiche, la part « à contrôler » des autres. Le total est la somme des deux.

**Plus-values des comptes-titres.** Le gain d'une vente est le prix de cession net moins le prix de revient moyen du compte. Les gains et les pertes de tous les établissements se compensent. Une perte restante se reporte sur les 10 années suivantes, la plus ancienne d'abord. Exemple fictif : 1 000 € de gain chez un courtier, 300 € de perte chez un autre, 200 € de perte reportée d'il y a deux ans : 3VG = 1 000 − 300 − 200 = 500 €. Seules les pertes que Hamac connaît par votre Journal sont reportées.

**Crypto.** Même calcul que sur la page Impôts : le gain de chaque vente contre des euros se calcule sur tout le portefeuille crypto, toutes plateformes (article 150 VH bis du code général des impôts). Si le total des ventes de l'année ne dépasse pas 305 €, la plus-value est exonérée, mais la 2086 reste à joindre.

**Année non vérifiée.** Les cases changent d'une campagne à l'autre. Tant qu'une année n'a pas été vérifiée dans Hamac, les numéros de case de la dernière année vérifiée sont repris, marqués « indicative », et un avertissement s'affiche. Hamac ne réutilise jamais en silence les règles d'une autre année.

## Limites

- Ce n'est pas un calcul d'impôt et ce n'est pas un document officiel. L'IFU de l'établissement et la notice officielle font foi.
- Livrets, PEA, assurance-vie, PER et épargne salariale ne sont pas calculés : un retrait sur ces comptes est seulement signalé.
- Parts de SCPI vendues : elles relèvent des plus-values immobilières et ne sont pas reprises.
- Obligations : traitement du coupon couru et de la prime de remboursement « à vérifier ».
- Un même titre sur plusieurs comptes-titres : le prix de revient est calculé compte par compte, à vérifier.
- Intérêts reçus sur une plateforme crypto : non repris.
- Crypto : quand un autre actif n'a pas de cours récent au jour de la vente, la valeur du portefeuille est estimée et la ligne passe « À vérifier ».
- La comparaison avec le document de l'établissement n'existe que sur les fiches qu'Hamac rédige, et seulement pour les comptes-titres et le crowdlending.
- L'option pour le barème (case 2OP) et celle des actifs numériques (case 3CN) sont seulement rappelées : c'est à vous de choisir.
- Les cases ne sont vérifiées que pour les années indiquées sur le document.
