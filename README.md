# Hamac

**Planifier, suivre et contrôler son épargne retraite.** Logiciel libre (AGPL-3.0), pensé pour la fiscalité
française : livrets réglementés, assurance-vie (fonds euros), PEA, compte-titres (OAT et obligations), crypto.

> Nom provisoire. Projet en construction : voir l'état d'avancement ci-dessous.

- **App de bureau** macOS, Windows et Linux (Electron), données stockées localement dans un fichier SQLite,
  sauvegardé automatiquement chaque jour.
- **Instance web auto-hébergeable** (à venir) pour partager l'outil avec des proches, chacun dans sa propre base.
- **Aucune donnée envoyée à un tiers**, hormis les requêtes de cours de bourse.

## Fonctionnalités prévues (V1)

Journal des opérations · calendrier des versements · livrets (plancher/plafond) · fonds euros · échelle
d'obligations détenues à l'échéance (coupons, rendement actuariel) · actions et ETF (PRU, cours en direct) ·
crypto (fiscalité des cessions) · allocation cible avec désensibilisation progressive · performance (TRI) ·
impôts · projection jusqu'à la retraite et simulations · alertes et contrôles · historique mensuel.

## Développement

Prérequis : Node.js ≥ 22.13 (24 recommandé) et pnpm 9.

```bash
pnpm install
pnpm dev          # interface avec rechargement à chaud + fenêtre Electron
pnpm test         # tests (Vitest)
pnpm typecheck    # vérification des types
pnpm dist         # installateur pour l'OS courant (apps/desktop/release)
```

### Architecture

```
apps/
  desktop/    Electron : fenêtre, pont IPC, base SQLite locale
  server/     (à venir) serveur web auto-hébergé, comptes, une base SQLite par utilisateur
packages/
  core/       calculs métier purs (fiscalité, plafonds, projections, contrôles) — aucune dépendance
  api/        contrat typé (zod) entre l'interface et le backend
  backend/    SQLite natif (node:sqlite) + Drizzle, migrations embarquées, sauvegardes, handlers
  ui/         interface React, identique sur le bureau et sur le web
```

L'interface n'appelle que le contrat `@hamac/api` : via IPC sur le bureau, via HTTP sur le web.
SQLite est celui intégré à Node (`node:sqlite`) : aucun module natif à compiler, ce qui simplifie
la distribution sur les trois systèmes.

**Modifier le schéma de la base** : éditer `packages/backend/src/db/schema.ts` puis
`pnpm --filter @hamac/backend db:generate`, qui produit la migration et l'embarque dans le code.

### Variables utiles en développement

| Variable | Effet |
|---|---|
| `HAMAC_DATA_DIR` | Dossier de données isolé (ne touche pas à vos vraies données) |
| `HAMAC_SMOKE_SHOT` | Capture la fenêtre en PNG à ce chemin puis quitte |
| `HAMAC_SMOKE_ROUTE` | Page affichée avant la capture, ex. `/parametres` |

## Licence

[GNU AGPL v3](LICENSE). Toute version modifiée mise à disposition, y compris via un serveur, doit publier son code source.
