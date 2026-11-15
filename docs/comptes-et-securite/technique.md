# Comptes et sécurité : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| server | `apps/server/src/http/app.ts` | Hono : en-têtes de sécurité et CSP, HTTPS obligatoire hors machine locale, limites de taille, routes `/api/auth/*`, `/api/rpc/:name`, limiteurs de tentatives, `BackendPool`, fichiers statiques. |
| server | `apps/server/src/auth/users.ts` | `UserStore` : schéma `comptes`, comptes, sessions, invitations, lignes de double authentification, `sameSecret`. |
| server | `apps/server/src/auth/password.ts` | `PasswordHasher` : Argon2id (hash-wasm), format PHC, conversion des anciennes empreintes scrypt. |
| server | `apps/server/src/auth/totp.ts` | TOTP (RFC 6238) et HOTP (RFC 4226), base32, `matchTotp`, `otpauthUri`. |
| server | `apps/server/src/auth/twoFactor.ts` | `TwoFactor` (activation, vérification, codes de secours) et `ChallengeStore` (étape entre mot de passe et code). |
| server | `apps/server/src/auth/twoFactorKey.ts` | `loadTwoFactorKey`, `parseKey`, `SecretBox` (AES-256-GCM, HMAC des codes de secours). |
| server | `apps/server/src/cli.ts` | Point d'entrée des commandes (`node cli.mjs …`). |
| server | `apps/server/src/cli/commands.ts` | `runCommand` : `invite`, `users`, `password`, `2fa-reset`. |
| server | `apps/server/src/main.ts` | Lecture de l'environnement : `HAMAC_SIGNUP`, `HAMAC_SECURE`, `HAMAC_ALLOW_HTTP`, `HAMAC_TRUST_PROXY`, `HAMAC_SESSION_DAYS`, `HAMAC_2FA_KEY`, `HAMAC_DATA_DIR`, `HAMAC_PORT`, `HAMAC_HOST`. |
| server | `apps/server/src/env.ts` | `intFromEnv`, `databaseUrl`. |
| backend | `packages/backend/src/db/postgres.ts` | `tenantNames`, `enterTenant` : schéma `t_<hex>` et rôle `hamac_t_<hex>`. |
| backend | `packages/backend/src/index.ts` | `createBackend` (entrée dans le tenant), `dispatch`. |
| backend | `packages/backend/src/context.ts` | `BackendContext.isAdmin`. |
| ui | `packages/ui/src/app/layout/AuthGate.tsx` | Écrans de connexion, d'inscription, de première connexion et du code. |
| ui | `packages/ui/src/app/layout/Shell.tsx` | Déconnexion, bandeau et fenêtre de rappel. |
| ui | `packages/ui/src/app/components/TwoFactorNudge.tsx` | Bandeau et fenêtre « Protégez votre compte ». |
| ui | `packages/ui/src/features/settings/lib/auth.ts` | Client `/api/auth/*` (en-tête `X-Hamac: 1`), `AuthError`, types `Me`, `TwoFactorStatus`. |
| ui | `packages/ui/src/features/settings/lib/twoFactor.ts` | Logique d'affichage testable : `twoFactorNudge`, `NUDGE_TEXT`, mise en forme des codes, fichier des codes de secours. |
| ui | `packages/ui/src/features/settings/lib/qr.ts` | Dessin du QR code dans le navigateur. |
| ui | `packages/ui/src/features/settings/lib/account.tsx` | `AccountContext`, `useAccount`. |
| ui | `packages/ui/src/features/settings/components/PasswordCard.tsx`, `TwoFactorCard.tsx` | Cartes de Paramètres › Application. |
| ui | `packages/ui/src/shared/lib/transport.ts` | `POST /api/rpc/<nom>` avec `X-Hamac: 1` ; un 401 ou 403 déclenche `hamac:unauthorized`. |
| ui | `packages/ui/index.html` | CSP en balise `meta` (à garder alignée sur `apps/server/src/http/app.ts`). |

## Données

