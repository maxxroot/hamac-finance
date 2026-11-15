# Assistants (MCP) : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi ça sert

Un assistant conversationnel comme Claude peut se brancher sur votre Hamac. Vous pouvez alors :

- **lui confier la tenue de votre patrimoine** : créer un établissement, ouvrir un compte et l'y rattacher, ajouter un titre, saisir ou corriger une opération, régler un versement programmé, un taux de livret ou le taux servi d'un fonds euros. Il vous dit ce qu'il va enregistrer et attend votre accord ;
- **lui confier vos relevés à importer** : PDF d'un assureur, avis d'opéré d'un courtier, export CSV de votre banque, capture d'écran. Il lit le document, Hamac compare chaque ligne à votre journal et vous montre ce qui sera ajouté. Rien n'est écrit sans votre accord ;
- **lui poser des questions** : « combien ai-je versé sur mon PER depuis 2023 ? », « quelle est ma plus-value latente sur le PEA ? », « qu'est-ce qui cloche dans mes données ? » ;
- **préparer vos impôts** : il vous donne les cases à reporter sur la déclaration, compare l'IFU de chaque établissement aux calculs de Hamac, estime ce qui reste à payer et passe en revue ce qui peut encore réduire l'impôt avant le 31 décembre ;
- **vérifier un relevé de situation** : il compare l'encours que vous a envoyé votre assureur à celui que calcule Hamac, et cherche l'opération manquante.

Les chiffres viennent toujours de Hamac : l'assistant cite les encours, les versements nets et les plus-values que calcule l'application, avec les mêmes règles que les écrans.

Ce que l'assistant enregistre apparaît dans Hamac sans recharger la page : l'application vérifie quand vous revenez sur son onglet, et toutes les 20 secondes tant qu'il est affiché. Vous pouvez donc tout faire faire à l'assistant et ne garder Hamac ouvert que pour lire les graphiques.

Le branchement utilise le [Model Context Protocol](https://modelcontextprotocol.io) (MCP), un standard ouvert. Claude Code et Claude Desktop le comprennent, comme d'autres assistants.

## Avant de commencer : vos données

Ce que l'assistant lit dans Hamac (comptes, opérations, montants) est envoyé au fournisseur du modèle (par exemple Anthropic pour Claude), comme tout ce que vous écrivez dans la conversation. Ne créez un jeton que si vous l'acceptez. Sans jeton, aucun assistant n'a accès à rien.

## Ce que vous y voyez

### Paramètres › Application › Assistants (MCP)

- **Créer un jeton** : un nom (pour le reconnaître), l'accès, la durée et votre mot de passe.
  - *Lecture seule* : l'assistant consulte, il ne peut rien modifier.
  - *Lecture et écriture* : il peut aussi créer et modifier vos établissements, comptes, titres et opérations, importer des relevés et supprimer, toujours après votre accord.
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

### Organiser vos comptes

Parlez à l'assistant comme à quelqu'un qui tient vos comptes :

- « Ajoute le courtier Bourse Direct, et rattache-lui mon PEA. »
- « Ouvre une assurance-vie chez Linxea ouverte le 3 mars 2021. » Une assurance-vie ou un PER assurantiel reçoit son fonds euros, comme dans l'interface.
- « Le LEP passe à 2,7 % au 1er février. » ; « Le fonds euros de mon assurance-vie a servi 2,5 % en 2025. »
- « Je verse 200 € par mois sur le PEA à partir de mars ; je n'ai pas versé en avril. »
- « Mon versement du 5 janvier était de 550 €, pas de 500. »

Pour une modification, l'assistant ne change que ce que vous demandez : le reste de la fiche est gardé. Hamac applique les mêmes règles que les écrans (un seul PEA par personne, une obligation demande son taux et son échéance…) et l'assistant vous dit pourquoi une saisie est refusée.

### Préparer votre déclaration

Dans Claude Code ou Claude Desktop, choisissez le scénario **Préparer ma déclaration de revenus** proposé par Hamac (dans Claude Code : tapez `/` et cherchez « hamac »), ou demandez simplement « prépare ma déclaration pour les revenus 2025 ». L'assistant :

1. contrôle vos données et vous signale ce qui fausserait les montants (achat manquant, compte sans établissement) ;
2. vous demande l'IFU de chaque établissement, le lit et vous montre, case par case, l'écart avec le calcul de Hamac. Un écart vient souvent d'une opération manquante ou d'un montant brut mal saisi : il vous propose la correction ;
3. avec votre accord, enregistre les montants de l'IFU dans Hamac (ils remplacent ceux déjà saisis pour cet établissement et cette année) ;
4. vous donne les cases à reporter, en distinguant celles à saisir de celles à vérifier sur la déclaration préremplie, puis l'impôt restant à payer.

Le scénario **Bilan fiscal de fin d'année** liste ce qui peut encore être fait avant le 31 décembre (moins-values, assurance-vie, PER, plafonds, dispense d'acompte à demander avant le 30 novembre), chiffré. L'assistant ne fait aucune opération à votre place.

Les montants sont ceux des pages **Impôts** et **Aide à la déclaration**, avec les mêmes règles et les mêmes limites ; ils restent une aide, et vous restez responsable de votre déclaration. L'assistant lit vos paramètres fiscaux (tranche marginale, taux) sans pouvoir les modifier : changez-les dans Paramètres › Plan › Fiscalité.

### Supprimer

1. Demandez : « supprime l'opération du 5 janvier ».
2. L'assistant vous montre ce qui disparaîtra, et ce qui part ou se détache avec : relevés de situation d'un compte, comptes d'un établissement (ils restent, sans établissement)… Rien n'est supprimé à cette étape.
3. Confirmez : la suppression est faite. La confirmation ne vaut qu'une fois, pendant 15 minutes.

Un compte ou un titre qui a des opérations ne se supprime pas : l'assistant vous propose de l'**archiver**, ce qui le retire des listes en gardant son historique. Une suppression ne s'annule pas ; seule une sauvegarde permet de revenir en arrière.

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
- Pour l'instant, l'assistant gère les établissements, les comptes, les titres, le journal, les relevés de situation et la fiscalité de l'épargne. L'immobilier (et sa fiscalité), la gestion locative, les crédits et les autres biens viendront ensuite ; en attendant, ils se saisissent dans l'interface. Les paramètres du plan et de la fiscalité ne se modifient pas depuis l'assistant.
