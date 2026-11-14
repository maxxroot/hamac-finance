# Versions et mises à jour

> Pour les développeurs : [documentation technique](technique.md).

## À quoi ça sert

Savoir quelle version de Hamac vous exécutez, ce qu'une nouvelle version change pour vous, et quand la mettre à jour sans risque pour vos données.

## Lire un numéro de version

Une version s'écrit `0.2.1` : trois nombres séparés par des points.

- Le premier nombre (`0`) reste à zéro tant que Hamac est en développement. Cela veut dire que les écrans ou le fonctionnement peuvent encore changer d'une version à l'autre. Il passe à `1` quand l'application est jugée stable.
- Le deuxième nombre augmente quand une fonctionnalité visible arrive.
- Le troisième augmente quand des erreurs sont corrigées, sans nouveauté.

## Savoir ce qui change

Le [journal des modifications](../../CHANGELOG.md) liste, version par version, ce qui est ajouté, modifié, retiré ou corrigé. Chaque version publiée a aussi sa page sur GitHub, dans « Releases ».

## Mettre à jour

1. Lisez le journal des modifications pour la version visée.
2. Récupérez le code de la version voulue, puis relancez `docker compose up -d --build`.
3. Vos données sont migrées automatiquement à la première ouverture de chaque espace. Une copie de la base est faite juste avant ([sauvegardes](../sauvegardes/guide.md)).

Si le journal signale une étape à faire à la main (un nouveau réglage dans le fichier `.env`, par exemple), elle est indiquée dans la rubrique de la version concernée.

## Limites actuelles

L'application n'affiche pas encore son numéro de version à l'écran. Pour le connaître, regardez le tag git que vous avez récupéré ou le champ `version` du fichier `package.json` à la racine.