**Schéma `comptes`** (créé par `UserStore.open` avec la connexion d'administration ; aucun droit pour les rôles des tenants) :

| Table | Colonnes principales |
|---|---|
| `comptes.tenants` | `id` (UUID), `created_at` |
| `comptes.users` | `id`, `tenant_id` (unique), `email` (unique, en minuscules), `password_hash`, `is_admin`, `created_at` |
| `comptes.sessions` | `token_hash` (SHA-256 du jeton, base64url), `user_id`, `expires_at` |
| `comptes.invites` | `code`, `expires_at`, `used_by` |
| `comptes.two_factor` | `user_id`, `secret` (scellé `v1.<iv>.<données>.<tag>`), `confirmed_at` (nul : activation en cours), `last_step`, `created_at` |
| `comptes.recovery_codes` | `user_id`, `code_hash` (HMAC) |
| `comptes.api_tokens` | jetons d'accès des assistants : voir [Assistants (MCP)](../assistants-mcp/technique.md) |

**Tenants** : schéma `t_<hex>` et rôle `hamac_t_<hex>` (`NOLOGIN`), où `<hex>` est l'UUID du tenant sans tirets. Seul un UUID est accepté dans un nom SQL (`tenantNames`).

**Routes HTTP**

| Route | Méthode | Session | Rôle |
|---|---|---|---|
| `/api/auth/config` | GET | non | `{ signup, firstUser }` |
| `/api/auth/me` | GET | oui | `{ email, isAdmin, twoFactor: { enabled, available, recoveryCodesLeft } }` |
| `/api/auth/login` | POST | non | Mot de passe ; renvoie un défi si la double authentification est active. |
| `/api/auth/login/code` | POST | non | Défi + code TOTP ou de secours ; ouvre la session. |
| `/api/auth/signup` | POST | non | Premier compte (code d'installation) ou inscription selon `HAMAC_SIGNUP`. |
| `/api/auth/logout` | POST | oui | Supprime la session. |
| `/api/auth/password` | POST | oui | Change le mot de passe. |
| `/api/auth/2fa/setup`, `/confirm`, `/disable`, `/recovery-codes` | POST | oui | Gestion de la double authentification. |
| `/api/rpc/:name` | POST | oui | `Backend.dispatch` du tenant de l'utilisateur. |
| `/api/auth/tokens`, `/api/auth/tokens/revoke`, `/api/mcp` | GET, POST | session ou jeton | Jetons d'accès et serveur MCP : voir [Assistants (MCP)](../assistants-mcp/technique.md). |

Toutes les routes POST exigent l'en-tête `X-Hamac: 1`, sauf `/api/mcp`, qui ne lit aucun cookie et exige un jeton dans `Authorization`.

**Réglages** (`.env`, voir `.env.example`) : `HAMAC_SIGNUP` (`invite` par défaut, `open`, `closed`), `HAMAC_SESSION_DAYS` (30), `HAMAC_SECURE`, `HAMAC_ALLOW_HTTP`, `HAMAC_TRUST_PROXY`, `HAMAC_2FA_KEY`, `HAMAC_MCP`, `HAMAC_DB_PASSWORD`, `HAMAC_BIND`, `HAMAC_PORT`.

**Mémoire** : `HAMAC_MEMORY` et `HAMAC_DB_MEMORY` deviennent le `mem_limit` des services `hamac` et `db` de `docker-compose.yml` (`0` par défaut : pas de limite). Le code ne les lit pas. Node 24 dimensionne son tas d'après la limite du conteneur (environ 560 Mio pour `1g`) ; sous 512m, le tas peut atteindre la limite avant que le ramasse-miettes ne se déclenche, d'où le minimum conseillé. Un conteneur qui dépasse sa limite est tué par le noyau et relancé par `restart: unless-stopped`.

## Règles

**Inscription et administrateur**

- Instance neuve : un code d'installation aléatoire (`randomBytes(12)`, base64url) est écrit dans les journaux ; il est exigé pour le premier compte et comparé à temps constant (`sameSecret`). Un drapeau `installing` empêche deux premières inscriptions simultanées.
- Le premier compte reçoit `is_admin = true` (`createUser` : `count() === 0`). Le drapeau est passé à `createBackend` (`isAdmin`) et sert à `market.configure`, à `exposure.admin` et `exposure.adminLink`.
- Ensuite : `closed` refuse, `invite` exige un code valide, consommé dans la même requête SQL que la création du compte (`createInvitedUser`), `open` accepte.
- Contrôles : `isEmail` (forme minimale, sans expression régulière), mot de passe d'au moins 10 caractères, e-mail unique (409).

**Mots de passe et sessions**

- Argon2id, paramètres OWASP : 46 Mio (`memorySize: 47104`), 1 passe, 1 fil, sel de 16 octets, empreinte de 32 octets, format PHC. Une empreinte aux anciens paramètres ou en scrypt est recalculée à la connexion suivante.
- `checkPassword` vérifie une empreinte leurre quand le compte n'existe pas : même réponse, même coût.
- Jeton de session : 32 octets aléatoires ; seule l'empreinte SHA-256 est stockée. Cookie `hamac_session`, ou `__Host-hamac_session` en HTTPS ; `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS, `Path=/`, expiration à `HAMAC_SESSION_DAYS`.
- Changer de mot de passe (interface ou `cli.mjs password`) supprime toutes les sessions du compte ; l'interface en rouvre une pour l'appareil courant.
- Purge horaire des sessions expirées et des activations de double authentification non confirmées depuis plus de 30 minutes.

**Limitation des tentatives** (`RateLimiter`, fenêtre de 15 minutes, en mémoire)

- 10 par adresse IP pour `login`, `code`, `signup` ; 10 par compte pour `password` et `2fa` ; 20 par e-mail visé pour `login` ; 10 par compte pour les codes (`codeLimiter`, jamais remis à zéro par le mot de passe).
- L'adresse IP vient de `X-Forwarded-For` (dernière entrée) seulement si `HAMAC_TRUST_PROXY=1`.
- Défi de double authentification (`ChallengeStore`, en mémoire) : un par compte, 5 minutes, 5 essais ; changer de mot de passe l'annule.

**Double authentification**

- TOTP : SHA-1, 6 chiffres, pas de 30 s, un pas de tolérance de chaque côté, secret de 160 bits. Un pas n'est accepté que s'il est postérieur à `last_step`, mis à jour de façon atomique (`acceptTotpStep`).
- Activation : mot de passe, puis secret et adresse `otpauth://` renvoyés ; confirmation par un premier code dans les 30 minutes, qui crée 10 codes de secours (alphabet sans 0/O ni 1/I/L, forme `XXXX-XXXX`) et ferme les sessions du compte, en une requête.
- Désactivation et nouveaux codes : mot de passe vérifié d'abord, puis un code (6 chiffres → TOTP, sinon code de secours).
- Clé : `HAMAC_2FA_KEY` (32 octets en base64 ou hexadécimal), sinon `<dataDir>/2fa.key`, créé en `0600` au premier lancement. Une variable invalide n'est pas remplacée par le fichier. Sans clé utilisable, le serveur démarre quand même : `available = false`, et un compte protégé reçoit une réponse 503 à la connexion.
- `SecretBox` dérive deux sous-clés par HKDF-SHA256 : AES-256-GCM pour le secret, avec l'identifiant du compte en données associées ; HMAC-SHA256 pour les codes de secours. Au démarrage, le nombre de secrets illisibles avec la clé actuelle est écrit dans les journaux.

**Isolement des tenants**

- `enterTenant` : `RESET ROLE`, création au besoin du rôle `NOLOGIN` et du schéma dont il est propriétaire, `GRANT` du rôle à l'utilisateur de connexion, puis `SET ROLE` et `SET search_path`. Les requêtes du tenant utilisent des noms de table non qualifiés.
- `UserStore.open` exécute `REVOKE ALL ON SCHEMA public FROM PUBLIC`. Les schémas `comptes` et `marche` appartiennent à l'utilisateur de connexion ; aucun droit n'y est accordé aux rôles des tenants.
- Un `BackendPool` garde un backend et une connexion PostgreSQL par tenant, ouverts à la demande et fermés après 15 minutes sans appel.
- Seuls `UserStore` et `SharedMarket` (connexion d'administration) lisent `comptes` et `marche`. `SharedMarket.collect` lit aussi les titres de chaque schéma de tenant pour actualiser les cours communs.

**Requêtes et en-têtes**

- Anti-CSRF : toute route POST exige `X-Hamac: 1`, en plus du cookie `SameSite=Strict`. Sans lui, réponse 403.
- HTTPS : hors `localhost`, `127.0.0.1` et `[::1]`, toute route `/api/*` sauf `/api/auth/config` est refusée en HTTP simple (403), sauf `HAMAC_ALLOW_HTTP=1`. HTTPS est reconnu par `HAMAC_SECURE=1`, par `X-Forwarded-Proto` (dernière entrée) si `HAMAC_TRUST_PROXY=1`, ou par le protocole de la requête.
- Taille des corps : 16 Kio pour `/api/auth/*`, 32 Mio pour `/api/rpc/*`.
- En-têtes sur toutes les réponses : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy` et `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` (caméra, micro, géolocalisation, paiement désactivés), `Strict-Transport-Security: max-age=31536000` en HTTPS (sans sous-domaines), `Cache-Control: no-store` sur `/api/`.
- CSP du serveur : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://data.geopf.fr; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'`. La CSP de `packages/ui/index.html` est la même, sans `frame-ancestors` (sans effet dans une balise `meta`) et avec `ws://localhost:5173` pour le serveur de développement.
- Les journaux et les réponses ne contiennent ni la clé de double authentification ni le secret TOTP d'un compte (sauf la réponse de `/api/auth/2fa/setup`, qui le renvoie une fois pour l'application). Le code d'installation, lui, est écrit dans les journaux à dessein.

**Commandes en ligne** (`node cli.mjs`, dans Docker : `docker compose exec hamac node cli.mjs …`)

| Commande | Effet |
|---|---|
| `invite [jours]` | Crée un code d'invitation (7 jours par défaut, 9 octets aléatoires en base64url). |
| `users` | Liste e-mail et date de création. |
| `password <e-mail>` | Demande un nouveau mot de passe (10 caractères minimum), ferme les sessions. |
| `2fa-reset <e-mail>` | Supprime la double authentification du compte (ligne et codes de secours) et ferme ses sessions. |

Les commandes ouvrent leur propre connexion (`DATABASE_URL`) et passent par `UserStore`.

## Tests

- `apps/server/src/http/app.test.ts` : forme de l'e-mail ; HTTPS (refus du HTTP hors machine, cookie `__Host-` et HSTS derrière le proxy, `X-Forwarded-Proto` ignoré sans proxy de confiance, HTTP local) ; code d'installation à usage unique ; conversion scrypt → Argon2id ; invitation obligatoire et à usage unique ; limites de tentatives par IP et par compte ; isolement des bases ; refus sans session et sans `X-Hamac` ; connexion, déconnexion, changement de mot de passe ; limites de taille ; inscriptions simultanées.
- `apps/server/src/auth/password.test.ts`, `totp.test.ts` (vecteurs des RFC 6238 et 4226), `twoFactorKey.test.ts`, `twoFactor.test.ts`.
- `packages/backend/src/db/postgres.test.ts` : « n'accepte qu'un UUID comme tenant », « isole les tenants : ni les données d'un autre, ni les comptes de l'instance ».
- `packages/backend/src/market/market.test.ts` : « seul l'administrateur règle les sources ».
- `packages/ui/src/features/settings/lib/twoFactor.test.ts`, `qr.test.ts`.
- `packages/ui/src/app/compte.flow.test.tsx` (jsdom) : parcours de connexion, d'inscription et de double authentification.

## Limites connues

- Les limiteurs de tentatives et les défis de double authentification sont en mémoire : un redémarrage les remet à zéro.
- Le code d'installation est régénéré à chaque démarrage tant qu'aucun compte n'existe ; `ServerConfig.setupCode` permet de le fixer, mais `main.ts` ne le lit dans aucune variable d'environnement.
- Aucune commande ne supprime un compte, ne liste les invitations ni ne change `is_admin`. `users` n'affiche pas le rôle ni l'identifiant du tenant.
- Le test d'isolement de `postgres.test.ts` vérifie l'accès refusé à `comptes` et au schéma d'un autre tenant, pas explicitement à `marche`.
- Le commentaire de `apps/server/src/main.ts` ne liste pas `HAMAC_TRUST_PROXY` ni `HAMAC_HOST`, pourtant lus par ce fichier.
- La CSP autorise `https://data.geopf.fr` (recherche d'adresse de `packages/ui/src/features/realestate/lib/addressSearch.ts`) : c'est la seule requête que le navigateur fait hors de l'instance.
