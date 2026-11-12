# 0007. Chaque fonctionnalité a un guide et une documentation technique

- Statut : acceptée
- Date : 2026-11-12

## Contexte

La documentation tenait dans le README et dans des notes destinées aux agents, non versionnées. Rien ne décrivait chaque fonctionnalité pour l'utilisateur, ni où se trouve son code pour un développeur.

## Décision

Tout est documenté. Chaque sujet a un dossier `docs/<sujet>/` (nom en français) avec deux fichiers en français :

- `guide.md`, pour l'utilisateur : à quoi sert la fonctionnalité, comment s'en servir, ce que veulent dire les chiffres, en mots simples ;
- `technique.md`, pour les développeurs et les agents : où est le code, les données, les règles et leurs sources, les tests, les limites connues.

Les deux se citent en en-tête. Ils s'écrivent ou se mettent à jour **dans le même changement que le code** : une fonctionnalité sans guide ni documentation technique à jour n'est pas terminée. Un changement sans surface pour l'utilisateur (infrastructure, CI, build) n'a besoin que de `technique.md`.

## Conséquences

- L'index des sujets est dans [docs/README.md](../README.md).
- Un test vérifie que les liens entre fichiers de `docs/` ne sont pas cassés.
