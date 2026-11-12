# Gestion locative : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Gestion locative** montre tout votre parc loué, comme le suivrait une agence : les loyers du mois, ceux qui ne sont pas arrivés, les lots vides, l'occupation de chaque bien et les dates à venir.

Elle s'appuie sur ce que vous saisissez dans l'onglet **Location** de chaque bien (page Immobilier, puis le nom du bien) : les lots, les baux, les locataires, les garanties et les loyers reçus. Ce guide couvre les deux, ainsi que les courriers à imprimer : quittance, avis d'échéance, relance, attestation de loyer et courrier de révision.

Le principe : **un loyer n'est reçu que si vous l'avez pointé**. Tant qu'il ne l'est pas, Hamac le signale, pour qu'aucun mois ne passe inaperçu. Hamac ne se connecte pas à votre banque.

Seuls les biens dont l'utilisation est « Investissement locatif », non vendus ni archivés, apparaissent ici. Les montants sont ceux du bien entier, sans tenir compte de votre part.

## Ce que vous y voyez

### La page Gestion locative

Sans bien en location, la page vous renvoie vers la page Immobilier. Sinon, dans l'ordre :

1. **Quatre chiffres :**
   - *Attendu ce mois-ci* : loyers et charges dus pour le mois en cours ;
   - *Reçu ce mois-ci* : ce qui a été pointé pour ce mois ;
   - *Non reçus* : tout ce qui reste dû, tous mois confondus, plus de 10 jours après l'échéance, et le nombre de baux concernés ;
   - *Lots vides* : le nombre de lots sans bail en cours, sur le nombre de lots proposés à la location.
2. **Loyers du mois.** Un sélecteur choisit l'un des douze derniers mois. Une ligne par bail : bien (et lot s'il y en a plusieurs), locataires, attendu, reçu, état, et un bouton « Reçu ». Si des loyers du mois ne sont pas soldés, un bandeau propose « Valider le mois ».
3. **Loyers non reçus.** Un bail par ligne, du plus gros montant dû au plus petit : le ou les mois en retard, l'étape de relance (« Relance à envoyer », « Rappel amiable le 12/03/2026 »…) et le montant dû.
4. **Lots vides.** Le lot, la date depuis laquelle il est vide et le nombre de jours, les loyers perdus, et le prochain bail s'il est déjà signé.
5. **Biens.** Un sélecteur choisit l'année. Pour chaque bien : lots loués sur lots proposés, loyer du mois, occupation, loyers reçus, rendement brut, rendement net, temps moyen de relocation. Une ligne « Tout le parc » s'ajoute s'il y a plusieurs biens.
6. **À venir.** Toutes les dates des douze prochains mois, regroupées par mois, avec en tête ce qui est en retard : révisions de loyer, fins de bail, dates limites pour donner congé, dépôts à rendre, attestations d'assurance, fins de garantie, documents et DPE qui expirent, dépenses annuelles, et vos propres rappels. Le bouton « Nouveau rappel » en ajoute un.

### L'onglet Location d'un bien

1. **Une carte Bail par lot** proposé à la location (une seule si le bien n'a qu'un logement). Elle montre le bail en cours, sinon le prochain, sinon le dernier :
   - type de bail, locataires, état (à venir, en cours, congé donné, terminé) ;
   - début, durée, fin du bail ou prochaine échéance, dernier jour pour donner congé ;
   - garanties, assurance du locataire, loyer hors charges, charges, dépôt de garantie (à rendre, ou rendu avec la retenue) ;
   - un encadré rouge si des loyers sont en retard, avec l'étape de relance ;
   - un encadré « Révision du loyer » quand la date anniversaire approche ;
   - le lien « Attestation de loyer » ;
   - les boutons « Modifier ou donner congé », « Nouveau loyer » et « Supprimer » ;
   - l'évolution du loyer, avec un lien « Courrier » pour chaque révision ;
   - les autres baux du lot.
2. **Loyers.** Les mois de loyer de l'année choisie, du plus récent au plus ancien : mois, lot, dû, reçu, état, et les liens « Quittance », « Avis », « Reçu » et « Détail ». Si plusieurs mois échus ne sont pas pointés, un bandeau propose « Valider l'année ».
3. **Lots.** Ce qui se loue dans le bien : nom, nature, surface, situation (loué, loué à partir du…, vide depuis le…, jamais loué, archivé, hors du mode de location) et loyer.

### Les états d'un loyer

