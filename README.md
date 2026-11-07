# Hamac

**Planifier, suivre et contrôler son épargne retraite.** Logiciel libre (AGPL-3.0), pensé pour la fiscalité
française : livrets réglementés, assurance-vie (fonds euros), PEA, compte-titres (OAT et obligations), crypto.

> Nom provisoire.

- **App de bureau** macOS, Windows et Linux (Electron), données stockées localement dans un fichier SQLite,
  sauvegardé automatiquement chaque jour.
- **Instance web auto-hébergeable** pour partager l'outil avec des proches, chacun dans sa propre base.
- **Aucune donnée envoyée à un tiers**, hormis les requêtes de cours de bourse.

## Fonctionnalités

Journal des opérations · calendrier des versements · livrets (plancher/plafond) · fonds euros · échelle
d'obligations détenues à l'échéance (coupons, rendement actuariel) · actions et ETF (PRU, cours en direct) ·
crypto (fiscalité des cessions) · allocation cible avec désensibilisation progressive · performance (TRI) ·
impôts · projection jusqu'à la retraite et simulations · alertes et contrôles · historique mensuel.

## Héberger une instance pour vos proches

```bash
docker compose up -d                              # http://localhost:8080
docker compose exec hamac node cli.mjs invite     # code d'invitation à envoyer
docker compose exec hamac node cli.mjs users      # liste des comptes
```

Le premier compte créé devient celui de l'administrateur. Ensuite, l'inscription demande un code d'invitation
(`HAMAC_SIGNUP=invite`, par défaut), est libre (`open`) ou fermée (`closed`). Chaque utilisateur a sa propre base
SQLite et ses sauvegardes quotidiennes dans le volume `/data`. Placez un reverse proxy HTTPS devant le serveur
(Caddy, Traefik, nginx) et mettez `HAMAC_SECURE=1`. Une sauvegarde exportée de l'application de bureau
(Paramètres › Application) se restaure telle quelle sur l'instance web, et inversement.

| Variable | Défaut | Rôle |
|---|---|---|
| `HAMAC_DATA_DIR` | `/data` | Comptes + une base par utilisateur |
| `HAMAC_PORT` | `8080` | Port d'écoute |
| `HAMAC_SIGNUP` | `invite` | `invite`, `open` ou `closed` |
| `HAMAC_SECURE` | `0` | `1` derrière HTTPS (cookies sécurisés) |
| `HAMAC_PRICES` | `1` | `0` pour ne pas actualiser les cours automatiquement |

Sécurité : mots de passe hachés (scrypt), sessions en cookie `HttpOnly` + `SameSite=Strict`, en-tête anti-CSRF,
limitation des tentatives de connexion, en-têtes CSP et anti-iframe.

## Développement

Prérequis : Node.js ≥ 22.13 (24 recommandé) et pnpm 9.

```bash
pnpm install
pnpm dev          # interface avec rechargement à chaud + fenêtre Electron
pnpm test         # tests (Vitest)
pnpm typecheck    # vérification des types
pnpm dist         # installateur pour l'OS courant (apps/desktop/release)
pnpm server:build && HAMAC_DATA_DIR=./data pnpm server:start   # mode web
HAMAC_LIVE=1 pnpm test   # inclut les tests sur les vraies sources de cours
```

### Architecture

```
apps/
  desktop/    Electron : fenêtre, pont IPC, base SQLite locale
  server/     serveur web auto-hébergé (Hono) : comptes, une base SQLite par utilisateur
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
| `HAMAC_DEMO=1` | Remplit une base vide avec un jeu de données fictif |

## Licence

[GNU AGPL v3](LICENSE). Toute version modifiée mise à disposition, y compris via un serveur, doit publier son code source.
