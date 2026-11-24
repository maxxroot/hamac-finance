# Décisions

Une décision d'architecture par fichier, numérotée, avec son contexte et ses conséquences. Une décision ne se modifie pas : si elle change, une nouvelle la remplace et l'ancienne passe au statut « remplacée ».

Les décisions 0001 à 0005 sont rétroactives : elles ont été rédigées le 2026-11-12 pour consigner des choix déjà faits et appliqués dans le code.

| N° | Décision | Statut |
|---|---|---|
| [0001](0001-web-auto-heberge-postgresql.md) | Une application web auto-hébergée sur PostgreSQL, un tenant isolé par compte | Acceptée |
| [0002](0002-calculs-dans-l-interface.md) | Les calculs tournent dans l'interface, le backend stocke | Acceptée |
| [0003](0003-montants-en-centimes.md) | Centimes entiers en base, euros dans le domaine, taux en fractions | Acceptée |
| [0004](0004-base-de-cours-commune.md) | Une base de cours commune à l'instance | Acceptée |
| [0005](0005-cle-twelve-data-dans-env.md) | La clé Twelve Data ne vit que dans `.env` | Acceptée |
| [0006](0006-code-par-couches-et-domaines.md) | Le code est rangé par couche puis par domaine, frontières vérifiées par un test | Acceptée |
| [0007](0007-documentation-guide-et-technique.md) | Chaque fonctionnalité a un guide et une documentation technique | Acceptée |
| [0008](0008-versions-et-journal-des-modifications.md) | Versions sémantiques, tags `vX.Y.Z` et journal des modifications tenu à la main | Acceptée |
| [0009](0009-serveur-mcp-et-jetons-d-acces.md) | Un serveur MCP dans le serveur web, ouvert par des jetons d'accès | Acceptée |
| [0010](0010-devises-du-titre-et-taux-bce.md) | La devise appartient au titre, les opérations restent en euros, taux de la BCE | Acceptée |
