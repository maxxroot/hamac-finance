# Assistants : piloter Hamac depuis un LLM (MCP)

Document de travail ouvert le 15 novembre 2026. L'objectif est qu'un assistant conversationnel (Claude, ou tout client compatible avec le [Model Context Protocol](https://modelcontextprotocol.io)) puisse **lire le patrimoine et y importer des opérations**, à partir de n'importe quel document : relevé PDF d'un assureur, avis d'opéré d'un courtier, export CSV, tableau copié-collé.

Le principe : **l'assistant lit, Hamac décide**. Le modèle convertit un document de forme quelconque en lignes d'opérations. Hamac les compare au journal, les valide avec les règles de `@hamac/core` (`validateTransaction`, détection des doublons de `buildImport`) et n'écrit rien sans un aperçu accepté par l'utilisateur. On couvre ainsi tous les établissements sans écrire un module d'import par établissement.

## Décisions prises le 15 novembre 2026

| Sujet | Décision |
|-------|----------|
| Transport | HTTP (« Streamable HTTP » du protocole), sans état, sur `/api/mcp` du serveur Hamac. Pas de programme à installer sur le poste : on branche l'assistant sur l'instance. |
| Emplacement du code | `apps/server/src/mcp/`, couche entre `auth/` et `http/` ([décision 0009](../decisions/0009-serveur-mcp-et-jetons-d-acces.md)). Le MCP ne passe que par `Backend.dispatch`, comme l'interface. |
| Accès | Jetons personnels créés dans Paramètres › Application, rattachés à un compte (donc à un seul tenant), en **lecture** ou **lecture et écriture**, avec une date d'expiration. Seule leur empreinte est stockée. |
| Écriture | Toujours en deux temps : `prepare_import` renvoie un aperçu, `apply_import` applique cet aperçu-là et seulement lui. Une importation appliquée peut être annulée (`undo_import`) tant que le serveur n'a pas redémarré. |
| Calculs | Le serveur MCP appelle le moteur pur de `@hamac/core` (`computePortfolio`, `computeAlerts`) sur `workspace.load` : l'assistant reçoit des encours calculés, pas des données brutes à interpréter. |
| Fichiers | L'assistant lit lui-même les PDF et les images. Un fichier CSV, OFX ou QIF peut être transmis tel quel : Hamac le lit avec ses propres analyseurs, plus fiables qu'une recopie ligne à ligne. |
| Confidentialité | Rien n'est activé par défaut pour un utilisateur : sans jeton, aucun accès. L'administrateur peut couper le MCP pour toute l'instance (`HAMAC_MCP=0`). Le guide dit clairement que les données lues par l'assistant partent chez son fournisseur. |
| Noms | Noms d'outils en anglais (règle du code), descriptions en français. |

## Pourquoi

La saisie est ce qui fait abandonner un outil de suivi. Hamac sait déjà importer des relevés CSV, OFX et QIF et l'export Bricks, mais chaque nouveau format demande du code, et les PDF des assureurs ne s'importent pas. Un assistant sait lire ces documents ; il lui manque un accès sûr à Hamac, avec les règles de l'application pour arbitrer.

## Ce qui existe déjà

- **Le contrat** : chaque procédure a ses schémas zod (`packages/api/src/contract.ts`), validés en entrée et en sortie par `Backend.dispatch`.
- **L'import de relevés** (`packages/core/src/imports/statementImport.ts`) : lecture CSV (rôle des colonnes deviné), OFX (banque et titres), QIF ; `buildImport` devine le type d'opération, retrouve le titre par ISIN ou par nom, signale doublons, versements déjà comptés par le calendrier et lignes invalides.
- **L'import groupé** : `transactions.bulkCreate`, tout ou rien pour les lignes valides.
- **Les relevés de situation** (`statements`) et le rapprochement entre encours calculé et encours relevé.
- **Les alertes** (`packages/core/src/alerts/alerts.ts`) : incohérences du journal, cours en échec, livrets, allocation, gestion locative…

---

## 1. Jetons d'accès et outils de lecture

**Statut :** fait le 15 novembre 2026.

- Table `comptes.api_tokens` : nom, portée (`read` ou `write`), empreinte SHA-256, création, expiration (30, 90 ou 365 jours), dernière utilisation. Dix jetons au plus par compte. Format `hamac_` suivi de 43 caractères, reconnaissable par les détecteurs de secrets.
- Création depuis une session ouverte, **avec le mot de passe** ; le jeton n'est affiché qu'une fois. Révocation depuis la même carte. Changer de mot de passe, activer la double authentification ou la faire réinitialiser par l'administrateur révoque tous les jetons du compte, comme les sessions.
- Route `/api/mcp` : jeton dans l'en-tête `Authorization: Bearer`, jamais de cookie ; même règle HTTPS que le reste de l'API ; une requête qui annonce une autre origine est refusée ; 120 requêtes par minute et par jeton.
- Outils : `get_summary`, `list_accounts`, `get_account`, `list_assets`, `list_transactions`, `check_data`.

## 2. Import en deux temps

**Statut :** fait le 15 novembre 2026.

- `prepare_import` : un compte et soit des lignes (date, montant signé, libellé, et au besoin type, ISIN, nom du titre, identifiant du titre, quantité, frais), soit le texte d'un fichier CSV, OFX ou QIF. Réponse : un identifiant d'aperçu et, ligne par ligne, le type retenu, le titre reconnu et le statut (`ok`, `doublon`, `programme`, `erreur`) avec la raison.
- `apply_import` : applique les lignes `ok` de l'aperçu, plus celles que l'utilisateur veut garder malgré un doublon apparent (`include`), moins celles qu'il écarte (`exclude`). Le journal est relu : si les statuts ont changé depuis l'aperçu, rien n'est écrit et il faut refaire l'aperçu.
- `undo_import` : supprime les opérations créées par une importation appliquée dans les dernières 24 heures.
- `create_asset` : ajoute un titre inconnu (ETF, action, fonds, crypto, SCPI), après accord de l'utilisateur. Renvoie le titre existant si l'ISIN est déjà connu.
- `record_statement` : enregistre l'encours d'un relevé de situation, pour que `check_data` le compare au calcul.
- Modification de `@hamac/core` : une ligne de relevé peut imposer son type et son titre (`StatementLine.type`, `StatementLine.assetId`), au lieu de les laisser deviner.
- `transactions.bulkCreate` renvoie aussi les identifiants créés (pour l'annulation).

## 3. Ressources et scénarios (à faire)

- Servir les guides de `docs/` comme ressources MCP, pour que l'assistant connaisse le vocabulaire et les règles (enveloppe, support, fonds euros, PER assurantiel ou bancaire).
- Scénarios prêts à l'emploi (« prompts » du protocole) : rapprocher un relevé de situation, faire le bilan du mois, préparer l'aide à la déclaration.

## 4. Saisie assistée sur les autres domaines (à faire)

Gestion locative (encaissements pointés depuis un relevé bancaire, quittances), crédits (tableau d'amortissement), autres biens, valeurs de rachat des contrats. Même règle : aperçu, puis application.

**Question ouverte :** faut-il un aperçu générique (une liste d'appels de procédures validés à blanc), ou un outil par domaine ? Un outil par domaine est plus simple à décrire au modèle.

## 5. Connecteurs claude.ai (à faire)

Les connecteurs distants de claude.ai demandent une autorisation OAuth 2.1 : serveur d'autorisation (ou délégation), découverte (`/.well-known/oauth-protected-resource`), écran de consentement dans Hamac. À étudier après l'usage avec Claude Code et Claude Desktop, qui acceptent un jeton dans un en-tête.

## Limites connues

- Les aperçus et les importations annulables sont gardés en mémoire du serveur : un redémarrage les perd (une heure de validité pour un aperçu, 24 heures pour annuler).
- Le modèle peut mal lire un document. L'aperçu, la validation de `core` et l'accord de l'utilisateur limitent le risque ; ils ne le suppriment pas.
- Un document importé peut contenir des consignes cachées destinées au modèle (injection). Aucun outil n'écrit sans aperçu, et les clients MCP demandent l'accord de l'utilisateur avant chaque appel d'outil d'écriture.
