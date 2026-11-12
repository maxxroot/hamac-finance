# Crypto : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Crypto** (menu Placements) montre les cryptomonnaies que vous détenez sur vos plateformes (Binance, Coinbase…), ce qu'elles valent, et l'impôt sur vos ventes. Elle calcule la plus-value de chaque vente selon la règle française, qui regarde l'ensemble de vos cryptos et non chaque crypto séparément.

Comme les autres pages de placements, elle se remplit à partir du **Journal** : achats, ventes, échanges d'une crypto contre une autre, versements d'euros sur la plateforme.

Quelques mots utilisés sur la page :

- **Plateforme** : le site où vous achetez et gardez vos cryptos. Dans Hamac, c'est un compte de type « Plateforme crypto ».
- **Prix de revient unitaire** : ce qu'une unité vous a coûté en moyenne, frais compris, sur cette plateforme.
- **Prix total d'acquisition** : tout ce que vous avez payé pour vos cryptos, toutes plateformes confondues, moins la part déjà « consommée » par vos ventes passées. C'est la base du calcul de l'impôt.
- **Cession** : une vente contre des euros. Échanger une crypto contre une autre n'en est pas une.

Par défaut, la crypto est **hors de votre allocation cible** : elle compte dans le patrimoine, l'historique et la performance, mais pas dans la répartition ni dans la projection. Vous pouvez changer ce réglage dans Paramètres › Répartition.

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu si vous masquez le module « Crypto » dans Paramètres › Plan › Modules. Sans aucun compte, elle affiche l'écran d'accueil.

## Ce que vous y voyez

En haut, deux boutons : **Échanger une crypto** (une crypto contre une autre, sans passer par les euros) et **Ajouter une opération** (un achat). Ils visent votre première plateforme. Si vous n'avez aucune plateforme, un encadré vous propose d'en ajouter une.

**Quatre chiffres**, pour toutes vos plateformes ensemble :

- **Valeur totale** : cryptos et euros sur les plateformes, et leur part dans le total de vos comptes.
- **Gain / perte** : la valeur moins le versé net (euros versés moins euros retirés).
- **Euros sur la plateforme** : les euros pas encore investis. S'ils sont négatifs, c'est qu'un versement manque dans le Journal.
- **Frais payés**.

Un bouton **Évolution** déplie la courbe de vos plateformes, mois par mois.

**Un avertissement** apparaît si une crypto n'a pas de cours : sa valeur affichée est alors son prix d'achat.

**Le tableau des positions**, une ligne par crypto et par plateforme : nom, plateforme, quantité, prix de revient unitaire, investi, cours et sa date, valeur, plus-value latente en euros et en %. Cliquez sur un en-tête pour trier, sur une ligne pour déplier son évolution, sur un cours pour le saisir à la main.

**Trois encadrés** :

- **Si tout était vendu aujourd'hui** : la plus-value latente de l'ensemble de vos cryptos, l'impôt estimé, et la valeur nette après impôt.
- **Si les cryptos baissent** : ce que vous perdriez avec une baisse de 50 %, puis de 80 % (« déjà arrivé plusieurs fois »).
- **Un rappel des règles** : seules les ventes contre des euros sont imposables ; la formule de la plus-value ; le seuil d'exonération ; les formulaires à remplir.

**Ventes contre des euros** : une ligne par vente, avec la date, la crypto, la quantité, le prix de vente avant frais, les frais, la valeur de tout votre portefeuille crypto ce jour-là, le prix total d'acquisition avant la vente, la part de ce prix imputée à la vente, et la plus-value.

**Impôt par année** : une ligne par année où vous avez vendu, avec le total des ventes, les plus-values moins les moins-values, « Exonéré » ou « Imposable », l'impôt sur le revenu, les prélèvements sociaux et le total à payer.

**Les mouvements** de vos plateformes (les 20 derniers), repris du Journal.

## Comment faire

**Ajouter une plateforme.** Cliquez sur « Ajouter une plateforme ». Rattachez-la à son établissement : ses frais d'achat et de vente serviront à proposer les frais de chaque opération.

**Noter un versement d'euros.** Dans le Journal, ajoutez un versement sur la plateforme. Sans lui, les euros de la plateforme deviennent négatifs après un achat.

**Noter un achat.** Cliquez sur « Ajouter une opération ». Choisissez la crypto (ou créez-la : la recherche trouve son identifiant), la quantité et le montant total payé, frais compris.

