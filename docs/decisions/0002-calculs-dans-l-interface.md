# 0002. Les calculs tournent dans l'interface, le backend stocke

- Statut : acceptée
- Date : antérieure au 2026-11-08 (rédigée le 2026-11-12)

## Contexte

Les simulations (projection, simulateurs, choix d'une répartition) doivent répondre instantanément. Les données d'un utilisateur tiennent largement en mémoire.

## Décision

`workspace.load` renvoie tout l'espace de travail en un appel. L'interface le donne au moteur pur de `@hamac/core` (`computePortfolio`, `buildHistory`, projection…), mémorisé par espace de travail et par jour (`packages/ui/src/shared/lib/portfolio.ts`). Chaque modification passe par `useMutate`, qui invalide l'espace de travail : tout se recalcule.

Le backend stocke, valide et récupère les cours ; il ne calcule pas la valeur du portefeuille.

## Conséquences

- `@hamac/core` reste pur et utilisable dans le navigateur : aucune entrée-sortie, aucun `import "node:…"`. Le test des frontières le vérifie.
- La validation métier (par exemple `validateTransaction`) vit dans `core` et sert à la fois aux formulaires et au backend.
- Les cours envoyés à l'interface sont réduits au dernier cours de chaque mois.
