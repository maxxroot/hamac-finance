# 0004. Une base de cours commune à l'instance

- Statut : acceptée
- Date : 2026-11-08 (rédigée le 2026-11-12)

## Contexte

Plusieurs utilisateurs d'une même instance détiennent souvent les mêmes titres. Interroger les sources une fois par utilisateur gaspille les quotas (Twelve Data en particulier) et ralentit l'actualisation.

## Décision

`SharedMarket` (`packages/backend/src/market/shared.ts`) possède le schéma `marche` : un seul téléchargement par instrument (`instrumentKey`), actualisé pour toute l'instance. Seul ce service lit et écrit `marche`, si bien qu'un tenant ne peut jamais modifier les cours communs. L'administrateur de l'instance (le premier compte) règle l'ordre des sources.

Les cours manuels, ceux d'une URL personnalisée et l'historique restauré restent dans la table `prices` du tenant. `mergePrices` combine les deux au chargement : manuel > commun > historique propre.

Les compositions d'ETF suivent le même principe (`marche.compositions`, liens communs vers un équivalent physique dans `marche.composition_links`), avec le choix propre à chaque tenant dans `assets.composition_isin`.

## Conséquences

- Toute requête externe passe par `packages/backend/src/market/`, avec le `Fetcher` injectable que les tests remplacent par un faux.
- La CSP de l'interface (`packages/ui/index.html` et `apps/server/src/http/app.ts`, à garder identiques) bloque toute requête externe depuis le navigateur.
