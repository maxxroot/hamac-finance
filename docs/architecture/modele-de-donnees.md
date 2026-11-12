# Modèle de données

Hamac reprend la logique d'un Google Sheet de plan d'épargne retraite, en corrigeant ses limites structurelles.

## Vocabulaire

Ces termes ont un sens précis, dans l'interface comme dans le code :

- **Enveloppe** : le cadre fiscal et juridique, c'est-à-dire un type de compte (livret réglementé, assurance-vie, PEA, PEA-PME, compte-titres, PER, épargne salariale). Les plateformes crypto et de crowdlending ne sont pas des enveloppes : ce sont des placements détenus en direct (`isEnvelope`).
- **Compte** ou **contrat** : une enveloppe précise ouverte chez un établissement, ou une plateforme (Binance, une plateforme de crowdlending). On dit « contrat » pour l'assurance-vie et le PER, « compte » pour le reste (`accountNoun`).
- **Support** ou **placement** : ce qu'on met dans un compte (fonds euros, ETF, action, obligation, crypto…). Le fonds euros est un support d'un contrat, jamais une enveloppe.
- **Classe d'actifs** : le regroupement des supports pour l'allocation cible.

## Entités

| Entité | Rôle | Remarques |
|---|---|---|
| **Compte** (`accounts`) | Un contenant avec ses propres espèces : livret, assurance-vie, PEA, compte-titres, plateforme crypto. | Nombre illimité. Un livret porte son type (LEP, LDDS, Livret A…), son taux et son plafond. Un PER est assurantiel ou bancaire (`per_kind`) : bancaire, c'est un compte-titres, sans fonds euros, garanti comme tel, dont les espèces comptent en actions. Les espèces de l'épargne salariale comptent aussi en actions, comme celles d'un PEA. Un contrat d'assurance-vie ou de PER assurantiel a un fonds euros par défaut (`default_asset_id`) : l'argent du contrat sans support précisé y va (versements, versements programmés, intérêts, frais, achats et ventes d'unités de compte). |
| **Titre** (`assets`) | Un support : ETF, action, obligation, crypto, fonds, SCPI, fonds euros. | Identifié par ISIN quand il existe. Une obligation porte son coupon, son échéance et sa fréquence. Source du cours : automatique, manuelle ou calculée (obligation détenue à l'échéance). Un fonds euros (`fonds_euros`) n'a pas de cours : une part vaut 1 €, sa quantité et son prix de revient suivent les euros qui y entrent et en sortent ; il appartient à l'assureur et peut servir à plusieurs contrats. Un ETF peut renvoyer à un ETF physique équivalent (`composition_isin`) dont la composition sert à l'exposition réelle ; les compositions elles-mêmes sont communes à l'instance (`marche.compositions`). |
| **Opération** (`transactions`) | Un mouvement daté dans un compte. | Types : apport initial, versement, retrait, intérêts/coupon, dividende, achat, vente, arbitrage, transfert, frais, impôts, correction. Un arbitrage passe d'un support à un autre du même compte (assurance-vie, PER, épargne salariale, crypto) sans espèces : support cédé (`asset_id`, `quantity`), support reçu (`counter_asset_id`, `counter_quantity`), `amount` = valeur de l'échange ; ce n'est pas une cession imposable. Dans un contrat, un mouvement d'argent peut viser un fonds euros (`asset_id`), et un transfert son fonds d'arrivée (`counter_asset_id`). |
| **Montant d'un document fiscal** (`tax_statement_amounts`) | Montant lu sur le document d'un établissement, par année et par case. | Sert à comparer le récapitulatif fiscal au document reçu. |
| **Versement programmé** (`contribution_plans`) | « À partir du mois M, X €/mois sur ce compte. » 0 = arrêt. | Un seul plan par compte et par mois ; le dernier démarré s'applique. |
| **Mois manqué** (`contribution_skips`) | Montant non versé un mois donné. | Déduit du versement prévu, sans passer sous zéro. |
| **Ligne prévue d'obligations** (`bond_plans`) | Obligation à acheter plus tard (échéance visée, nominal). | Devient un achat réel dans le journal. |
| **Taux servi** (`fund_rates`) | Taux d'un fonds euros dans un contrat, par année. | Par contrat et par fonds : un taux peut être bonifié selon le contrat. |
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
