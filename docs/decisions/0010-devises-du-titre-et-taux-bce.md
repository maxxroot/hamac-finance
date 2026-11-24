# 0010. La devise appartient au titre, les opérations restent en euros, taux de la BCE

- Statut : acceptée
- Date : 2026-11-24

## Contexte

Jusqu'ici, tout était en euros : les sources de cours refusaient une cotation dans une autre devise, et le nominal d'une obligation était en euros par convention. Un épargnant peut pourtant détenir une obligation du Trésor américain, une action suisse ou un ETF coté en livres. Son courtier (Trade Republic, Boursorama…) débite des euros à l'achat et crédite des euros à chaque coupon et au remboursement, au taux de change du jour.

Il fallait choisir où porter la devise, en quoi enregistrer les montants des opérations, et d'où viennent les taux.

## Décision

**La devise appartient au titre** (`assets.currency`, ISO 4217, `EUR` par défaut). Le cours du titre, et le nominal et le coupon d'une obligation, sont dans cette devise. Les comptes n'ont pas de devise : leurs espèces sont en euros.

**Les opérations restent en euros.** `amount`, `fee`, `accrued`, `gross` et les retenues sont les euros débités ou crédités, comme avant. Une opération sur un titre en devise peut porter le taux appliqué par l'établissement (`transactions.fx_rate`). Ce taux est exprimé en unités de la devise pour 1 €. Sans lui, on prend le taux BCE du jour. Ainsi, les soldes, les versements, le récapitulatif fiscal et le registre des cessions ne changent pas. La plus-value se calcule en euros aux taux des deux dates, comme le veut la loi française (CGI, art. 150-0 D ; CE, 13 septembre 2021, n° 443914).

**Les taux sont ceux de référence de la BCE**, téléchargés par l'API publique du portail de données de la BCE (sans clé). Ils sont communs à l'instance, dans `marche.fx_rates`, sur le modèle de la [base de cours commune](0004-base-de-cours-commune.md). Seules les devises dont la BCE publie un taux sont acceptées. Le taux saisi sur une opération l'emporte sur celui de la BCE.

**Le moteur valorise dans la devise, puis convertit.** Le cours ou la valeur amortie d'une obligation se calculent dans la devise du titre. La valeur est convertie au taux BCE du jour. Le remboursement d'une obligation est converti au taux du jour de l'échéance. Chaque position garde son prix de revient en euros historiques et dans la devise, d'où l'effet de change.

## Conséquences

- `Workspace.fxRates` apporte au navigateur les taux nécessaires, chaque jour publié depuis la première opération concernée. Comme pour les cours, aucune requête externe ne part de l'interface. La procédure `market.fxRate` sert la première saisie dans une devise encore sans taux.
- Un compte ne peut pas garder un solde en devise. Le jour où ce besoin viendra (courtier multidevise), il faudra des espèces par devise dans un compte. Cette décision ne l'empêche pas : les opérations en euros resteraient valables pour les comptes qui convertissent.
- Un titre en euros garde sa clé d'instrument dans la base de cours commune. Un titre en devise ajoute sa devise à la clé.
- Les fonds euros et les cryptos restent en euros.
