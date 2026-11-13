# Crowdlending : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

La page **Crowdlending** (menu Placements) suit l'argent que vous prêtez à des projets (souvent immobiliers) par une plateforme de financement participatif. Chaque plateforme est un compte ; chaque prêt est un **projet**, suivi un par un : montant prêté, taux, échéance, capital déjà rendu, retard ou défaut.

Vous y faites trois choses : noter vos projets, déclarer chaque mois les intérêts reçus, et, pour Bricks, importer le fichier de transactions de la plateforme.

Quelques mots utilisés sur la page :

- **In fine** : le capital est rendu en une fois, à l'échéance.
- **Intérêts mensuels, capital à l'échéance** : des intérêts chaque mois, le capital à la fin.
- **Mensualités** : chaque mois, une part du capital et des intérêts, comme un crédit.
- **Capital restant** : ce que l'emprunteur vous doit encore.
- **En retard** : la plateforme annonce que l'emprunteur ne paie plus à temps.
- **En défaut** : la plateforme annonce que le projet ne remboursera pas comme prévu. Vous pouvez indiquer ce que vous espérez récupérer.

Par défaut, le crowdlending est hors de votre allocation cible ; chaque projet peut être inclus ou non.

La page est la même dans les deux formats de Hamac (« retraite » et « patrimoine »). Elle disparaît du menu si vous masquez le module « Crowdlending » dans Paramètres › Plan › Modules.

## Ce que vous y voyez

En haut, les boutons : **Ajouter un compte**, puis, dès qu'une plateforme existe, **Importer un fichier Bricks**, **Déclarer les intérêts du mois** et **Nouveau projet**.

Sans plateforme, un encadré explique comment commencer : créer la plateforme dans Paramètres › Établissements, lui ajouter un compte de crowdlending, puis les projets.

Avec au moins une plateforme :

**Une ligne de comptage**, par exemple « 12 projets investis · 8 en cours · 4 remboursés ». Les situations sans projet sont omises.

**Quatre chiffres** :

- **Capital en cours** : le capital restant des projets en cours ou en retard, et le taux moyen.
- **À réinvestir** : les euros présents sur les plateformes. Rouge s'il est négatif.
- **Intérêts reçus** : le total des intérêts déclarés.
- **En retard ou en défaut** : le capital restant des projets en difficulté. Orange s'il n'est pas nul.

**Le tableau des plateformes** : capital en cours, taux moyen prévu, intérêts reçus, et rendement réel annualisé. Cliquez sur une plateforme pour déplier sa courbe d'évolution.

**Le tableau des projets**, d'abord ceux en défaut, puis en retard, en cours, remboursés ; à statut égal, par prochaine échéance. Pour chaque projet : nom, plateforme et mode de remboursement (ou commentaire), investi, taux, capital restant (et, pour un défaut, la somme comptée dans le patrimoine), prochaine échéance, fin (avec « Prolongée » et la date prévue au départ si l'échéance a été repoussée), statut. Un projet encore « en cours » après sa fin porte l'étiquette **Échéance dépassée**. En bout de ligne, quand la souris passe dessus, des boutons pour modifier ou supprimer le projet.

## Comment faire

**Créer une plateforme.** Dans Paramètres › Établissements, créez l'établissement (Bricks, par exemple). Si la plateforme retient les impôts sur les intérêts, cochez la case correspondante et vérifiez les taux. Puis, sur cette page, « Ajouter un compte ».

**Ajouter un projet.** « Nouveau projet » : plateforme, nom, montant investi, taux annuel, durée en mois, date d'investissement (l'argent quitte les euros de la plateforme ce jour-là), mode de remboursement. Le statut est « En cours » au départ.

**Passer un projet en retard ou en défaut.** Modifiez le projet, choisissez le statut et le mois de début. Pour un défaut, indiquez si vous le savez le montant que vous espérez récupérer ; sans montant, le projet compte pour 0 €.

**Noter un remboursement complet.** Statut « Remboursé », avec la date. Le capital revient dans les euros de la plateforme ce jour-là.

**Corriger le capital déjà rendu.** Remplissez « Capital déjà remboursé » avec le chiffre de la plateforme. Vide, Hamac le calcule.

Pour le tenir à jour au fil des remboursements sans calculer de tête, tapez un calcul qui commence par **=**, comme dans un tableur : avec 120 € déjà notés, ajoutez `=120+35,50` et le champ affiche 155,50 €. Le plus simple : cliquez au début du champ, tapez `=`, puis `+` et le nouveau remboursement à la fin. Les signes + − × ÷ (ou * et /) et les parenthèses marchent. Hamac garde le résultat, pas le calcul.

**Repousser l'échéance.** Remplissez « Échéance prolongée au » avec le nouveau mois. Il doit être après l'échéance prévue.