| État | Ce que cela veut dire |
|---|---|
| À venir | L'échéance n'est pas encore passée. |
| Attendu | L'échéance est passée depuis 10 jours ou moins. |
| Reçu | Tout ce qui était dû a été pointé. |
| Reçu en partie | Plus de 10 jours après l'échéance, une partie seulement est arrivée. |
| Non reçu | Plus de 10 jours après l'échéance, rien n'est arrivé. |
| Remis | Le mois a été offert au locataire : rien n'est dû. |

### Les courriers à imprimer

Chaque courrier s'ouvre dans un nouvel onglet, sans menu, prêt à imprimer :

- **Quittance de loyer** (mois payé en entier) ou **reçu de paiement partiel**, avec le loyer et les charges séparés. Rien n'est proposé pour un mois où rien n'est arrivé.
- **Avis d'échéance** : loyer, provision sur charges, ce qui est déjà reçu, ce qui reste des mois précédents, et le total à régler à l'échéance.
- **Relance**, en trois niveaux : rappel amiable, relance (règlement sous huit jours), mise en demeure (lettre recommandée, règlement sous huit jours, mention du commandement de payer). Chacune contient le décompte des sommes dues.
- **Attestation de loyer** : le locataire occupe le logement, pour quel loyer, et s'il est à jour.
- **Courrier de révision** : le nouveau loyer, sa date d'effet et le détail du calcul avec les indices.

Le propriétaire et son adresse, saisis sur le bail, figurent en en-tête. Sans adresse du logement, c'est le nom du bien qui apparaît.

### Les alertes du tableau de bord

Pour chaque lot d'un bien loué, le tableau de bord signale : les loyers non reçus (avec l'étape de relance conseillée), un dépôt de garantie à rendre, un lot sans bail, une attestation d'assurance ou une garantie qui se termine dans les 30 jours, une révision de loyer à faire, une fin de bail ou une date limite de congé dans les 60 jours. Les rappels d'un bail se désactivent dans son formulaire ; les loyers non reçus restent toujours signalés.

## Comment faire

**Mettre un bien en location.** Dans la page Immobilier, choisissez l'utilisation « Investissement locatif » et le **mode de location** :

- *Location vide* ou *Location meublée* : le logement entier ;
- *Colocation, un bail pour tous* : un seul bail, signé par tous les colocataires ;
- *Colocation, un bail par chambre* : chaque chambre a son bail et son locataire.

Le mode décide des lots et des types de bail proposés.

**Déclarer les lots.** Dans la carte Lots, « Ajouter un lot » : nature (logement entier ou chambre selon le mode, parking, cave, local, autre), nom, surface, loyer espéré. Sans lot déclaré, le logement est créé avec le premier bail. En colocation par chambre, ajoutez d'abord les chambres. Le **loyer espéré** sert à chiffrer l'occupation et ce que coûte un lot vide.

**Créer un bail.**

1. Sur la carte Bail du lot, cliquez sur « Nouveau bail ».
2. Choisissez le type de bail. La durée légale et le dépôt maximal sont proposés ; un avertissement s'affiche si la durée s'écarte de la loi, sans bloquer.
3. Indiquez le début, le jour du mois où le loyer est dû, le loyer hors charges et les charges du lot.
4. Ajoutez les locataires (prénom ou nom requis). « Reprendre un locataire » réutilise une personne déjà saisie.
5. Ajoutez les garanties : caution d'une personne, garantie Visale, assurance loyers impayés, caution bancaire, avec leur fin éventuelle.
6. Facultatif : nom et adresse du propriétaire pour les courriers, fin de l'assurance du locataire, clause de révision et trimestre de l'indice, rappels.

Hamac refuse deux baux en même temps sur le même lot, ou le logement entier en même temps qu'une chambre. Un parking ou une cave se louent à côté du logement.

**Pointer un loyer reçu.**

- Le bouton « Reçu » enregistre le reste dû, daté de l'échéance si elle est passée, sinon d'aujourd'hui.
- « Détail » ouvre le mois : vous y ajoutez un paiement avec sa date, son montant et son moyen (virement, prélèvement, chèque, espèces, CAF, garant, autre). Un mois peut recevoir plusieurs paiements. Un paiement se supprime d'un clic.

**Rattraper plusieurs mois.** « Valider le mois » (page Gestion locative) marque reçus tous les loyers non soldés du mois choisi. « Valider l'année » (carte Loyers) fait de même pour les mois échus de l'année. Une confirmation affiche le nombre de loyers et le total. Si un seul mois est refusé, rien n'est enregistré.

