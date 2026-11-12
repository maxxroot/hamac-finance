# 0006. Le code est rangé par couche puis par domaine, frontières vérifiées par un test

- Statut : acceptée
- Date : 2026-11-12

## Contexte

Les paquets étaient bien séparés, mais leur intérieur ne l'était plus : `core` contenait 97 fichiers à plat, `handlers.ts` faisait 1 164 lignes, et l'interface était rangée par nature (pages, composants, fenêtres), si bien qu'une fonctionnalité était éclatée entre quatre dossiers. L'analyse des imports a aussi révélé des cycles. Le modèle suivi est celui d'Argonis-paysage.

## Décision

Le chemin d'un fichier dit sa couche, puis son domaine, avec les mêmes noms de domaine d'un paquet à l'autre. Un domaine n'importe que des couches inférieures, par la façade de l'autre domaine, sans cycle. La structure est décrite dans [l'organisation du code](../architecture/organisation-du-code.md) ; le chantier, dans [le plan de réorganisation](../architecture/plan-migration-structure.md).

Les règles sont vérifiées par un test Vitest écrit pour le projet (`packages/architecture`), sans nouvelle dépendance : il tourne dans `pnpm test`, donc en CI. `dependency-cruiser` et `eslint-plugin-boundaries` ont été écartés : une dépendance et une configuration de plus pour l'un, l'arrivée d'ESLint pour l'autre.

## Conséquences

- Ajouter un domaine, c'est créer un dossier et une ligne dans la table des couches du test.
- Un import interdit fait échouer la CI.
- Entre fichiers, seuls les imports réels comptent pour les cycles : un `import type` disparaît à la compilation.
