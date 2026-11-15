# Documentation de Hamac

Chaque fonctionnalité a son dossier, avec deux fichiers :

- `guide.md` pour l'utilisateur : à quoi sert la page, comment s'en servir, ce que veulent dire les chiffres ;
- `technique.md` pour les développeurs : où est le code, les données, les règles et leurs sources, les tests, les limites connues.

Une fonctionnalité nouvelle ou modifiée met à jour ses deux fichiers dans le même changement que le code ([décision 0007](decisions/0007-documentation-guide-et-technique.md)).

## Vue d'ensemble

| Sujet | Guide | Technique |
|---|---|---|
| Tableau de bord | [guide](tableau-de-bord/guide.md) | [technique](tableau-de-bord/technique.md) |
| Performance | [guide](performance/guide.md) | [technique](performance/technique.md) |
| Exposition réelle | [guide](exposition-reelle/guide.md) | [technique](exposition-reelle/technique.md) |
| Projection | [guide](projection/guide.md) | [technique](projection/technique.md) |
| Historique | [guide](historique/guide.md) | [technique](historique/technique.md) |
| Projets | [guide](projets/guide.md) | [technique](projets/technique.md) |
| Simulateurs | [guide](simulateurs/guide.md) | [technique](simulateurs/technique.md) |

## Saisie

| Sujet | Guide | Technique |
|---|---|---|
| Journal | [guide](journal/guide.md) | [technique](journal/technique.md) |
| Versements | [guide](versements/guide.md) | [technique](versements/technique.md) |

## Enveloppes et placements

| Sujet | Guide | Technique |
|---|---|---|
| Mes comptes | [guide](comptes/guide.md) | [technique](comptes/technique.md) |
| Livrets | [guide](livrets/guide.md) | [technique](livrets/technique.md) |
| Fonds euros | [guide](fonds-euros/guide.md) | [technique](fonds-euros/technique.md) |
| Obligations | [guide](obligations/guide.md) | [technique](obligations/technique.md) |
| Actions & ETF | [guide](actions-et-etf/guide.md) | [technique](actions-et-etf/technique.md) |
| Crowdlending | [guide](crowdlending/guide.md) | [technique](crowdlending/technique.md) |
| Crypto | [guide](crypto/guide.md) | [technique](crypto/technique.md) |
| Autres biens | [guide](autres-biens/guide.md) | [technique](autres-biens/technique.md) |

## Immobilier et crédits

| Sujet | Guide | Technique |
|---|---|---|
| Immobilier | [guide](immobilier/guide.md) | [technique](immobilier/technique.md) |
| Gestion locative | [guide](gestion-locative/guide.md) | [technique](gestion-locative/technique.md) |
| Crédits | [guide](credits/guide.md) | [technique](credits/technique.md) |

## Fiscalité

| Sujet | Guide | Technique |
|---|---|---|
| Impôts | [guide](impots/guide.md) | [technique](impots/technique.md) |
| Compteurs et plafonds | [guide](compteurs-et-plafonds/guide.md) | [technique](compteurs-et-plafonds/technique.md) |
| Aide à la déclaration | [guide](aide-a-la-declaration/guide.md) | [technique](aide-a-la-declaration/technique.md) |

## Réglages et instance

| Sujet | Guide | Technique |
|---|---|---|
| Paramètres | [guide](parametres/guide.md) | [technique](parametres/technique.md) |
| Sources de cours | [guide](sources-de-cours/guide.md) | [technique](sources-de-cours/technique.md) |
| Sauvegardes | [guide](sauvegardes/guide.md) | [technique](sauvegardes/technique.md) |
| Comptes et sécurité | [guide](comptes-et-securite/guide.md) | [technique](comptes-et-securite/technique.md) |
| Assistants (MCP) | [guide](assistants-mcp/guide.md) | [technique](assistants-mcp/technique.md) |
| Versions et mises à jour | [guide](versions/guide.md) | [technique](versions/technique.md) |

## Pour les développeurs

- [Organisation du code](architecture/organisation-du-code.md) : couches, domaines, où va un nouveau fichier.
- [Modèle de données](architecture/modele-de-donnees.md) : à lire avant de toucher aux transactions.
- [Frontières du code](frontieres-du-code/technique.md) : le test qui fait respecter l'organisation.
- [Décisions](decisions/README.md) : les choix d'architecture et leurs raisons.
- [Plan de réorganisation](architecture/plan-migration-structure.md) : le chantier du 2026-11-12.
- [Propositions](propositions/) : chantiers étudiés, pas encore engagés.