**Offrir un mois.** Dans « Détail », cochez « Mois remis au locataire » et indiquez le motif (mois offert, franchise après travaux). Décochez pour que le mois redevienne dû.

**Relancer un loyer non reçu.**

1. Sur la carte Bail, l'encadré rouge indique le retard et l'étape conseillée.
2. « Préparer » ouvre le courrier de cette étape.
3. Une fois envoyé, « Noter l'envoi aujourd'hui » enregistre la date et la somme réclamée. Un envoi noté par erreur se retire.

Les délais des trois étapes se règlent dans Paramètres › Plan › Seuils d'alerte (10, 20 et 30 jours après l'échéance par défaut, dans cet ordre).

**Réviser le loyer.** Quand l'anniversaire du bail approche (45 jours avant), l'encadré « Révision du loyer » montre le loyer calculé d'après l'indice de référence des loyers de l'INSEE.

1. Cliquez sur « Réviser le loyer ».
2. Vérifiez les deux indices. S'il n'est pas encore connu, saisissez l'indice publié.
3. Indiquez la date de la demande. Vous pouvez appliquer un loyer plus bas que le calcul, jamais plus haut.
4. « Appliquer la révision » enregistre le nouveau loyer ; le courrier est prêt dans « Évolution du loyer ».

**Changer le loyer à la main.** « Nouveau loyer » : mois de départ, loyer et charges. Les mois passés ne changent pas. Pour corriger le loyer de départ, modifiez le bail.

**Enregistrer un congé ou un départ.** « Modifier ou donner congé » ouvre le bail avec une partie « Fin du bail » :

- congé du locataire ou du propriétaire (le second seulement pour un bail vide ou meublé), avec la date de réception ;
- préavis du locataire de 3 mois ou 1 mois pour un bail vide (1 mois en cas de motif justifié ou en zone tendue) ;
- départ réel, s'il diffère de la fin calculée ;
- dépôt rendu, sa date et le motif d'une retenue ;
- adresse des locataires après leur départ.

**Ajouter un rappel.** Sur la page Gestion locative, « Nouveau rappel » : objet, bien, lot éventuel, date, et « Chaque année » s'il revient. Un rappel ponctuel se marque « Fait » dans la liste À venir.

**Imprimer un document.** Quittance et avis depuis la carte Loyers, attestation depuis la carte Bail, relance depuis l'encadré des retards, courrier de révision depuis l'évolution du loyer. Utilisez l'impression du navigateur.

**Retirer un lot.** Un lot jamais loué se supprime. Un lot qui a des baux s'archive : son historique reste, et sa nature ne peut plus changer.

## Comprendre les chiffres

**Ce qui est dû pour un mois.** Le loyer et les charges en vigueur ce mois-là. Le premier et le dernier mois du bail sont au prorata des jours. Exemple : un bail de 900 € (800 € de loyer, 100 € de charges) qui commence le 16 d'un mois de 30 jours doit 450 € ce mois-là. Un mois remis ne doit rien.

**L'échéance.** Le jour du mois prévu au bail, ramené au dernier jour pour les mois plus courts (un loyer dû le 31 est dû le 30 avril).

**Les 10 jours de tolérance.** Hamac ne voit pas votre compte bancaire : il laisse 10 jours après l'échéance avant de signaler un loyer non reçu.

**Paiement partiel.** Ce qui est reçu se partage entre loyer et charges au prorata. Exemple : 450 € reçus sur 900 € dus comptent pour 400 € de loyer et 50 € de charges. Un paiement en trop reste compté sur le mois où il est pointé ; il ne passe pas tout seul au mois suivant.

**Attendu et reçu.** *Attendu* additionne ce que chaque bail doit pour le mois. *Reçu* additionne ce qui est arrivé, sans dépasser ce qui était dû pour chaque bail.

**Loyers perdus d'un lot vide.** Loyer possible × 12 × jours vides ÷ 365. Le loyer possible est le loyer espéré du lot, sinon le dernier loyer de ses baux. Exemple : un lot à 600 € vide depuis 73 jours a perdu 1 440 €. Un parking ou une cave jamais loués et sans loyer espéré ne comptent pas comme vides.

**Occupation et loyers reçus (tableau Biens).**

