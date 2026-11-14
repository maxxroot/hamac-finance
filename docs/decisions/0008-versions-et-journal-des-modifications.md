# 0008. Versions numérotées et journal des modifications

- Statut : acceptée
- Date : 2026-11-14

## Contexte

Les `package.json` indiquaient `0.1.0` depuis le début, mais rien dans git ni sur GitHub ne marquait une version : le seul tag était `derniere-version-desktop`, pour l'ancienne application Electron. Le dépôt est public ; une personne qui héberge Hamac ne peut pas savoir quelle version elle exécute, ni ce qui change en mettant à jour. Or chaque version doit pouvoir migrer les données des précédentes.

## Décision

**Numérotation.** [Gestion sémantique de version](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`, tag git `vMAJEUR.MINEUR.CORRECTIF`.

- Tant que la version commence par `0.`, l'application est en développement : le modèle de données, les procédures et les écrans peuvent encore changer. On incrémente le **mineur** (`0.2.0`) pour une fonctionnalité visible, le **correctif** (`0.1.1`) pour des corrections seules.
- `1.0.0` est décidée par le propriétaire du dépôt, quand l'application est jugée stable pour d'autres utilisateurs. À partir de là, un changement incompatible (schéma de données sans migration automatique, contrat d'API, configuration `.env`) impose un nouveau majeur.

**Un seul numéro.** Les sept `package.json` du dépôt portent la même version, changée ensemble. Aucun n'est publié séparément. Le numéro de `package.json` à la racine est la référence.

**Journal des modifications.** Le fichier `CHANGELOG.md` à la racine suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), rédigé en français, pour l'utilisateur : ce qu'il peut faire de nouveau, ce qui change, ce qui est corrigé. Rubriques : Ajouté, Modifié, Obsolète, Retiré, Corrigé, Sécurité. Il est tenu à la main, pas généré : les commits `Zone : description` en français ne suivent pas le format des Conventional Commits, et un journal doit se lire, pas se déduire.

- Tout changement visible de l'extérieur (fonctionnalité, comportement, correction, migration, réglage `.env`) ajoute une ligne dans la section `[Non publié]`, **dans le même changement que le code**, comme la documentation ([décision 0007](0007-documentation-guide-et-technique.md)).
- Un changement sans effet visible (refactorisation, tests, CI) n'a pas de ligne.

**Publier une version.** On renomme `[Non publié]` en `[X.Y.Z] - date`, on aligne les `package.json`, on commite, on pose le tag annoté `vX.Y.Z` sur ce commit, on le pousse, puis on crée la release GitHub avec les notes du journal. La procédure détaillée est dans [docs/versions/technique.md](../versions/technique.md).

**Migrations.** Un tag publié est un engagement : une migration déjà livrée ne se réécrit pas. Un changement de schéma s'ajoute par une nouvelle migration, avec une migration de données écrite à la main quand elle est nécessaire, et il est signalé dans le journal.

## Conséquences

- Un tag poussé sur le dépôt public ne se déplace plus. Une erreur se corrige par une version suivante.
- Les tags existants antérieurs (`derniere-version-desktop`) restent hors de cette numérotation.
- L'application n'affiche pas encore son numéro de version à l'écran : à faire dans un second temps.
