# 0009. Un serveur MCP dans le serveur web, ouvert par des jetons d'accès

- Statut : acceptée
- Date : 2026-11-15

## Contexte

On veut qu'un assistant conversationnel puisse lire le patrimoine d'un utilisateur et y importer des opérations à partir de documents de forme quelconque (voir la [proposition](../propositions/assistants-mcp.md)). Le [Model Context Protocol](https://modelcontextprotocol.io) est le standard ouvert que comprennent Claude Code, Claude Desktop et d'autres clients : un serveur y déclare des outils (nom, description, schéma des paramètres), le client les appelle pour le compte du modèle.

Trois questions se posaient : où vit ce serveur, comment l'assistant s'authentifie, et comment il écrit sans affaiblir les garanties de l'interface (validation, isolation des tenants, règles de `core`).

## Décision

**Emplacement.** Le serveur MCP est une couche de `apps/server` : `auth/` → `mcp/` → `http/`. `http/app.ts` expose la route `/api/mcp` et lui passe l'utilisateur et le backend de son tenant. `mcp/` n'accède aux données que par `Backend.dispatch`, exactement comme l'interface : même validation zod en entrée et en sortie, même file d'appels, même tenant. Il n'importe ni `db` ni `repo`.

**Calculs.** Par exception à la [décision 0002](0002-calculs-dans-l-interface.md), le serveur exécute le moteur de `@hamac/core` (`computePortfolio`, `computeAlerts`, `buildImport`) pour les outils MCP. Le moteur reste pur et unique : ce sont les mêmes fonctions que l'interface, appelées sur le même `workspace.load`. Le backend, lui, continue de ne rien calculer.

**Transport.** Le « Streamable HTTP » du protocole, en mode sans état et avec réponses JSON : chaque requête crée son serveur MCP et son transport, et rien ne dépend d'une session MCP. On utilise le SDK officiel `@modelcontextprotocol/sdk` (JavaScript pur, intégré au fichier unique par tsup), avec son transport fondé sur les API standard du Web (`Request`, `Response`), branché directement sur Hono.

**Authentification.** Des jetons d'accès personnels, table `comptes.api_tokens` :

- créés depuis une session ouverte (donc après la double authentification), avec le mot de passe du compte ;
- rattachés à un compte, donc à un seul tenant ; portée `read` ou `write` ; expiration obligatoire ;
- seule l'empreinte SHA-256 est stockée, comme pour les sessions : un jeton a 256 bits d'aléa, une empreinte lente n'apporterait rien ;
- envoyés dans `Authorization: Bearer`, jamais dans un cookie : la route n'est donc pas exposée aux requêtes intersites, et n'a pas besoin de l'en-tête anti-CSRF ;
- révoqués avec les sessions : changement de mot de passe, activation de la double authentification, réinitialisation par l'administrateur.

**Écriture.** Aucun outil n'écrit directement à partir d'un document. L'import passe par un aperçu (`prepare_import`), gardé en mémoire et rattaché au tenant, puis par son application (`apply_import`), qui relit le journal et refuse si l'aperçu n'est plus à jour.

**Coupure.** `HAMAC_MCP=0` désactive la route et la création de jetons pour toute l'instance.

## Conséquences

- Nouvelle dépendance d'exécution de `apps/server` : `@modelcontextprotocol/sdk`, version figée. Ses dépendances Express ne sont pas importées, donc pas intégrées au fichier.
- La table des couches de `packages/architecture/src/server.test.ts` devient `auth` 0, `mcp` 1, `cli` 1, `http` 2.
- Un nouvel outil MCP qui écrit doit suivre la même règle : aperçu, puis application.
- Les connecteurs de claude.ai, qui exigent OAuth 2.1, ne sont pas couverts par les jetons : ce sera une décision séparée.
- Les données lues par l'assistant quittent l'instance vers le fournisseur du modèle. C'est le choix de l'utilisateur qui crée un jeton, et le guide le dit.
