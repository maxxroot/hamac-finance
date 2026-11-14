# Comptes et sécurité : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi ça sert

Une instance Hamac accueille plusieurs personnes, chacune avec son propre compte. Ce guide explique comment créer un compte, se connecter, protéger son compte par un mot de passe et une double authentification, et comment la personne qui administre l'instance gère les comptes.

Chaque compte a ses propres données, rangées à part de celles des autres. Personne d'autre sur l'instance ne peut les lire, pas même avec le compte administrateur depuis l'interface.

## Ce que vous y voyez

### L'écran de connexion

- **Première connexion** (instance neuve) : la création du compte administrateur, avec l'e-mail, le mot de passe et le code d'installation.
- **Connexion** : e-mail et mot de passe. Si la double authentification est active, un deuxième écran demande le code à 6 chiffres de votre application, ou un code de secours.
- **Créer un compte** : visible seulement si l'instance accepte les inscriptions. Selon le réglage, un code d'invitation est demandé.

### Paramètres › Application

- **Mot de passe** : mot de passe actuel, nouveau mot de passe (10 caractères minimum) et confirmation.
- **Double authentification** : l'état (« Activée » ou « Non activée ») et les actions possibles : activer, créer de nouveaux codes de secours, désactiver. Le nombre de codes de secours restants s'affiche.

### Bandeau et fenêtre de rappel

Tant que la double authentification n'est pas active, un bandeau le rappelle sur toutes les pages, et une fenêtre « Protégez votre compte » s'ouvre une fois après chaque connexion. Le texte est plus insistant pour le compte administrateur. Ni l'un ni l'autre n'apparaît si le serveur ne peut pas proposer la double authentification.

### Le bouton de déconnexion

Dans le menu latéral, à côté de votre adresse e-mail, le bouton « Se déconnecter » ferme la session de cet appareil.

## Comment faire

### Créer le compte administrateur (administration)

