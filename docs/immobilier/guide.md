# Immobilier : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Immobilier** liste vos biens (résidence principale, résidence secondaire, investissement locatif, autre bien) et les SCPI détenues sur vos comptes. Elle sert à connaître la valeur de ce que vous possédez vraiment : la part détenue, en tenant compte d'une indivision, d'une SCI ou d'un usufruit. Cette valeur entre dans votre patrimoine net, avec les crédits rattachés.

Chaque bien a sa propre page (cliquez sur son nom), avec :

- un onglet **Finances** : achat, crédits, valeur dans le temps, dépenses, recettes et résultats par année ;
- un onglet **Location**, pour un investissement locatif : baux, loyers et lots (voir le [guide de la gestion locative](../gestion-locative/guide.md)) ;
- une **fiche du bien** qui le présente en une page, à imprimer si besoin.

La page apparaît dans le menu si le module « Immobilier » est activé (Paramètres › Plan › Modules).

## Ce que vous y voyez

### La page Immobilier

1. **En-tête** avec le bouton « Nouveau bien ».
2. **Deux chiffres** :
   - *Biens immobiliers* : la valeur de vos parts dans les biens non archivés ;
   - *SCPI* : la valeur des SCPI détenues sur vos comptes. Elles comptent dans le patrimoine financier, pas ici.
3. **Le tableau des biens**, un bien par ligne :
   - le nom (lien vers la page du bien), l'utilisation, la date de vente ou d'estimation ;
   - *Valeur* : la valeur du bien entier ;
   - *Part* : la part que vous détenez, parts de SCI comprises, et le droit détenu en cas d'usufruit ou de nue-propriété ;
   - *Valeur détenue* : ce que vaut votre part aujourd'hui ;
   - *Allocation* : « Inclus » ou « Hors » de votre répartition cible ;
   - le bouton « Fiche du bien », puis modifier et supprimer.

   Un bien archivé ou vendu reste listé, en grisé.
4. **Sociétés (SCI)** : la carte n'apparaît que si vous avez créé une société, ou si un bien a le statut « SCI familiale » ou « Autre SCI ». Pour chaque société : vos parts, la valeur de ses biens, ses crédits, son actif net et la valeur de vos parts.
5. **SCPI** : la liste des SCPI détenues sur vos comptes, avec leur valeur et leur gain ou perte. Elles se gèrent depuis les comptes, pas depuis cette page.

### La page d'un bien

1. **En-tête** : nom, utilisation, statut de détention et part détenue. Boutons « Fiche du bien », « Vendre » (ou « Annuler la vente ») et « Modifier ».
2. Un badge « Vendu le… » ou « Archivé » si c'est le cas.
3. **Quatre chiffres**, tant que le bien n'est pas vendu :
   - *Valeur détenue* ;
   - *Coût d'achat* (ou *Coût total* s'il y a eu des travaux d'amélioration), frais compris, pour votre part ;
   - *Gain estimé* : valeur détenue moins coût, avant impôt ;
   - *Valeur nette* : valeur détenue moins le capital restant dû à votre charge sur les crédits du bien.
4. **Les onglets.** Un investissement locatif a deux onglets, « Location » puis « Finances ». Les autres biens n'ont que « Finances ».

L'onglet **Finances** contient, dans l'ordre :

- *Bilan de la vente*, si le bien est vendu : prix et frais de vente, coût total, gain réalisé, crédit remboursé et ce qu'il reste ;
- *Achat*, pour le bien entier : date, neuf ou ancien, prix, frais de notaire, frais d'agence, travaux à l'achat, autres frais, coût d'achat complet, et les travaux d'amélioration depuis l'achat ;
- *Crédits rattachés*, à votre charge : mensualité, capital restant dû, date de fin ;
- *Valeur dans le temps* : l'estimation actuelle et les estimations plus anciennes ;
- *Dépenses* : taxe foncière, copropriété, assurance, gestion, travaux, autres. La colonne *À votre charge* montre ce qui vous reste une fois la part récupérable demandée au locataire ;
- *Autres recettes* (biens en location) : régularisations de charges, indemnités d'assurance ;
- *Résultats par année* (biens en location) : voir plus bas.

