# Impôts : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Impôts** (menu Fiscalité) estime les impôts liés à votre épargne :

- ce qu'il reste à payer à la prochaine déclaration ;
- ce que vous paieriez si vous retiriez tout aujourd'hui ;
- le rendement de chaque placement une fois les impôts payés ;
- les impôts de chaque année, depuis votre première opération.

Tous les chiffres sont des estimations calculées avec les taux de **Paramètres › Plan › Fiscalité**. Comparez-les chaque année avec votre déclaration préremplie et votre avis d'impôt. Ils n'ont aucune valeur officielle : vous restez responsable de votre déclaration.

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »), sauf la durée utilisée pour le rendement net du PEA (voir plus bas). Elle disparaît du menu, avec les deux autres pages de Fiscalité, si vous masquez le module « Impôts » dans Paramètres › Plan › Modules. Sans aucun compte, elle affiche l'écran d'accueil.

Quelques mots utilisés sur la page :

- **Prélèvements sociaux** : contributions (dont la CSG) prélevées en plus de l'impôt sur les revenus de l'épargne. Par défaut, Hamac compte 18,6 % dans le cas général et 17,2 % pour l'assurance-vie.
- **PFU** (prélèvement forfaitaire unique, ou « flat tax ») : un impôt de 12,8 % sur les revenus de l'épargne, plus les prélèvements sociaux.
- **Barème** : l'impôt calculé selon votre tranche (la TMI, tranche marginale d'imposition, lue sur votre avis d'impôt).
- **Acompte** : une avance d'impôt que la banque retient quand elle vous verse des intérêts ou des dividendes. Il est déduit de l'impôt final à la déclaration.

## Ce que vous y voyez

Un rappel en haut de page : les intérêts se saisissent au Journal tels qu'ils arrivent sur le compte, après prélèvements. Hamac retrouve lui-même le montant brut et les impôts retenus.

### 1. À payer à la prochaine déclaration

Un tableau, compte par compte, de l'impôt que les établissements n'ont pas retenu et qui arrivera sur l'avis d'impôt d'août. Colonnes : revenus bruts, plus-values (si vous avez vendu), déjà retenu, à payer, et pourquoi.

- Avant le 1er août, c'est la déclaration des revenus de l'an dernier. À partir du 1er août, l'avis est sorti : la page passe aux revenus de l'année en cours, en indiquant que c'est une estimation en cours d'année.
- Un montant négatif est un remboursement attendu (l'acompte retenu dépassait l'impôt final).
- Si rien n'est dû, un message vert le dit.

### 2. Si tout était retiré aujourd'hui

Un tableau, un compte par ligne : valeur, gain brut (en euros et en %), impôt à payer, valeur nette, gain net, régime appliqué. Cliquez sur un en-tête pour trier. La dernière ligne donne le total et le taux moyen d'imposition de vos gains.

Cliquez sur un compte pour ouvrir son détail :