1. Lancez l'instance : `docker compose up -d --build`.
2. Lisez le code d'installation dans les journaux : `docker compose logs hamac`. Il est à usage unique, et il change à chaque redémarrage tant que le premier compte n'est pas créé.
3. Ouvrez Hamac (par défaut <http://localhost:8080>), saisissez votre e-mail, un mot de passe d'au moins 10 caractères et le code d'installation.
4. Ce premier compte devient l'administrateur de l'instance.

### Inviter une personne (administration)

1. Créez un code : `docker compose exec hamac node cli.mjs invite`. Le code vaut 7 jours. Pour une autre durée, ajoutez le nombre de jours : `node cli.mjs invite 30`.
2. Transmettez le code. Vous pouvez aussi envoyer l'adresse de l'instance suivie de `?invitation=<code>` : l'écran s'ouvre directement sur la création du compte, code rempli.
3. Le code ne sert qu'une fois.

Le mode d'inscription se règle dans `.env` avec `HAMAC_SIGNUP` : `invite` (par défaut, avec un code), `open` (libre) ou `closed` (aucune nouvelle inscription).

### Changer votre mot de passe

1. Paramètres › Application › Mot de passe.
2. Saisissez l'actuel, puis deux fois le nouveau.
3. Enregistrez. Vos autres appareils sont déconnectés ; celui-ci reste connecté.

### Réinitialiser le mot de passe d'une personne (administration)

`docker compose exec hamac node cli.mjs password <e-mail>`, puis saisissez le nouveau mot de passe (10 caractères minimum). Toutes les sessions de ce compte sont fermées.

### Activer la double authentification

1. Installez sur votre téléphone une application de codes : Aegis, 2FAS, Google Authenticator ou Microsoft Authenticator, par exemple.
2. Paramètres › Application › Double authentification › « Activer », puis saisissez votre mot de passe.
3. Scannez le QR code. Si vous ne pouvez pas scanner, saisissez la clé affichée dans l'application.
4. Saisissez le code à 6 chiffres affiché pour Hamac. Rien n'est activé avant cette étape, et elle doit être faite dans les 30 minutes.
5. Hamac affiche 10 codes de secours. Copiez-les ou téléchargez-les, et gardez-les à l'abri : ils ne seront plus jamais affichés.
6. Vos autres appareils sont déconnectés.

### Se connecter avec un code de secours

À l'écran du code, cliquez sur « Utiliser un code de secours », puis saisissez un des codes mis de côté (forme `XXXX-XXXX`). Chaque code ne sert qu'une fois.

### Créer de nouveaux codes de secours, ou désactiver la double authentification

Paramètres › Application › Double authentification, puis « Nouveaux codes de secours » ou « Désactiver ». Hamac demande votre mot de passe et un code (celui de l'application ou un code de secours). Les nouveaux codes remplacent tous les anciens.

### Débloquer une personne qui a perdu son téléphone et ses codes (administration)

`docker compose exec hamac node cli.mjs 2fa-reset <e-mail>`. La double authentification de ce compte est désactivée et ses sessions sont fermées. La personne se connecte ensuite avec son seul mot de passe, et peut réactiver la protection.

### Lister les comptes (administration)

`docker compose exec hamac node cli.mjs users` affiche l'e-mail et la date de création de chaque compte.

## Comprendre

- **L'administrateur.** C'est le premier compte créé sur l'instance. Dans l'interface, il est le seul à régler les sources de cours et à corriger les liens communs entre ETF. Il n'a aucun accès aux données des autres comptes. La gestion des comptes (invitations, mots de passe, double authentification) se fait en ligne de commande sur le serveur, pas dans l'interface.
- **Vos données sont à part.** Chaque compte a son propre espace dans la base, avec ses propres droits. Même en cas d'erreur dans l'application, un compte ne peut lire ni les données d'un autre, ni la liste des comptes, ni la base de cours commune.
- **Les mots de passe** ne sont jamais enregistrés en clair : seule une empreinte, calculée avec Argon2id, est gardée. Hamac répond de la même façon, et met le même temps, que l'e-mail existe ou non.
- **La session.** Après la connexion, votre navigateur garde un jeton de session dans un cookie que les scripts de la page ne peuvent pas lire. Une session dure 30 jours par défaut (`HAMAC_SESSION_DAYS`), puis il faut se reconnecter.
- **La double authentification** ajoute un code à 6 chiffres qui change toutes les 30 secondes (norme TOTP). Un code déjà accepté ne ressert pas. Le QR code est dessiné dans votre navigateur. Sur le serveur, le secret de votre compte est chiffré, et les codes de secours ne sont gardés que sous forme d'empreinte.
- **La clé de double authentification (administration).** Le chiffrement du secret de chaque compte dépend d'une clé du serveur : `HAMAC_2FA_KEY` dans `.env` ou, par défaut, le fichier `2fa.key` du dossier de données (volume `hamac-data`), créé au premier lancement. Sauvegardez-la avec la base, mais à part de celle-ci (`docker compose cp hamac:/data/2fa.key ./2fa.key`). Sans elle, les comptes protégés ne peuvent plus se connecter : Hamac l'indique dans ses journaux et à la connexion, et les comptes sans double authentification continuent de fonctionner. Le remède est `cli.mjs 2fa-reset <e-mail>` pour chaque compte concerné.
- **Les tentatives.** Après trop d'essais (connexion, inscription, code, mot de passe), Hamac demande d'attendre 15 minutes. À l'étape du code, cinq erreurs ou cinq minutes d'attente obligent à ressaisir le mot de passe.
- **HTTPS.** Hors de la machine qui l'héberge, Hamac refuse les connexions en HTTP simple, pour que mots de passe et sessions ne circulent jamais en clair. Pour un accès depuis Internet, suivez la section « Mise en production, en HTTPS » du `README.md`.
- **La mémoire du serveur (administration).** Par défaut, Hamac et sa base prennent la mémoire dont ils ont besoin. Pour les borner, sur une petite machine partagée par exemple, renseignez `HAMAC_MEMORY` (l'application, `1g` par exemple, 512m au minimum) et `HAMAC_DB_MEMORY` (la base, 256m au minimum) dans `.env`, puis `docker compose up -d`. Si la limite est trop basse, le conteneur est arrêté puis redémarré automatiquement, et Hamac reste indisponible quelques secondes : augmentez-la.
- **Protections du navigateur.** Hamac interdit à la page de charger des scripts venus d'ailleurs et d'être affichée dans le cadre d'un autre site. Chaque requête qui modifie quelque chose porte un en-tête qu'un formulaire d'un autre site ne peut pas envoyer.

## Limites

- Il n'y a pas de récupération de mot de passe par e-mail : seule la personne qui administre l'instance peut le réinitialiser, en ligne de commande.
- Aucune commande ne supprime un compte ni ne transfère le rôle d'administrateur. La commande `users` n'indique pas quel compte est administrateur.
- Le code d'installation n'est affiché que dans les journaux du serveur.
- Si la clé de double authentification est perdue, il n'existe pas d'autre remède que de désactiver la protection compte par compte.