L'onglet **Location** est décrit dans le [guide de la gestion locative](../gestion-locative/guide.md).

### La fiche du bien

Le bouton « Fiche du bien » ouvre une grande fenêtre :

- l'en-tête : nom, statut, adresse ;
- quatre chiffres (valeur détenue, coût, gain estimé, valeur nette), ou trois pour un bien vendu (prix de vente, gain réalisé, reste après frais et crédit) ;
- *Caractéristiques* : type, surface, pièces, chambres, étage, année de construction, extérieur, parking, cave, chauffage, copropriété ;
- *Repères au m²* : prix d'achat, valeur et loyer au mètre carré, si la surface est connue ;
- *Notes* ;
- *Énergie* : étiquettes DPE et climat (GES), date du diagnostic, fin de validité, date d'interdiction de louer si la note est concernée ;
- *Rentabilité* (biens en location) : rendements, ce qu'il reste par mois, occupation, loyers perçus et capital remboursé depuis l'achat ;
- *Documents* : le registre des documents du bien.

En bas : « Imprimer » ouvre la fiche imprimable dans un nouvel onglet, et « Compléter la fiche » (ou « Modifier la fiche ») ouvre le formulaire de description.

### La fiche imprimable

Une page sans menu, prête à imprimer : description, étiquettes énergie, valeur et coût, rentabilité et résultats par année.

### Alertes du bien

Le tableau de bord vous prévient :

- quand le DPE expire dans moins de 90 jours, ou a expiré ;
- quand la note DPE d'un bien en location interdit de louer, ou l'interdira dans moins de deux ans ;
- quand un document du registre expire dans moins de 30 jours, ou a expiré.

Les alertes DPE se désactivent bien par bien, dans la fiche. Les rappels que vous saisissez vous-même (assemblée générale, entretien…) se notent sur la page Gestion locative, pour les biens en location.

## Comment faire

**Ajouter un bien.** Cliquez sur « Nouveau bien ». Indiquez le nom, l'utilisation et le statut. Saisissez la valeur estimée du bien entier et sa date. Le prix d'achat, la date d'achat et les frais sont facultatifs, mais sans prix d'achat il n'y a ni coût ni gain.

**Un bien à deux.** Indiquez 50 % dans « Part détenue ». Les montants à saisir restent ceux du bien entier.

**Un bien détenu par une SCI.**

1. Créez la société dans la carte « Sociétés (SCI) » de la page Immobilier, avec la part des parts que vous détenez. Si la carte n'apparaît pas encore, choisissez d'abord le statut « SCI » sur un bien.
2. Sur le bien, choisissez le statut « SCI familiale » ou « Autre SCI », puis la société.
3. « Part détenue par la SCI » vaut souvent 100 %. Vos parts de la société s'appliquent en plus, au bien et à ses crédits.

**Un bien en usufruit ou en nue-propriété.** Dans « Droit détenu », choisissez le droit, puis indiquez la date de naissance de l'usufruitier (usufruit à vie) ou la date de fin (usufruit à durée fixe). Le formulaire refuse d'enregistrer sans l'une des deux.

**Mettre à jour la valeur.** Dans l'onglet Finances, carte « Valeur dans le temps », cliquez sur « Nouvelle estimation ». La plus récente devient la valeur actuelle, l'ancienne rejoint l'historique. Une estimation datée d'avant l'actuelle va directement dans l'historique. Si vous changez la date d'estimation dans le formulaire du bien, l'ancienne valeur est aussi gardée.

**Compléter la description.** Ouvrez la fiche, puis « Compléter la fiche ». Pour l'adresse, tapez quelques mots : des suggestions viennent de la Base Adresse Nationale, et remplissent le code postal et la ville. Le code postal sert aussi à choisir l'indice des loyers (Corse, outre-mer) et le calendrier d'interdiction de louer (outre-mer).

**Noter une dépense.** Onglet Finances, « Nouvelle dépense ». Cochez « Chaque année » pour une dépense qui revient (taxe foncière). Si le montant change, indiquez la dernière année puis créez une nouvelle dépense. Pour des travaux, la case « Améliore le bien » ajoute la dépense au coût du bien.

