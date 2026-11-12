# 0003. Centimes entiers en base, euros dans le domaine, taux en fractions

- Statut : acceptée
- Date : antérieure au 2026-11-08 (rédigée le 2026-11-12)

## Contexte

Les sommes en virgule flottante accumulent des erreurs d'arrondi. Le sens d'une opération (entrée ou sortie d'argent) doit être lisible sans ambiguïté.

## Décision

- En base, les montants sont des centimes entiers (colonnes `*_cents`) ; dans le code du domaine, ce sont des euros décimaux. La conversion se fait au passage (`packages/backend/src/db/units.ts`, mappers de `repo/`).
- Les taux sont des fractions (`0.128`, pas `12.8`).
- Les montants sont toujours positifs : le type de transaction donne le sens. Seules les corrections peuvent être négatives.
- Les clés sont des UUID stables.

## Conséquences

Le détail est dans [le modèle de données](../architecture/modele-de-donnees.md), à lire avant de toucher aux transactions.
