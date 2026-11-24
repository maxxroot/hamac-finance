# Devises : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi ça sert

Un titre peut être coté dans une autre monnaie que l'euro : une obligation du Trésor américain en dollars, une action suisse en francs, une action britannique en livres. Hamac suit ce titre dans sa devise, avec son cours, son nominal et ses coupons, et compte tout le reste en euros : la valeur de vos comptes, vos plus-values et vos impôts.

Vos comptes, eux, restent en euros. Votre établissement convertit l'argent à chaque mouvement : il débite des euros à l'achat, et il crédite des euros quand il verse un coupon ou rembourse le capital. C'est par exemple ce que fait Trade Republic. Les montants que vous saisissez dans le Journal sont donc ceux qui ont bougé sur votre compte, en euros.

Devises disponibles : l'euro et les 29 devises dont la Banque centrale européenne (BCE) publie chaque jour un taux de référence (dollar américain, livre sterling, franc suisse, yen, dollar canadien, couronne suédoise…).

## Ce que vous y voyez

- **Dans la fiche d'un titre** (Paramètres › Titres, ou à la création pendant un achat), le champ **Devise**. Pour une obligation d'État, la devise suit le pays choisi : la dette des États-Unis est en dollars, celle du Royaume-Uni en livres.
- **Dans la fenêtre « Nouvelle opération »**, pour un titre en devise, deux champs de plus :
  - **Taux de change**, en unités de la devise pour 1 € (par exemple 1,08 USD pour 1 €). Hamac y met le taux de référence de la BCE du jour de l'opération. Pour un jour sans publication (week-end, jour férié), il prend celui du dernier jour publié.
  - **Total en USD** (ou dans la devise du titre). Vous tapez le total en euros ou en dollars, au choix, et l'autre se calcule au taux indiqué.
- **Dans les tableaux de positions** (Actions & ETF, page d'un compte, Obligations) :
  - le cours et le prix de revient unitaire sont affichés dans la devise du titre ;
  - la valeur est en euros, avec sous elle la valeur dans la devise ;
  - sous la plus-value, la ligne **dont change** indique la part due au taux de change depuis l'achat.

## Comment faire

### Déclarer une obligation en dollars

1. Ouvrez **Nouvelle opération**, choisissez le compte, puis l'opération **Achat**.
2. Dans **Titre**, choisissez **＋ Nouvelle obligation**, puis **Obligation d'État**.
3. Cherchez le pays : tapez « etats » puis Entrée. La devise passe à **USD**.
4. Renseignez le coupon, l'échéance exacte et le nominal, en dollars, comme sur l'avis d'opéré.
5. Vérifiez le **taux de change**. Si votre établissement a appliqué un autre taux, remplacez celui de la BCE par le sien.
6. Tapez le prix en % du nominal, ou directement le **Total débité en USD** de l'avis d'opéré. Le total en euros se calcule.
7. Enregistrez.

### Noter un coupon ou un dividende en devise

Choisissez l'opération **Intérêts / coupon** (ou **Dividende**) et le titre. Saisissez le montant reçu en euros, tel qu'il apparaît sur votre compte. Vous pouvez aussi taper le montant en dollars avec le taux de conversion appliqué.

### Changer la devise d'un titre

Ouvrez sa fiche et changez le champ **Devise**. Attention : les cours déjà saisis ne sont pas convertis. Faites-le avant les premiers achats, ou vérifiez les cours ensuite.

## Comprendre

- **Prix de revient.** C'est ce que vous avez payé en euros, au taux du jour de l'achat. Il ne bouge plus ensuite.
- **Valeur.** C'est la valeur dans la devise (cours du jour, ou valeur calculée pour une obligation) convertie au taux BCE du jour.
- **Effet de change.** C'est la part de la plus-value due au taux. Si le dollar baisse face à l'euro, votre ligne perd de la valeur en euros, même si son cours en dollars ne bouge pas.
- **Remboursement à l'échéance.** Hamac convertit le nominal au taux BCE du jour de l'échéance. Si votre établissement a converti à un autre taux, notez l'écart avec une opération « Correction ».
- **Rendement actuariel.** Celui d'une obligation en devise est calculé dans sa devise : c'est ce qu'elle rapporte en dollars, hors effet de change.
- **Impôts.** En France, une plus-value se calcule en euros. Le prix d'achat est converti au taux du jour de l'achat, le prix de vente ou de remboursement au taux du jour de la vente. Le gain ou la perte de change fait donc partie de la plus-value imposable. Un coupon est imposé sur les euros reçus.

## Limites

- Un compte ne garde pas de solde dans une autre devise : tout l'argent du compte est en euros.
- Les cryptos et les fonds euros restent toujours en euros.
- La comparaison de titres (page Performance) compare les cours dans leur devise, sans le change.
- Le taux de la BCE est un taux de référence. Votre établissement applique souvent un taux un peu moins favorable : saisissez le sien si vous voulez un prix de revient exact.