**Indiquer ce que le locataire rembourse.** Une partie de certaines dépenses se récupère sur le locataire, avec ses provisions de charges :

- *Charges de copropriété* : saisissez le montant total de l'appel du syndic, et la *part récupérable* en pourcentage. Hamac propose les deux tiers, la proportion habituelle ; le chiffre exact figure sur le décompte annuel du syndic. La valeur proposée se règle dans Paramètres › Plan › Biens en location.
- *Taxe foncière* : saisissez le montant total de l'avis, et la ligne *Dont ordures ménagères (TEOM)*. Seule la TEOM est à la charge du locataire.
- *Autre dépense* : une part récupérable si c'est une charge que le locataire rembourse.

L'assurance du propriétaire, les frais de gestion et les travaux restent à votre charge. Les charges de copropriété déjà saisies avant cette version sont passées aux deux tiers récupérables : corrigez-les si votre décompte dit autre chose.

**Noter une recette hors loyer.** Onglet Finances, « Nouvelle recette » : régularisation de charges reçue ou rendue, indemnité d'assurance. Le montant est toujours positif, le type donne le sens.

**Noter un document.** Dans la fiche, « Nouveau document » : type, nom, date, fin de validité et où le retrouver. Hamac ne stocke pas le fichier.

**Rattacher un crédit.** Le rattachement se fait depuis la page [Crédits](../credits/guide.md), sur un crédit immobilier ou un crédit travaux.

**Vendre un bien.**

1. Sur la page du bien, cliquez sur « Vendre ».
2. Indiquez la date, le prix et les frais de vente du bien entier. La date ne peut pas précéder l'achat.
3. Laissez cochée « Solder les crédits rattachés » si le crédit est remboursé à la vente.
4. Un aperçu montre le gain et ce qu'il vous reste. Enregistrez.

Le bien sort du patrimoine à la date de vente, et son bilan reste dans l'onglet Finances. Si l'argent arrive sur un compte suivi, notez aussi le versement dans le Journal. « Annuler la vente » remet le bien et les crédits soldés ce jour-là.

**Archiver ou supprimer.** « Archivé », dans le formulaire du bien, le retire du patrimoine. Supprimer efface le bien avec ses baux, loyers, dépenses, recettes, estimations et documents ; ses crédits restent, sans bien rattaché.

**Inclure un bien dans la répartition cible.** Par défaut, un bien suit la classe Immobilier (Paramètres › Répartition). Le formulaire du bien permet de l'inclure ou de l'exclure, et de le rattacher à une classe personnalisée.

## Comprendre les chiffres

**Valeur détenue.** Valeur du bien entier × part détenue × part du droit détenu × part de vos parts de SCI. Exemple : un appartement estimé 300 000 €, détenu à 50 %, en pleine propriété, vaut 150 000 € pour vous.

**Usufruit et nue-propriété.** La part du droit suit le barème fiscal (article 669 du code général des impôts). Pour un usufruit à vie, elle dépend de l'âge de l'usufruitier : par exemple, à 70 ans, l'usufruit vaut 40 % du bien et la nue-propriété 60 %. Un usufruit à durée fixe vaut 23 % par période de dix ans, toute période commencée comptant, sans dépasser l'usufruit à vie. La valeur évolue donc avec le temps. Si l'usufruitier n'est pas connu, le bien compte en entier.

**Parts de SCI.** Une société qui détient un bien de 400 000 € avec 100 000 € de crédit a un actif net de 300 000 €. Si vous détenez 50 % des parts, vos parts valent 150 000 €. Le bien, ses crédits, ses loyers et ses charges comptent pour la même part dans tous les calculs. Les formulaires, eux, gardent la part saisie sur le bien.

**Coût d'achat complet.** Prix d'achat + frais de notaire + frais d'agence + travaux à l'achat + autres frais, pour le bien entier. Le *coût total* ajoute les travaux d'amélioration payés depuis. Sur la page du bien, ces coûts sont ramenés à votre part.

**Gain estimé.** Valeur détenue moins coût de votre part, avant impôt.