- *Occupation* : jours loués ÷ jours où les lots étaient proposés à la location, sur l'année choisie. Un mois remis compte comme loué.
- *Loyers reçus* : loyers hors charges pointés ÷ loyers possibles. Les loyers possibles comptent les jours loués au loyer du bail, et les jours vides au loyer possible du lot.

Sur la fiche du bien, l'*occupation* est différente : chaque lot y pèse selon son loyer, pour qu'un parking vide pèse moins qu'un appartement vide.

**Rendements (tableau Biens).** Ceux de la dernière année complète louée, sinon de la dernière année louée, quelle que soit l'année choisie dans le sélecteur. Ils se calculent sur le coût d'achat complet du bien, sans le crédit, comme expliqué dans le [guide de l'immobilier](../immobilier/guide.md#comprendre-les-chiffres).

**Relocation.** Le temps moyen entre la fin d'un bail et le début du suivant sur un même lot.

**Durées et préavis proposés.** D'après la loi du 6 juillet 1989 :

| Bail | Durée proposée | Reconduction | Congé du propriétaire | Préavis du locataire | Dépôt maximal |
|---|---|---|---|---|---|
| Location vide | 3 ans (6 ans si le bien est à une « Autre SCI ») | oui, pour la même durée | 6 mois avant l'échéance | 3 mois (1 mois possible) | 1 mois de loyer hors charges |
| Location meublée | 1 an | oui | 3 mois avant l'échéance | 1 mois | 2 mois |
| Meublé étudiant | 9 mois | non | — | 1 mois | 2 mois |
| Bail mobilité | 10 mois | non | — | 1 mois | aucun dépôt |
| Autre bail (parking, cave…) | 1 an | non | — | 3 mois | pas de plafond |

**Fin du bail.** Sans congé, un bail vide ou meublé se reconduit et n'a pas de date de fin : Hamac affiche la prochaine échéance et le dernier jour pour donner congé. Un congé du locataire termine le bail à la date de réception plus le préavis. Un congé du propriétaire vaut pour la première échéance où il est dans les temps : arrivé trop tard, il vaut pour la suivante, et la carte le signale.

**Révision du loyer.** Nouveau loyer = loyer actuel × nouvel indice ÷ indice du même trimestre un an plus tôt, arrondi au centime. Exemple : 800 € avec un indice passé de 140,00 à 142,80 donne 816 €. L'indice retenu est celui du trimestre prévu au bail, sinon celui du dernier indice publié à la date du bail. La révision prend effet à l'anniversaire, ou à la date de la demande si elle est plus tardive ; elle n'est plus possible plus d'un an après l'anniversaire. Les charges ne changent pas. L'indice dépend du code postal : métropole, Corse ou outre-mer. Aucune révision n'est proposée pour une note DPE F ou G.

**Étapes de relance.** Le retard se compte depuis l'échéance impayée la plus ancienne. Avec les réglages par défaut : rappel amiable à partir de 10 jours, relance à 20, mise en demeure à 30. Une étape est faite quand ce courrier, ou un plus ferme, est parti depuis le début de ce retard.

**Dépôt à rendre.** Dans la liste À venir, la date est la fin du bail plus deux mois, le délai le plus long. L'alerte du tableau de bord rappelle les deux délais : un mois si l'état des lieux de sortie est conforme, deux mois sinon.

## Limites

- Pas de lien avec la banque : chaque loyer se pointe à la main. L'import d'un relevé n'existe pas encore.
- En colocation à bail unique, le loyer se suit pour le bail entier, pas par colocataire.
- Ne sont pas encore faits : la régularisation annuelle des charges, les locations saisonnières, les états des lieux, l'inventaire du meublé, les interventions et prestataires, la fiscalité locative.
- Les plafonds de loyer en zone tendue et l'encadrement des loyers ne sont pas vérifiés.
- Les courriers sont des aides : relisez-les avant envoi. Les rappels sur la caution (commandement de payer à lui signifier sous quinze jours) et sur la CAF sont affichés sans avoir été vérifiés dans les textes.
- L'indice des loyers vient de l'INSEE, relu une fois par jour par l'instance. Si l'INSEE ne répond pas, les valeurs déjà connues servent, et l'indice manquant se saisit à la main.
- Un bail dont les rappels sont désactivés garde ses dates dans la liste À venir de la page Gestion locative.
- Les montants de la page Gestion locative sont ceux du bien entier, même pour un bien détenu à plusieurs ou par une SCI.
