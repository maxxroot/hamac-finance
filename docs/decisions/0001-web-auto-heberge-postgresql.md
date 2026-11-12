# 0001. Une application web auto-hébergée sur PostgreSQL, un tenant isolé par compte

- Statut : acceptée
- Date : 2026-11-08 (rédigée le 2026-11-12)

## Contexte

Hamac est né comme une application de bureau (Electron, SQLite) reconstruite à partir d'un tableur personnel. Il devait ensuite servir à un cercle privé, avec une base de cours partagée et, peut-être un jour, une instance publique. Garder deux produits (bureau et serveur) doublait le travail.

## Décision

Un seul produit : une application web auto-hébergée, installée par `docker compose up -d --build`, sur PostgreSQL. Chaque compte est un tenant isolé : son propre schéma `t_<hex>` et un rôle PostgreSQL `hamac_t_<hex>` sans droit de connexion, propriétaire de ce schéma. Les comptes de l'instance (schéma `comptes`) et les cours (schéma `marche`) ne sont pas accessibles aux rôles des tenants.

La dernière version de bureau est gardée au tag git `derniere-version-desktop`.

## Conséquences

- Les requêtes d'un tenant utilisent des noms de tables sans schéma ; `enterTenant` (`packages/backend/src/db/postgres.ts`) place la connexion dans le bon schéma, avec le bon rôle.
- Les migrations s'appliquent à chaque tenant à son ouverture.
- Le serveur ne renvoie jamais un chemin de son système de fichiers à l'interface.
- Le serveur est livré en fichiers uniques sans `node_modules` : pas de module natif.
