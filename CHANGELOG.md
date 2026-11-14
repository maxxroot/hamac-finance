# Journal des modifications

Tous les changements notables de Hamac sont consignés ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet applique la [gestion sémantique de version](https://semver.org/lang/fr/). Tant que la version commence par `0.`, l'application est en développement et peut encore changer. La règle complète est dans la [décision 0008](docs/decisions/0008-versions-et-journal-des-modifications.md).

## [Non publié]

### Ajouté

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

[Non publié]: https://github.com/maxxroot/hamac-finance/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/maxxroot/hamac-finance/releases/tag/v0.1.0
