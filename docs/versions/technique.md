# Versions et journal des modifications : technique

> Pour l'utilisateur : [guide](guide.md). Décision : [0008](../decisions/0008-versions-et-journal-des-modifications.md).

## Où est quoi

- `CHANGELOG.md` à la racine : le journal, au format Keep a Changelog, en français.
- `package.json` à la racine et dans `apps/server`, `packages/api`, `packages/architecture`, `packages/backend`, `packages/core`, `packages/ui` : champ `version`, identique partout.
- Tags git `vX.Y.Z` : un par version publiée, annotés, posés sur le commit de publication. Le tag `derniere-version-desktop` est antérieur et hors numérotation.
- Releases GitHub : une par tag, avec les notes du journal.

## Règles

- Numérotation sémantique, voir la décision 0008. Tant que `MAJEUR` vaut `0`, le mineur marque une fonctionnalité visible et le correctif une correction seule.
- Le journal est tenu à la main. Chaque changement visible de l'extérieur ajoute une ligne sous `[Non publié]` dans le même commit que le code. Les rubriques sont Ajouté, Modifié, Obsolète, Retiré, Corrigé, Sécurité. Une ligne dit ce que l'utilisateur constate, pas ce que le code fait.
- Un changement incompatible (schéma sans migration automatique, procédure du contrat, variable `.env`) se signale en tête de sa rubrique, avec l'action à mener.
- Un tag publié ne se déplace pas et une migration livrée ne se réécrit pas.

## Publier une version

Choisir le numéro `X.Y.Z` selon la règle ci-dessus, puis :

1. Dans `CHANGELOG.md`, renommer `[Non publié]` en `[X.Y.Z] - AAAA-MM-JJ`, rouvrir une section `[Non publié]` vide au-dessus, et mettre à jour les deux liens de comparaison en bas du fichier.
2. Aligner les sept `package.json` : `pnpm -r --include-workspace-root exec npm pkg set version=X.Y.Z`.
3. Vérifier : `pnpm vitest run packages/architecture`, `pnpm typecheck`, `pnpm test`.
4. Commiter (`Version : X.Y.Z`), puis poser le tag annoté sur ce commit : `git tag -a vX.Y.Z -m "Hamac X.Y.Z"`.
5. Pousser le commit puis le tag : `git push origin main && git push origin vX.Y.Z`.
6. Créer la release GitHub avec les notes de la version : `gh release create vX.Y.Z --title "Hamac X.Y.Z" --notes-file <extrait du journal>`.

Une erreur après le push se corrige par la version suivante, pas en déplaçant le tag.

## Tests

Aucun test ne vérifie encore que le journal et les `package.json` sont à jour ; la procédure ci-dessus le garantit à la main.

## Limites connues

- Le numéro de version n'est pas affiché dans l'application ni renvoyé par le serveur.
- Pas de publication automatique de la release : elle se fait à la main depuis un poste.
