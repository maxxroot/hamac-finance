# Assistants (MCP) : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi ça sert

Un assistant conversationnel comme Claude peut se brancher sur votre Hamac. Vous pouvez alors :

- **lui confier vos relevés à importer** : PDF d'un assureur, avis d'opéré d'un courtier, export CSV de votre banque, capture d'écran. Il lit le document, Hamac compare chaque ligne à votre journal et vous montre ce qui sera ajouté. Rien n'est écrit sans votre accord ;
- **lui poser des questions** : « combien ai-je versé sur mon PER depuis 2023 ? », « quelle est ma plus-value latente sur le PEA ? », « qu'est-ce qui cloche dans mes données ? » ;
- **vérifier un relevé de situation** : il compare l'encours que vous a envoyé votre assureur à celui que calcule Hamac, et cherche l'opération manquante.

Les chiffres viennent toujours de Hamac : l'assistant cite les encours, les versements nets et les plus-values que calcule l'application, avec les mêmes règles que les écrans.

Le branchement utilise le [Model Context Protocol](https://modelcontextprotocol.io) (MCP), un standard ouvert. Claude Code et Claude Desktop le comprennent, comme d'autres assistants.

## Avant de commencer : vos données

Ce que l'assistant lit dans Hamac (comptes, opérations, montants) est envoyé au fournisseur du modèle (par exemple Anthropic pour Claude), comme tout ce que vous écrivez dans la conversation. Ne créez un jeton que si vous l'acceptez. Sans jeton, aucun assistant n'a accès à rien.

## Ce que vous y voyez

### Paramètres › Application › Assistants (MCP)

- **Créer un jeton** : un nom (pour le reconnaître), l'accès, la durée et votre mot de passe.
  - *Lecture seule* : l'assistant consulte, il ne peut rien modifier.
  - *Lecture et import* : il peut aussi préparer des imports, les appliquer après votre accord, créer un titre et enregistrer un relevé de situation.
  - *Durée* : 30 jours, 90 jours ou 1 an. Le jeton cesse ensuite de fonctionner.
- **Le jeton créé** s'affiche **une seule fois**, avec la commande toute prête pour Claude Code et une configuration pour les autres assistants. Hamac n'en garde qu'une empreinte : s'il est perdu, révoquez-le et créez-en un autre.
- **La liste des jetons** : nom, accès, date d'expiration, dernière utilisation, et le bouton **Révoquer**.

Si la carte indique que les assistants sont désactivés, c'est un choix de la personne qui administre l'instance.

## Comment faire

### Brancher Claude Code

1. Créez un jeton dans Paramètres › Application › Assistants (MCP).
2. Copiez la commande affichée et lancez-la dans un terminal. Elle ressemble à :

   ```
   claude mcp add --transport http hamac https://votre-hamac.exemple.fr/api/mcp --header "Authorization: Bearer hamac_…"
   ```

3. Dans Claude Code, tapez `/mcp` : « hamac » doit apparaître comme connecté.

### Brancher un autre assistant

Utilisez la configuration JSON affichée à la création du jeton : l'adresse est `https://votre-hamac/api/mcp`, et le jeton va dans l'en-tête `Authorization: Bearer …`. Les connecteurs de claude.ai (dans le navigateur) demandent une autre méthode d'autorisation, pas encore proposée.

### Importer un relevé

1. Donnez le document à l'assistant et dites sur quel compte il porte : « importe ce relevé dans mon assurance-vie Linxea ».
2. L'assistant prépare l'import et vous montre l'aperçu : les opérations nouvelles, celles déjà présentes au journal (doublons), les versements déjà comptés par vos versements programmés, et les lignes refusées avec leur raison.
3. Si un titre est inconnu de Hamac, l'assistant vous propose de le créer.
4. Donnez votre accord : l'assistant applique l'import. Vous pouvez lui demander de garder une ligne marquée comme doublon, ou d'en écarter une.
5. Une erreur ? Demandez-lui d'annuler l'import : c'est possible pendant 24 heures, tant que le serveur n'a pas redémarré. Sinon, supprimez les opérations depuis le Journal.

Pour un fichier CSV, OFX ou QIF, l'assistant transmet le fichier tel quel et Hamac le lit lui-même, comme dans la fenêtre d'import du Journal. Pour un PDF ou une image, c'est l'assistant qui lit le document : vérifiez l'aperçu.

### Révoquer un jeton

Paramètres › Application › Assistants (MCP), bouton **Révoquer** puis **Confirmer la révocation**. L'assistant perd l'accès immédiatement. Changer de mot de passe, activer la double authentification ou la faire réinitialiser révoque aussi **tous** vos jetons.

### Couper les assistants sur toute l'instance (administration)

Ajoutez `HAMAC_MCP=0` dans le fichier `.env`, puis `docker compose up -d`. Plus aucun jeton ne fonctionne et la carte l'indique.

## Ce que veulent dire les chiffres

- **Statuts de l'aperçu** : *ok* (nouvelle opération), *doublon* (même date, même type, même montant et même titre qu'une opération du journal, ou transfert déjà saisi), *programme* (versement égal au versement programmé de ce mois, déjà compté), *erreur* (date ou montant illisible, type non permis sur ce compte, titre inconnu…).
- **Écart d'un relevé de situation** : encours du relevé moins encours calculé par Hamac à la même date. Pour une date passée, Hamac utilise le dernier cours connu du mois : un petit écart en milieu de mois peut venir du cours, pas d'une opération manquante.

## Limites

- Un aperçu reste valable une heure. Si le journal change entre l'aperçu et l'application (par exemple une saisie dans l'interface), l'assistant doit refaire l'aperçu.
- L'assistant peut mal lire un PDF. Hamac vérifie la cohérence de chaque opération, pas qu'elle correspond au document : relisez l'aperçu.
- Un document peut contenir du texte caché destiné à tromper l'assistant. Hamac n'écrit jamais rien sans aperçu, et votre assistant vous demande votre accord avant chaque outil qui modifie vos données. Gardez cette demande d'accord activée.
- Pour l'instant, l'assistant ne saisit que des opérations sur les comptes et les supports, des titres et des relevés de situation. L'immobilier, la gestion locative et les crédits viendront ensuite.
