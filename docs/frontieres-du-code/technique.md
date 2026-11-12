# Frontières du code : documentation technique

> Pas de guide utilisateur : ce sujet n'a aucune surface dans l'application.
> Plan d'origine : [plan de réorganisation](../architecture/plan-migration-structure.md).

## À quoi ça sert

Le code est rangé par **couche**, puis par **domaine**. Le paquet `packages/architecture` vérifie, à chaque `pnpm test` (donc en CI), que les imports respectent ce rangement :

- un domaine n'importe que des domaines de couches **inférieures** ;
- un domaine n'importe un autre domaine **que par sa façade** (`<domaine>/index.ts`) ;
- il n'y a **aucun cycle**, ni entre domaines ni entre fichiers ;
- `@hamac/core` n'importe jamais `node:`, car il tourne dans le navigateur.

Ce paquet ne contient que des tests et ne livre aucun code. Il a les types Node (il lit les fichiers sur le disque), ce que `core` ne doit pas avoir : c'est pour cela qu'il est à part.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/graph.ts` | Lit les fichiers `.ts`/`.tsx` d'un dossier (hors tests), extrait leurs imports relatifs (`import`, `export … from`, `import()`, alias comme `@/`) et construit le graphe. `findCycles` : algorithme de Tarjan. |
| `src/rules.ts` | `checkBoundaries` : applique une table « domaine → couche » au graphe et renvoie les écarts (couche, façade, domaine inconnu) et les cycles. `formatReport` les met en texte. |
| `src/graph.test.ts` | Tests de l'outil lui-même. |
| `src/core.test.ts` | Règles de `@hamac/core` : table des couches et domaine de chaque fichier. |

## Couches de `@hamac/core`

De bas en haut : `base` · `model` · `loans` · `investments`, `other-assets`, `realestate` · `portfolio` · `tax` · `analysis`, `planning`, `imports` · `alerts`. Le détail et les raisons sont au § 3 du plan.

## Ajouter un domaine

1. Créer le dossier du domaine et sa façade `index.ts`.
2. Ajouter une ligne dans la table `LAYERS` du test du paquet concerné.
3. Lancer `pnpm vitest run packages/architecture`.

Une exception (un import qui enfreint la règle mais qu'on garde) se déclare dans `allowed`, avec une ligne de commentaire qui la justifie. Le but est qu'il n'y en ait aucune.

## État

- `@hamac/core` : **bloquant** depuis l'étape 2 du plan. Aucun cycle, aucune exception.
- Les autres paquets seront ajoutés au fil des étapes 3 à 7.

Pour voir les écarts d'un paquet, lancer son test ; le message d'échec liste un problème par ligne :

```bash
pnpm vitest run packages/architecture
```