**Noter une vente.** Dans le Journal, une opération « Vente » : la quantité vendue et le montant net reçu en euros, frais déduits.

**Échanger une crypto contre une autre.** Cliquez sur « Échanger une crypto » : la crypto cédée et sa quantité, la crypto reçue et sa quantité, la valeur de l'échange. Ce n'est pas une vente imposable.

**Saisir un cours à la main.** Cliquez sur le cours dans le tableau. Les cours viennent sinon de CoinGecko, à partir de l'identifiant de la crypto (par exemple « bitcoin »), que vous pouvez corriger dans Paramètres › Actifs.

**Changer le seuil d'exonération.** Paramètres › Plan › Fiscalité, « Seuil d'exonération des ventes crypto » (305 € par défaut).

## Comprendre les chiffres

**Prix de revient unitaire et plus-value latente du tableau.** Comme pour les actions : investi ÷ quantité, et valeur − investi. Ce calcul est fait plateforme par plateforme. Il ne sert pas à l'impôt.

**Plus-value d'une vente** (règle de l'article 150 VH bis du code général des impôts). Hamac ne regarde pas le prix d'achat de la crypto vendue, mais tout votre portefeuille crypto :

plus-value = prix de vente net − prix total d'acquisition × prix de vente ÷ valeur de tout le portefeuille

Exemple : vous avez acheté 1 BTC 1 000 € et 10 ETH 1 000 € (prix total d'acquisition : 2 000 €). Vous vendez 0,5 BTC pour 1 000 €, alors que le BTC vaut 2 000 € et l'ETH 150 €. Le portefeuille vaut 1 × 2 000 + 10 × 150 = 3 500 €. La part imputée est 2 000 × 1 000 ÷ 3 500 ≈ 571 €. La plus-value est 1 000 − 571 ≈ 429 €. Le prix total d'acquisition restant tombe à environ 1 429 €.

**Valeur du portefeuille au jour d'une vente.** La crypto vendue est comptée au prix de la vente. Les autres sont comptées à leur dernier cours connu, ou à leur prix de revient moyen si aucun cours n'existe.

**Échange entre cryptos.** Il ne change pas le prix total d'acquisition : les quantités passent d'une crypto à l'autre. Dans le tableau des positions, en revanche, la crypto reçue prend pour prix de revient la valeur de l'échange.

**Impôt de l'année.** Si le total des ventes de l'année (avant frais) ne dépasse pas le seuil (305 € par défaut), rien n'est dû. Sinon, Hamac additionne les plus-values et les moins-values de l'année. Si le résultat est positif, il est imposé à l'impôt sur le revenu (12,8 %, ou votre tranche si elle est plus basse) et aux prélèvements sociaux (17,2 % jusqu'aux ventes de 2024, puis le taux réglé dans Paramètres, 18,6 % par défaut).

**Si tout était vendu aujourd'hui.** Plus-value latente = valeur de toutes vos cryptos − prix total d'acquisition restant. L'impôt estimé est nul si cette plus-value est négative, ou si la valeur des cryptos plus les ventes déjà faites cette année ne dépassent pas le seuil. Sinon : plus-value latente × (taux d'impôt + taux des prélèvements sociaux de Paramètres). La valeur nette est la valeur totale moins cet impôt.

**Si les cryptos baissent.** Valeur des cryptos (sans les euros) × 50 %, puis × 80 %.

## Limites

- Seuls les achats, les ventes et les échanges sur des comptes de type « Plateforme crypto » entrent dans le calcul de l'impôt.
- Il n'y a pas d'opération pour déplacer une crypto d'un compte à un autre (vers une autre plateforme ou votre propre portefeuille) : un transfert entre comptes ne déplace que des euros.
- La valeur du portefeuille au jour d'une vente utilise le dernier cours connu des autres cryptos. Si ce cours a plus de 7 jours, Hamac le sait, mais la page ne le signale pas : la plus-value est alors approximative.
- Il n'y a pas d'opération pour payer un bien ou un service en crypto.
- L'impôt « si tout était vendu » ne tient pas compte des plus-values ou moins-values déjà réalisées dans l'année.
- Les seuils de baisse (50 % et 80 %) sont fixes : la page ne propose pas de les changer.
- Hamac ne remplit pas les formulaires 2086 et 3916-bis : il donne les montants, à vérifier.