**Déclarer les intérêts du mois.** Cliquez sur le bouton, choisissez la plateforme et le mois, saisissez les intérêts **bruts** (avant impôts) affichés par la plateforme, paiements partiels compris. Si la plateforme retient les impôts, Hamac les calcule à son taux ; corrigez-les pour coller à son relevé. Si elle ne les retient pas, laissez la case vide. Hamac vous prévient si des intérêts sont déjà déclarés pour ce mois.

**Importer un fichier Bricks.** Exportez vos transactions depuis Bricks au format .xlsx. Cliquez sur « Importer un fichier Bricks », choisissez le fichier et la plateforme. Hamac compare le fichier à ce qu'il connaît et ne propose que ce qui est nouveau, modifié ou à retirer. Décochez ce que vous ne voulez pas, puis « Appliquer ». Réimporter le même fichier ne change rien.

## Comprendre les chiffres

**Ce que vaut un projet dans le patrimoine.**

- En cours ou en retard : son capital restant.
- En défaut : le montant espéré, sans dépasser le capital restant ; 0 € sans montant.
- Remboursé : 0 € (l'argent est revenu dans les euros de la plateforme).

Le statut ne compte qu'à partir de sa date : un défaut daté de mars n'efface pas la valeur du projet en février, dans l'historique.

**Capital déjà rendu.** Le chiffre saisi s'il existe. Sinon : tout le capital pour un projet remboursé ; rien pour un projet en défaut, in fine, ou à intérêts mensuels ; pour un projet à mensualités, le capital amorti comme pour un crédit, mois par mois depuis un mois après l'investissement. Pour un projet en retard à mensualités, le calcul s'arrête au mois du retard.

**Euros de la plateforme (« À réinvestir »).** Vos versements et intérêts, moins vos retraits et les impôts prélevés, moins l'argent encore prêté. Exemple : 10 000 € versés, deux projets de 4 000 € chacun, l'un remboursé : 10 000 − 4 000 = 6 000 € à réinvestir.

**Prochaine échéance.** Pour un projet in fine : sa date de fin. Pour les autres : le prochain mois de paiement, à partir d'un mois après l'investissement.

**Taux moyen.** La moyenne des taux des projets en cours et en retard, pondérée par leur capital restant. Les projets sans taux ne comptent pas.

**Rendement réel annualisé.** Le taux annuel qui relie vos versements et retraits sur la plateforme à sa valeur d'aujourd'hui (euros non investis compris). Les intérêts et les pertes y sont donc inclus. Il faut au moins un an d'historique.

**Intérêts déclarés.** La déclaration crée une ligne « Intérêts » au Journal, datée du dernier jour du mois (ou d'aujourd'hui pour le mois en cours). Si des impôts sont retenus, une seconde ligne « Impôts » les retire, comme sur le relevé de la plateforme. Les impôts calculés se partagent entre l'acompte d'impôt sur le revenu (au plus 12,8 % des intérêts) et les prélèvements sociaux (le reste du taux). Exemple : 100 € d'intérêts bruts, taux de 31,4 % : 31,40 € d'impôts, dont 12,80 € d'acompte et 18,60 € de prélèvements sociaux ; il reste 68,60 €. Si la plateforme est dispensée de l'acompte de 12,8 % pour l'année (encadré de la page Impôts, année puis établissement), seuls les prélèvements sociaux sont retenus ; l'impôt sur le revenu de ces intérêts se paie à la déclaration.

**Import Bricks.** Les dépôts par carte deviennent des versements ; les primes de parrainage et le « solde boosté » deviennent des corrections ; les revenus reversés et les prélèvements à la source sont regroupés par mois en une ligne d'intérêts **nets** ; les achats de bricks forment les projets (un par bien, montants additionnés) ; les remboursements de capital donnent le capital rendu, et un projet entièrement remboursé passe en « Remboursé ». Seules les lignes « Validée » comptent. Un intérêt déjà déclaré à la main le même mois est signalé en **conflit**, décoché par défaut.

## Limites

- Hamac ne lit pas la plateforme : tout vient de vos saisies ou de l'import Bricks. L'import ne connaît que le fichier de transactions Bricks.
- Un projet importé n'a ni taux ni durée : complétez-les à la main pour voir le taux moyen, la fin et la prochaine échéance.
- L'import enregistre des intérêts nets. Si Bricks retient les impôts, cochez « La plateforme prélève les impôts » sur l'établissement, sinon ces impôts seront comptés une seconde fois (la fenêtre d'import le rappelle).
- Le capital rendu d'un projet à intérêts mensuels n'est pas calculé : il reste dû jusqu'au remboursement.
- Les intérêts ne sont pas calculés à partir des projets : seuls ceux que vous déclarez comptent.
- Le statut « En retard » ou « En défaut » se saisit à la main : Hamac ne le devine pas. Il signale seulement une échéance dépassée.