**Valeur nette.** Valeur détenue moins le capital restant dû, pour votre part, sur les crédits en cours rattachés au bien.

**Frais de notaire estimés.** Tant que vous ne les avez pas saisis, le formulaire les estime d'après le prix, l'état (neuf ou ancien) et la date d'achat :

- droits de mutation : 6,3185 % du prix dans l'ancien pour un achat depuis le 1er avril 2025 (ou sans date), 5,80665 % avant ; 0,715 % dans le neuf ;
- émoluments du notaire par tranches de prix, TVA de 20 % comprise ;
- contribution de sécurité immobilière : 0,1 % du prix ;
- formalités : un forfait de 1 000 €.

Exemple : 200 000 € dans l'ancien, acheté en 2026, donne 16 231 € ; dans le neuf, 5 024 €. Le résultat est arrondi à l'euro. Le lien « Reprendre l'estimation » remet le calcul après une saisie.

**Vente.** Prix et frais de vente sont ramenés à votre part. Gain réalisé = prix − frais − coût total. Reste = prix − frais − crédit remboursé à la vente (capital restant dû à votre charge ce jour-là).

**Valeur dans le temps.** À une date passée, le bien vaut la dernière estimation connue à cette date. Avant la première estimation, il vaut son prix d'achat. Avant l'achat et après la vente, il ne compte pas. Ces valeurs alimentent la page Historique.

**Repères au m².** Prix d'achat, valeur et loyer du mois divisés par la surface habitable.

**DPE.** Un DPE fait depuis le 1er juillet 2021 vaut dix ans. Les plus anciens ont des dates limites : fin 2022 pour ceux faits avant 2018, fin 2024 pour ceux faits entre 2018 et juin 2021. En métropole, un logement classé G ne peut plus être loué depuis le 1er janvier 2025, F à partir de 2028, E à partir de 2034 ; en outre-mer, G à partir de 2028 et F à partir de 2031. Avec une note F ou G, le loyer ne peut pas être augmenté.

**Résultats par année** (biens en location). Pour chaque année, à votre part et avant impôt :

- *Loyers et charges reçus* : seulement ce qui a été pointé comme reçu ;
- *Autres recettes* : régularisations, indemnités, et la part du dépôt de garantie gardée à la sortie ;
- *Dépenses* : toutes, améliorations comprises ;
- *Intérêts et assurance* et *Capital remboursé* : ceux des crédits rattachés ;
- *Ce qu'il reste* : loyers, charges et recettes, moins les dépenses et tout ce qui est payé pour le crédit ;
- *Rendement brut* : loyers hors charges reçus ÷ coût total du bien ;
- *Rendement après charges* : loyers, charges reçues et recettes, moins les dépenses courantes (hors améliorations), ÷ coût total, sans le crédit ;
- *Occupation* : part de la période de location où les lots étaient loués, chaque lot pesant selon son loyer.

Une année incomplète (mise en location en cours d'année, année en cours) est marquée d'une étoile : ses rendements sont ramenés à une année entière. La *Rentabilité* de la fiche reprend la dernière année complète, sinon la dernière année louée.

## Limites

- La valeur du bien est celle que vous saisissez : Hamac ne l'estime pas.
- Les frais de notaire sont une estimation : le taux réel dépend du département, un primo-accédant peut échapper à la hausse de 2025, la TVA retenue est celle de métropole, et les formalités sont un forfait.
- Aucun impôt n'est calculé : ni plus-value à la vente, ni revenus fonciers ou location meublée. Les gains et rendements sont avant impôt.
- La vente n'écrit rien dans le Journal : le versement du prix se note à part.
- Un bien archivé sans vente disparaît aussi des dates passées dans l'Historique. Pour qu'il y reste jusqu'à sa sortie, enregistrez une vente.
- Une SCI n'est suivie que par ses parts : pas de comptabilité de la société.
- Le registre des documents note où ils se trouvent, sans garder les fichiers.
- Les suggestions d'adresse viennent d'un service public externe (Géoplateforme de l'IGN), appelé depuis votre navigateur. S'il ne répond pas, la saisie libre reste possible.