- quatre chiffres : impôts déjà payés, à payer à la prochaine déclaration, en plus si tout était retiré, gain net de tous les impôts ;
- des repères propres au compte : date d'ouverture, date des 8 ans d'une assurance-vie ou des 5 ans d'un PEA (« atteint » ou « dans 2 ans et 3 mois »), abattement, moins-values encore déductibles, prix d'acquisition crypto restant… ;
- un tableau année par année : revenus bruts, plus-values, retenu à la source, à la déclaration (« payé » ou « avis d'août »), total ;
- des remarques, par exemple quand la date d'ouverture manque.

### 3. Rendement net comparé

Pour chaque grand type de placement : rendement brut, fiscalité appliquée, rendement net estimé. Les livrets prennent le taux de vos livrets (LEP, puis LDDS ou à défaut Livret A) ; sans livret de ce type, la case affiche « — ». Les autres lignes prennent les rendements de Paramètres › Plan. La crypto n'a pas de rendement : seule sa fiscalité est rappelée.

### 4. Impôts de chaque année

Un tableau, une ligne par année, l'année en cours surlignée :

- intérêts du fonds euros et prélèvements sociaux retenus par l'assureur ;
- coupons et dividendes du compte-titres : reçus, bruts, prélèvements sociaux, acompte retenu, impôt définitif, régularisation (négatif = remboursement) ;
- crypto : impôt et prélèvements sociaux sur la plus-value ;
- plus-values du compte-titres et leur impôt (si vous avez vendu) ;
- crowdlending : intérêts reçus et impôt, dont ce qui reste à payer (si vous en avez) ;
- total.

Livrets et PEA n'y figurent pas : rien à déclarer tant qu'on ne retire pas.

### Dispense de l'acompte de 12,8 % sur les intérêts

Sous le bloc 4, un encadré « Dispense de l'acompte de 12,8 % sur les intérêts », avec une case par année : l'année en cours, l'année suivante (avec la date limite de la demande) et toute année déjà cochée.

Sur les coupons d'obligations et les intérêts de crowdlending, l'établissement retient d'habitude un acompte d'impôt de 12,8 % (le prélèvement forfaitaire non libératoire), déduit l'année suivante de votre impôt. Si votre revenu fiscal de référence de l'avant-dernière année est inférieur à 25 000 € (personne seule) ou 50 000 € (couple marié ou pacsé), vous pouvez en être dispensé : il faut remettre une attestation à chaque établissement avant le 30 novembre, pour les intérêts de l'année suivante. La demande est à refaire chaque année.

Cochez les années pour lesquelles vous avez fait la demande. Pour ces années, Hamac ne compte plus d'acompte sur les intérêts : seuls les prélèvements sociaux sont retenus, et l'impôt sur le revenu est à payer à la déclaration. Les dividendes ne sont pas concernés : leur dispense est une demande distincte.

### Liste de fin d'année

En bas de page, une ligne repliée : « Liste de fin d'année », avec le nombre de gestes à faire avant le 31 décembre et l'impôt qu'ils feraient économiser. Elle s'appuie sur les compteurs : elle est décrite dans le [guide Compteurs et plafonds](../compteurs-et-plafonds/guide.md#liste-de-fin-dannée).

## Comment faire

**Vérifier ce que vous devrez payer en août**
1. Ouvrez Impôts et lisez le bloc 1.
2. Comparez le total avec votre avis d'impôt quand il arrive.
3. Si un compte est faux, ouvrez son détail dans le bloc 2 et regardez le tableau année par année.

**Obtenir des chiffres justes**
1. Dans Paramètres › Plan › Fiscalité, réglez votre tranche (TMI). Si vous avez demandé la dispense de l'acompte sur les intérêts, cochez l'année concernée dans l'encadré de la page Impôts.
2. Dans Paramètres › Plan, indiquez si vous êtes en couple : l'abattement de l'assurance-vie en dépend.
3. Sur chaque compte, renseignez la date d'ouverture. Sans elle, une assurance-vie est traitée comme ayant moins de 8 ans, un PEA comme ayant moins de 5 ans.
4. Sur chaque établissement (Paramètres › Établissements), dites s'il prélève les impôts sur les intérêts et dividendes, et ses taux s'ils diffèrent des taux par défaut.
5. Saisissez les intérêts et dividendes tels qu'ils arrivent sur le compte. Si vous avez le relevé, vous pouvez aussi noter le brut et les retenues dans l'opération.

**Savoir combien coûterait un retrait**
1. Lisez le bloc 2 : la colonne « Impôt à payer » donne l'impôt d'un retrait total aujourd'hui.
2. Ouvrez le compte pour voir la date à partir de laquelle l'impôt baisse (8 ans, 5 ans).

## Comprendre les chiffres

**Le taux d'impôt sur le revenu.** Hamac prend le plus bas des deux : votre tranche (TMI) ou 12,8 % (le PFU). Avec une tranche à 11 %, il compte 11 % ; avec 30 %, il compte 12,8 %. Le choix retenu s'affiche dans Paramètres › Plan, sous « Imposition retenue ».

**Intérêts du fonds euros.** Vous saisissez le net. Si l'assureur prélève, Hamac retrouve le brut : 82,80 € reçus avec 17,2 % de prélèvements sociaux donnent 100 € bruts et 17,20 € retenus. Si l'assureur ne prélève rien, le montant saisi est le brut, et les prélèvements sociaux sont à payer à la déclaration.

**Coupons et dividendes du compte-titres.** Exemple fictif, revenus 2026, taux par défaut : 68,60 € reçus correspondent à 100 € bruts, 12,80 € d'acompte et 18,60 € de prélèvements sociaux. Avec une tranche à 11 %, l'impôt définitif est de 11 € : la régularisation est de −1,80 €, soit un remboursement. Si l'établissement ne retient rien, le montant reçu est le brut et tout est à payer à la déclaration.

**Plus-values du compte-titres.** Chaque vente donne un gain : prix de vente moins le prix de revient moyen du titre. Les gains et les pertes de l'année se compensent, tous comptes-titres confondus. Une perte qui reste se déduit des gains des 10 années suivantes, la plus ancienne d'abord. Le gain restant est imposé au taux d'impôt ci-dessus, plus les prélèvements sociaux. Quand vous avez plusieurs comptes-titres, l'impôt est réparti entre eux au prorata de leur gain.

**Crypto (article 150 VH bis du code général des impôts).** Seules les ventes contre des euros sont imposables. Échanger une crypto contre une autre (stablecoins compris) ne l'est pas. Le gain d'une vente ne se calcule pas titre par titre mais sur tout votre portefeuille crypto, toutes plateformes confondues :

> gain = prix de vente net − prix d'achat total × prix de vente brut / valeur de tout le portefeuille

Exemple fictif : vous avez acheté pour 1 000 € de cryptos. Le portefeuille vaut 2 000 €. Vous vendez pour 500 € sans frais. La part du prix d'achat qui sort est 1 000 × 500 / 2 000 = 250 €. Le gain est 500 − 250 = 250 €. Il reste 750 € de prix d'achat pour les ventes suivantes.

Si le total de vos ventes de l'année ne dépasse pas 305 € (réglable dans Paramètres › Plan), rien n'est dû. Sinon, le gain net de l'année est imposé au taux d'impôt ci-dessus, plus les prélèvements sociaux. Rien n'est retenu par la plateforme : tout passe par la déclaration (formulaire 2086). Avec plusieurs plateformes, l'impôt de l'année est réparti au prorata de leur gain.

**Crowdlending.** Si la plateforme prélève les impôts, ils sont comptés comme déjà payés. Sinon, les intérêts bruts sont imposés à la déclaration (impôt + prélèvements sociaux). Le capital remboursé n'est pas imposé, et les pertes ne sont pas déduites.

**Si tout était retiré aujourd'hui.** Régime par type de compte, avec les taux par défaut :

| Compte | Impôt d'un retrait total |
|---|---|
| Livret réglementé | Rien. |
| Assurance-vie de plus de 8 ans | Gain au-delà de l'abattement (4 600 €, 9 200 € en couple) × le plus bas de votre tranche et 7,5 %, plus les prélèvements sociaux sur les gains des unités de compte (ceux du fonds euros sont déjà payés chaque année). |
| Assurance-vie de moins de 8 ans | Gain × le plus bas de votre tranche et 12,8 %, plus les prélèvements sociaux des unités de compte. |
| PEA, PEA-PME de plus de 5 ans | Prélèvements sociaux sur le gain. |
| PEA, PEA-PME de moins de 5 ans | Prélèvements sociaux + 12,8 % sur le gain, et le plan est clos. |
| Compte-titres | Plus-value latente × (taux d'impôt + prélèvements sociaux). Coupons et dividendes sont déjà imposés chaque année. |
| PER | Sortie en capital, versements supposés déduits : versements à votre tranche, gains au PFU (12,8 % + prélèvements sociaux). |
| Épargne salariale | Prélèvements sociaux sur le gain. |
| Crowdlending | Rien de plus : les intérêts sont imposés chaque année. |
| Crypto | Part du gain latent du compte × (taux d'impôt + prélèvements sociaux), rien si la valeur et les ventes de l'année restent sous 305 €. |

Exemple fictif : une assurance-vie de 10 ans, personne seule, 6 000 € de gain sur le fonds euros. Impôt : (6 000 − 4 600) × 7,5 % = 105 €.

**Déjà payé ou à payer.** L'impôt des revenus d'une année compte comme payé à partir du 1er août de l'année suivante, date à laquelle l'avis est en ligne.

**Rendement net comparé.**
- Fonds euros : rendement × (1 − 17,2 %).
- Obligations : rendement × (1 − prélèvements sociaux − taux d'impôt).
- ETF en PEA : les prélèvements sociaux ne se paient qu'au retrait. Hamac les ramène à un taux par an sur une durée de détention : jusqu'à votre départ en retraite (au moins 5 ans) en format retraite, 10 ans en format patrimoine.

## Limites

- Ce sont des estimations, pas un calcul d'impôt : Hamac ne connaît ni vos autres revenus ni votre quotient familial.
- L'option pour le barème n'est pas simulée en détail : Hamac prend seulement le plus bas des deux taux. En vrai, l'option porte sur tous les revenus de l'épargne de l'année.
- Assurance-vie : le taux de 7,5 % après 8 ans vaut pour moins de 150 000 € de versements (aide de Paramètres › Plan). Hamac ne traite pas les versements au-delà.
- PER : Hamac suppose que tous les versements ont été déduits, et impose le capital à votre tranche.
- Livret non réglementé : ses intérêts ne sont pas calculés, voyez le document fiscal de la banque.
- Retenues à l'étranger sur les dividendes : notées, mais le crédit d'impôt n'est pas compté.
- Crypto : la valeur du portefeuille au moment d'une vente utilise le dernier cours connu des autres cryptos (ou leur prix d'achat sans cours). Les intérêts reçus sur une plateforme crypto ne sont pas imposés ici.
- Parts de SCPI vendues : elles relèvent des plus-values immobilières et ne sont pas reprises dans les plus-values du compte-titres.
- Les taux par défaut sont ceux de 2026 et doivent être vérifiés chaque année.
