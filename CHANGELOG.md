# Journal des modifications

Tous les changements notables de Hamac sont consignés ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet applique la [gestion sémantique de version](https://semver.org/lang/fr/). Tant que la version commence par `0.`, l'application est en développement et peut encore changer. La règle complète est dans la [décision 0008](docs/decisions/0008-versions-et-journal-des-modifications.md).

## [Non publié]

### Ajouté

- Obligations : une obligation d'État n'est plus forcément française. On choisit le pays de l'État émetteur dans une liste avec recherche et petits drapeaux (tapez « belg » puis Entrée). Le nom suit l'usage du pays (OAT pour la France, OLO pour la Belgique, Bund pour l'Allemagne…), l'échéance d'un autre État se saisit à la date exacte (seule l'OAT tombe le 25), et la répartition par émetteur comme la concentration comptent chaque État à part. La recherche par ISIN reconnaît le pays, et l'assistant (MCP) le renseigne avec `issuerCountry` dans `save_asset`.

### Corrigé

- Obligations : une obligation d'État étrangère était enregistrée comme française (émetteur « République française », nom « OAT », échéance forcée au 25, rangée sous « État français »). À la mise à jour, chaque obligation d'État reçoit le pays de son ISIN (sinon la France), et une OAT belge, allemande, italienne ou espagnole est renommée OLO, Bund, BTP ou Bono. Vérifiez ensuite sa date d'échéance dans sa fiche : elle avait reçu le 25 du mois.

## [0.3.0] - 2026-11-15

Chaque compte a désormais sa page, et les pages de placement montrent tous vos comptes ensemble. L'assistant tient vos comptes et prépare vos impôts, toujours après votre accord.

### Ajouté

- Assistants (MCP) : l'assistant tient désormais vos comptes, toujours après votre accord. Il crée et modifie les établissements (fiscalité, protection, grilles de frais), les comptes et contrats, les titres (dont obligations et fonds euros) et leurs cours saisis, les opérations, les versements programmés, les taux des livrets et les taux servis des fonds euros. Il peut aussi supprimer, en deux temps : il annonce ce qui disparaîtra, puis supprime une fois que vous avez confirmé.
- Assistants (MCP) : l'assistant prépare vos impôts. Il donne les cases à reporter sur la déclaration et le détail par établissement, compare l'IFU d'un établissement aux calculs de Hamac case par case puis l'enregistre après votre accord, estime l'impôt restant à payer et passe en revue la liste de fin d'année. Deux scénarios prêts à l'emploi : « Préparer ma déclaration de revenus » et « Bilan fiscal de fin d'année ». Vos paramètres fiscaux restent en lecture seule.
- L'interface se met à jour seule quand des données changent ailleurs (assistant, autre onglet) : quand vous revenez sur l'onglet, puis toutes les 20 secondes tant qu'il est affiché.
- Nouvelle classe d'actifs « Liquidités » : l'argent pas encore investi d'un compte (PEA, compte-titres, plateforme…) y compte, au lieu de la classe du compte. Elle est hors de l'allocation cible par défaut, et la projection range cet argent là où le plan place celui du compte.
- Import de relevés CSV : le nom et le type du titre (action, ETF, fonds…) sont lus dans le fichier, et le relevé Trade Republic est reconnu sans réglage (quantité, ISIN, type d'opération).
- Chaque compte a sa page : tout ce qu'il contient, quelle que soit la classe d'actifs (ETF et fonds euros d'une assurance-vie, actions et obligations d'un compte-titres, espèces), sa répartition par classe (ETF, actions, fonds, obligations… chacune avec sa couleur et un lien vers sa page), ses caractéristiques (fiscalité allégée, frais, clause bénéficiaire…), son évolution et ses mouvements. On l'ouvre depuis la liste des comptes ajoutée sous « Mes comptes » dans le menu, ou en cliquant sur le nom d'un compte, partout où il apparaît.
- Nouveau type de titre « ETC (matières premières) », pour l'or, l'argent et les autres métaux physiques cotés, et nouvelle classe d'actifs « Matières premières » qui les regroupe (hors allocation cible par défaut). Un ETC se détient en compte-titres, assurance-vie ou PER, pas en PEA ; son cours vient de justETF par l'ISIN, et Hamac ne cherche plus de composition pour lui. La recherche de titres et l'import de relevés reconnaissent les ETC. Un ETC déjà saisi comme ETF se corrige en changeant son type dans sa fiche.

### Modifié

- **Changement incompatible pour les assistants (MCP)** : l'outil `create_asset` s'appelle désormais `save_asset` et sert aussi à modifier un titre. À faire : reconnectez votre assistant pour qu'il relise la liste des outils, et remplacez `create_asset` par `save_asset` dans vos scénarios ou instructions. L'accès « Lecture et import » d'un jeton s'appelle désormais « Lecture et écriture » : un jeton de ce type créé avant cette version permet donc maintenant à l'assistant de créer, modifier et supprimer vos données (toujours après votre accord). Si vous ne le souhaitez pas, révoquez-le dans Paramètres › Application et créez un jeton « Lecture seule ».
- La page Fonds euros montre tous vos contrats ensemble : un seul tableau, une ligne par fonds euros et par contrat, avec son dernier taux servi ; dépliée, la ligne montre les taux servis de chaque année. La fiche du contrat (ancienneté, clause bénéficiaire, frais, garantie) et le contrôle avec le relevé de l'assureur passent sur la page du contrat, tout comme les alertes qui s'y rapportent.
- La page Obligations indique le compte de chaque ligne et rappelle, en haut, les comptes qui détiennent des obligations.
- La page Actions & ETF montre tous vos comptes ensemble : un seul tableau, une ligne par titre et par compte, au lieu d'un bloc par compte. Les parts cibles se comparent sur l'ensemble des comptes (un ETF détenu dans le PEA et le compte-titres est additionné). La date des 5 ans du PEA et la grille de courtage passent sur la page du compte.
- Un compte-titres n'est plus rangé d'office du côté des obligations : la page Obligations ne reprend que les comptes qui en détiennent, et seulement les mouvements de ces obligations ; un nouveau titre saisi sur un compte-titres n'est plus une OAT par défaut.

## [0.2.0] - 2026-11-15

Hamac se pilote désormais depuis un assistant conversationnel : on lui confie un relevé, il l'importe après un aperçu et votre accord.

### Ajouté

- Assistants (MCP) : un assistant comme Claude Code peut se brancher sur Hamac avec un jeton d'accès créé dans Paramètres › Application. Il consulte le patrimoine, les comptes, les opérations et les contrôles de Hamac, compare un relevé de situation à l'encours calculé et, avec un jeton « lecture et import », importe les opérations d'un relevé (PDF, CSV, OFX, QIF) après un aperçu et votre accord, avec annulation possible pendant 24 heures. `HAMAC_MCP=0` coupe les assistants sur l'instance.
- Limite de mémoire facultative pour l'application et pour la base, à régler dans `.env` (`HAMAC_MEMORY`, `HAMAC_DB_MEMORY`).
- Exposition réelle : l'administrateur peut déposer le fichier de composition d'un ETF iShares, téléchargé depuis son navigateur, quand iShares refuse le serveur.

### Modifié

- Exposition réelle : les équivalents proposés sont d'abord des ETF Amundi qui suivent exactement le même indice, car iShares refuse souvent les serveurs hébergés. Un refus d'iShares (403) est expliqué en clair, et un équivalent peut remplacer une composition qui ne se met plus à jour.

## [0.1.0] - 2026-11-14

Première version publique : une application web auto-hébergée, avec PostgreSQL, un espace isolé par compte et toute la fiscalité française de base. Elle reprend la logique d'un tableur personnel.

### Ajouté

**Enveloppes et placements**
- Livrets réglementés avec taux datés et règle des quinzaines.
- Assurance-vie, PEA, PEA-PME, PER (assurantiel ou bancaire), compte-titres et épargne salariale.
- Fonds euros comme support des contrats, rendement par titre et arbitrage d'un support à un autre.
- Actions et ETF, avec achat d'un titre nouveau depuis la saisie.
- Obligations d'État ou d'entreprise : calendrier des coupons, coupon couru, rendement brut et net de fiscalité.
- Crowdlending : plateformes et suivi projet par projet, import du fichier de transactions Bricks, retards et défauts.
- Crypto, avec le calcul des plus-values (prix d'acquisition global, article 150 VH bis).
- Autres biens : or, objets, véhicules, parts de société, argent prêté, usufruit, nue-propriété et parts de SCI.
- Crédits : amortissement, différé, remboursements anticipés, assurance, coût année par année, « rembourser par avance ou placer ».

**Immobilier et gestion locative**
- Biens, lots, colocation par chambre, locataires, baux et garanties.
- Suivi strict des loyers : paiements pointés, relances, avis d'échéance, quittances, attestation, révision du loyer selon l'indice INSEE.
- Dépenses, travaux, charges avec part récupérable sur le locataire.
- Rentabilité : cashflow mensuel réel et prévu, bilan depuis l'achat, coût de revient crédit compris, impôts sur les loyers (quatre régimes), projection avec revente.

**Saisie**
- Journal d'opérations, calculs dans les montants, versements programmés et ponctuels, calendrier des versements.
- Import de relevés CSV, OFX et QIF, avec repérage des doublons et des transferts.

**Analyse et projection**
- Tableau de bord : évolution par période, allocation réelle face à la cible, enveloppes.
- Performance par titre et par classe, comparateur (y compris de titres non détenus).
- Historique : remonter le temps entre deux dates, écart au plan.
- Exposition réelle derrière les ETF (compositions Amundi et iShares), concentration et volatilité.
- Projection jusqu'au départ à la retraite et revenu mensuel possible ensuite, projets avec sommes à réunir.
- Simulateurs de rendement brut et net d'impôts, protection en cas de faillite d'un établissement, compteurs et plafonds.

**Fiscalité**
- Règles déclaratives par année de revenus, avec leur source et leur date de vérification.
- Registre des cessions et report des moins-values, impôts à payer à la prochaine déclaration.
- Aide à la déclaration : fiches par établissement et récapitulatif complet en PDF et CSV, contrôles de cohérence, case de chaque revenu.
- Dispense de l'acompte de 12,8 % sur les intérêts, année par année, avec rappel avant le 30 novembre.

**Cours de marché**
- Chaîne de sources avec repli : Euronext, Twelve Data, Yahoo, URL personnalisée, saisie manuelle.
- Base de cours commune à l'instance, téléchargée une fois et tenue à jour même sans connexion.

**Comptes et sécurité**
- Plusieurs utilisateurs sur une même instance, chacun dans un espace isolé, sur invitation.
- Mots de passe hachés avec Argon2id, double authentification par code (TOTP) avec codes de secours.
- HTTPS avec Caddy, code d'installation à usage unique pour le premier compte, conteneurs durcis.
- Sauvegarde automatique avant chaque migration de la base.

**Interface**
- Thèmes clair « Maison » et sombre « Nocturne », barre latérale réductible, tableaux triables.
- Modules activables et usage au choix (« Préparer ma retraite » ou « Gérer mon patrimoine »).

**Installation**
- Une seule commande : `docker compose up -d --build`.

### Retiré

- L'application de bureau (Electron) : seule la version web est maintenue. La dernière version de bureau reste disponible au tag `derniere-version-desktop`.

[Non publié]: https://github.com/maxxroot/hamac-finance/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/maxxroot/hamac-finance/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/maxxroot/hamac-finance/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/maxxroot/hamac-finance/releases/tag/v0.1.0
