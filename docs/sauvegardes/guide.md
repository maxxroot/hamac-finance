# Sauvegardes : guide

> Pour les développeurs : [documentation technique](technique.md).

Ce guide s'adresse à vous si vous utilisez Hamac, et aussi à la personne qui administre l'instance (celle qui gère le serveur et ses volumes Docker). Les passages réservés à l'administration le disent.

## À quoi ça sert

Une sauvegarde est un fichier unique qui contient toutes vos données Hamac. Elle sert à deux choses :

- garder une copie de sécurité ;
- passer d'une instance Hamac à une autre, ou reprendre les données de l'ancienne application de bureau.

En plus, le serveur fait tout seul une copie des données de chaque compte avant chaque mise à jour de la base.

## Ce que vous y voyez

Dans Paramètres › Application :

- **Sauvegarde et transfert** : deux boutons, « Exporter une sauvegarde » et « Restaurer une sauvegarde… ». Quand vous choisissez un fichier à restaurer, une fenêtre affiche son nom, sa date d'export, la version de Hamac qui l'a créé et son contenu (nombre de comptes, de titres, d'opérations, de versements programmés et de cours), puis demande confirmation.
- **Données et application** : la ligne « Sauvegardes » indique « Copie sur le serveur avant chaque migration », ou « désactivées ».

## Comment faire

### Exporter vos données

1. Paramètres › Application › « Exporter une sauvegarde ».
2. Votre navigateur télécharge un fichier `hamac-sauvegarde-AAAA-MM-JJ.json`.
3. Rangez-le en lieu sûr : il contient toutes vos données financières, en clair.

### Restaurer une sauvegarde

1. Si vous voulez pouvoir revenir en arrière, exportez d'abord une sauvegarde de l'état actuel.
2. Paramètres › Application › « Restaurer une sauvegarde… », puis choisissez le fichier `.json`.
3. Vérifiez le nom, la date et le contenu affichés.
4. Cliquez sur « Remplacer toutes mes données ».

Toutes vos données actuelles sont remplacées par celles du fichier, sans retour possible. Si le fichier est refusé, rien n'est modifié et le message d'erreur s'affiche.

### Passer d'une instance à une autre

1. Sur l'ancienne instance : exportez une sauvegarde.
2. Sur la nouvelle : créez votre compte, puis restaurez le fichier.

Votre mot de passe et votre double authentification ne sont pas dans le fichier : ils se règlent sur chaque instance.

### Reprendre une base de l'ancienne application de bureau

1. Sur la machine qui contient l'ancienne base, avec Node.js 22.13 ou plus récent, depuis le dossier du dépôt : `node apps/server/scripts/export-desktop.mjs`. Vous pouvez donner le chemin de la base et celui du fichier à créer : `node apps/server/scripts/export-desktop.mjs <base.sqlite> <sortie.json>`.
2. Le script crée `hamac-export-bureau.json`. La base d'origine n'est ouverte qu'en lecture.
3. Restaurez ce fichier dans Paramètres › Application.

### Retrouver la copie faite avant une mise à jour (administration)

1. Les copies sont dans le dossier de données du serveur (le volume `hamac-data`, monté sur `/data` dans Docker), sous `tenants/<identifiant du compte>/sauvegardes/`.
2. Chaque copie s'appelle `hamac-avant-<migration>.json.gz` : c'est une sauvegarde au même format, compressée.
3. Pour la restaurer : décompressez-la (par exemple avec `gunzip`), puis restaurez le fichier `.json` obtenu depuis le compte concerné, dans Paramètres › Application.

### Protéger l'instance entière (administration)

Le volume `hamac-data` est sur la même machine que la base. Pour vous protéger d'une panne de disque, copiez aussi la base ailleurs, par exemple :

```bash
docker compose exec -T db pg_dump -U hamac hamac > hamac.sql
```

Sauvegardez aussi la clé de double authentification, à part de la base : voir le [guide des comptes et de la sécurité](../comptes-et-securite/guide.md).

## Comprendre

- **Ce que contient le fichier.** Toutes les données de votre compte : réglages et paramètres du plan, établissements, comptes, titres, opérations, versements, cours, biens immobiliers, locations, crédits, projets, et le reste. Pour les cours, seuls ceux enregistrés dans votre compte y sont : cours saisis à la main, cours d'une adresse personnalisée, cours venus d'une sauvegarde restaurée.
- **Ce qu'il ne contient pas.** Votre adresse e-mail, votre mot de passe, votre double authentification, la base de cours commune à l'instance, et aucune clé d'API.
- **Tout ou rien.** Une restauration remplace toutes les tables d'un coup. Si une seule ligne pose problème, rien n'est modifié.
- **Anciennes sauvegardes.** Hamac sait relire des sauvegardes de versions antérieures, y compris celles de l'application de bureau. Il les remet au format actuel au moment de la restauration (par exemple pour les lots de location, le suivi des loyers et les fonds euros).
- **Sauvegardes plus récentes.** Une sauvegarde créée par une version plus récente de Hamac est refusée : mettez d'abord l'instance à jour.
- **Les autres comptes.** Restaurer vos données ne touche à rien chez les autres personnes de l'instance, ni à la base de cours commune.
- **La copie avant mise à jour.** Quand le serveur doit mettre à jour la structure de vos données, il écrit d'abord une copie de vos données. Si cette copie échoue, il s'arrête plutôt que de modifier vos données sans filet. Une copie déjà écrite pour une même mise à jour n'est jamais remplacée. Un compte tout neuf n'a pas de copie : il n'y a rien à protéger.

## Limites

- Le fichier exporté n'est pas chiffré. Traitez-le comme un document confidentiel.
- Une restauration est limitée à 32 Mo par requête.
- La fenêtre de restauration ne détaille que cinq types de données ; le fichier en contient bien davantage.
- La copie automatique ne se fait qu'avant une mise à jour de la base, pas chaque jour. Elle reste sur la même machine que la base.
- Pour retrouver la copie d'un compte sur le serveur, il faut connaître l'identifiant de ses données, qu'aucune commande de `cli.mjs` n'affiche aujourd'hui.
