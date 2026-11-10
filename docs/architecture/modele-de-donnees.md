# Modèle de données

Hamac reprend la logique d'un Google Sheet de plan d'épargne retraite, en corrigeant ses limites structurelles.

## Entités

| Entité | Rôle | Remarques |
|---|---|---|
| **Compte** (`accounts`) | Un contenant avec ses propres espèces : livret, assurance-vie, PEA, compte-titres, plateforme crypto. | Nombre illimité. Un livret porte son type (LEP, LDDS, Livret A…), son taux et son plafond. Les espèces d'une assurance-vie représentent le fonds euros. |
| **Titre** (`assets`) | Ce qu'on achète : ETF, action, obligation, crypto, fonds. | Identifié par ISIN quand il existe. Une obligation porte son coupon, son échéance et sa fréquence. Source du cours : automatique, manuelle ou calculée (obligation détenue à l'échéance). |
| **Opération** (`transactions`) | Un mouvement daté dans un compte. | Types : apport initial, versement, retrait, intérêts/coupon, dividende, achat, vente, transfert, frais, impôts, correction. |
| **Montant d'un document fiscal** (`tax_statement_amounts`) | Montant lu sur le document d'un établissement, par année et par case. | Sert à comparer le récapitulatif fiscal au document reçu. |
| **Versement programmé** (`contribution_plans`) | « À partir du mois M, X €/mois sur ce compte. » 0 = arrêt. | Un seul plan par compte et par mois ; le dernier démarré s'applique. |
| **Mois manqué** (`contribution_skips`) | Montant non versé un mois donné. | Déduit du versement prévu, sans passer sous zéro. |
| **Ligne prévue d'obligations** (`bond_plans`) | Obligation à acheter plus tard (échéance visée, nominal). | Devient un achat réel dans le journal. |
| **Taux servi** (`fund_rates`) | Taux du fonds euros par année. | |
| **Relevé** (`statements`) | Valeur relevée chez l'établissement, pour le rapprochement. | L'écart se corrige par une opération « Correction ». |
| **Cours** (`prices`) | Historique des cours par titre et par jour. | |
| **Dépense prévue** (`planned_expenses`) | Dépense future (voiture, travaux…) pour la projection. | |
| **Paramètres** (`settings`, clé `plan.parameters`) | Profil, hypothèses, allocation, fiscalité, seuils. | JSON validé par `PlanParams` (zod) dans `@hamac/core`. |

## Conventions

- Identifiants : UUID texte, stables (jamais un nom comme clé de jointure).
- Montants : centimes entiers en base (`*_cents`), euros décimaux dans le code métier.
- Dates `AAAA-MM-JJ`, mois `AAAA-MM`.
- Sens des montants : toujours positifs, le type d'opération donne le sens. Seule la correction peut être négative.
- Achat : montant = total débité frais compris ; vente : montant = net reçu. Les frais inclus sont stockés (pré-remplis d'après la grille des paramètres, modifiables).
- Obligation : quantité = nominal en euros ; prix d'achat en % du nominal = (montant − frais) / nominal × 100.
- Transfert : une seule opération, compte source → compte de destination.

- Dividende ou intérêts : `amount` reste le net crédité. `gross` et les retenues (`withheld_income_tax`, `withheld_social`, `withheld_foreign`) sont facultatifs. Exception : une plateforme de crowdlending qui prélève les impôts les débite par une opération à part ; la ligne d'intérêts porte alors `amount` = `gross`, ses retenues, et une ligne « impôts » suit pour ce qui est prélevé.

## Récapitulatif fiscal

Calculé dans `@hamac/core` (`buildTaxReport`) : un seul calcul, une fiche par établissement et un récapitulatif complet.

- La case « Hamac rédige le récapitulatif » de l'établissement (`institutions.tax`) rend ses lignes *à saisir*. Sans elle, elles sont *à contrôler* avec son IFU.
- Brut d'un revenu : celui saisi, sinon les taux de retenue. Chaque taux vient de l'établissement s'il en a un, sinon de Paramètres › Plan pour l'année du revenu (vide = défaut, 0 = rien n'est retenu).
- Les cases et les taux sont datés par année de revenus dans `fiscalRules.ts`, avec leur source et leur date de vérification. Une année absente est affichée comme non vérifiée.
- Plus-values : prix de revient au coût moyen du compte, compensation entre établissements, moins-values reportables dix ans. La crypto se calcule sur le portefeuille global (art. 150 VH bis).

## Écarts volontaires avec le sheet

| Sheet | Hamac | Pourquoi |
|---|---|---|
| Nom d'ETF tapé = clé de jointure | Identifiants | Un espace en trop cassait silencieusement les sommes. |
| « Nouv. vers. mens. » daté d'un jour | Versement programmé par mois | Une déclaration du 06/11 ne comptait qu'en décembre, et la projection ignorait le plan. |
| Transfert en deux lignes | Une opération | Plus de paire déséquilibrée possible. |
| Achats d'OAT dans un onglet à part | Achats dans le journal, coupons et remboursement calculés | Un seul endroit pour tout saisir ; ventes avant l'échéance possibles. |
| 3 livrets, 4 ETF, 1 crypto au maximum | Illimité | |
| Cours manuel prioritaire pour la crypto, secondaire pour les ETF | Règle unique : un cours manuel récent l'emporte | Cohérence. |

## Validation

Les règles métier d'une opération (titre compatible avec le compte, quantité requise, transfert vers un autre compte…) sont dans `@hamac/core` (`validateTransaction`) et s'appliquent à l'identique dans le formulaire et dans le backend.
