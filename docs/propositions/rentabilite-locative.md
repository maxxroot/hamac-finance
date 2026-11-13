# Rentabilité locative : savoir où en est chaque bien

Document de travail ouvert le 13 novembre 2026. L'objectif est que la page d'un bien en location réponde d'abord à une question : **ce bien me coûte-t-il ou me rapporte-t-il de l'argent chaque mois, après crédit, charges et impôts ?** Puis : combien il m'a coûté au total, combien il m'a rapporté, et ce que j'y ai gagné.

Ce chantier prolonge la [gestion locative](gestion-locative.md). Il y reprend la part récupérable des dépenses (prévue dans sa tranche 4) et la fiscalité locative, qui y était repoussée « au chantier suivant ».

Comme pour les autres propositions, les règles légales et les montants cités sont **à vérifier sur la source officielle au moment du développement** (CGI, BOFiP, service-public.gouv.fr, impots.gouv.fr), avec la source citée dans `@hamac/core`, la date de vérification et des tests chiffrés.

## Décisions prises le 13 novembre 2026

| Sujet | Décision |
|-------|----------|
| Méthode | Une tranche à la fois, un commit par tranche, sur la branche `rentabilite-locative`. |
| Taxe foncière | Estimée à 1,3 fois le loyer mensuel hors charges par an tant que le montant réel n'est pas saisi. Le montant saisi la remplace. La taxe d'enlèvement des ordures ménagères (TEOM), comprise dans l'avis, est récupérée sur le locataire. |
| Charges de copropriété | On saisit le montant total prévu et la part récupérable en pourcentage, deux tiers par défaut. |
| Impôts sur les loyers | Prévus dans ce chantier : micro-foncier, réel foncier, LMNP au micro-BIC et LMNP au réel, chacun avec ses règles (abattements, charges déductibles, déficit, amortissements, frais comptables). |
| Cashflow | Réel et prévu côte à côte, le réel mis en avant. |
| Emplacement | Un onglet « Rentabilité », en premier pour un bien en location (avant « Location » et « Finances »). |
| Provisions | Vacance locative et travaux : un pourcentage du loyer ou un montant fixe par an, choisi par l'utilisateur. |

## Ce qui existe déjà

Au 13 novembre 2026 :

- **Achat et coût** (`core/src/realestate/realestate.ts`) : prix, frais de notaire et d'agence, travaux à l'achat, autres frais (`propertyTotalCost`), travaux d'amélioration ajoutés au coût (`propertyImprovements`), synthèse à la part détenue (`propertySummary` : valeur, coût, gain, valeur nette).
- **Crédits** (`core/src/loans/`) : échéancier avec intérêts et assurance (`loanSchedule`, `loanYears`), part à charge, remboursements anticipés, coût restant et taux assurance comprise (`loanCost`).
- **Dépenses et recettes** (`core/src/realestate/rental.ts`) : catégories (taxe foncière, copropriété, assurance, gestion, travaux, autre), dépenses répétées chaque année, recettes hors loyer (régularisations, indemnités).
- **Loyers** : baux, nouveaux loyers datés, encaissements pointés (`rentLedgerOf`), lots et mode de location (vide, meublé, colocation).
- **Résultats par année** (`propertyYears`, carte en bas de l'onglet Finances) : loyers et charges reçus, autres recettes, dépenses, intérêts, assurance, capital remboursé, « ce qu'il reste » (cashflow réel avant impôt), rendement brut et net, occupation. `propertyProfitability` en tire une synthèse pour la fiche du bien.
- **Réglages fiscaux** (`PlanParams.tax`) : tranche marginale d'imposition, taux des prélèvements sociaux, `socialRateFor` (`core/src/tax/fiscalRules.ts`).

Ce qui manque : les quatre chiffres en tête de la page ignorent la location (le gain estimé ne compte ni loyers, ni crédit, ni dépenses) ; aucun cashflow mensuel n'est mis en avant ; la taxe foncière ne compte que saisie ; la part des charges qui reste au propriétaire n'apparaît nulle part ; aucun impôt n'est estimé.

## Tranche 0. Part récupérable des dépenses

**Statut :** faite le 13 novembre 2026 (migration 0031). Décisions prises en codant : seules la copropriété, la taxe foncière (sa TEOM) et « autre dépense » peuvent avoir une part récupérable ; « ce qu'il reste » des résultats par année ne change pas (c'est le cash réel, où les provisions reçues couvrent la part récupérable) ; l'écart entre provisions et charges récupérables sera montré dans l'onglet Rentabilité (tranche 1).

**Pourquoi.** Le propriétaire paie toute la copropriété et toute la taxe foncière, puis en récupère une partie sur le locataire (provisions, TEOM). Sans cette répartition, on ne connaît ni ce qui reste vraiment à sa charge, ni l'écart avec les provisions reçues, ni les charges déductibles au réel.

**Ce qu'on ajoute.**

- Sur chaque dépense, une **part récupérable** en pourcentage (colonne `recoverable_rate` de `property_expenses`). Saisie en pourcentage, ou en montant pour la TEOM de la taxe foncière, converti en pourcentage.
- Valeur proposée selon la catégorie : copropriété deux tiers (réglable dans Paramètres › Plan), les autres 0 %. Les dépenses existantes reçoivent cette valeur à la migration.
- Dans `propertyYears` : dépenses récupérables et reste à charge séparés. « Ce qu'il reste » ne change pas (c'est le cash réel). On voit en plus l'écart entre provisions reçues et charges récupérables, soit la régularisation à prévoir.
- Carte « Dépenses » : colonne « À votre charge ».

**Règle à vérifier.** Liste des charges récupérables : décret n° 87-713 du 26 août 1987. TEOM récupérable sur le locataire.

## Tranche 1. Hypothèses du bien et cashflow mensuel

**Statut :** faite le 13 novembre 2026 (migration 0032). Valeurs choisies par l'utilisateur : vacance 4 % et travaux 5 % du loyer hors charges, neutre à ±2 % du loyer. Décisions prises en codant : le réel compte les 12 derniers mois complets (le mois en cours n'est pas encore pointé) ; le prévu prend, par catégorie, les dépenses « chaque année » en cours, sinon ce qui a été payé sur 12 mois ; les travaux réels sont remplacés par la provision dans le prévu ; ni améliorations ni remboursements anticipés dans le réel ; régularisation des charges supposée exacte dans le prévu, l'écart avec les provisions du bail est affiché à part.

**Pourquoi.** C'est le chiffre qui dit si le bien est en cashflow positif, neutre ou négatif.

**Ce qu'on ajoute.**

- **Hypothèses du bien** (réglables sur le bien, valeurs proposées dans Paramètres › Plan) : provision pour vacance locative et provision pour travaux, chacune en pourcentage du loyer hors charges ou en montant fixe par an ; taxe foncière estimée (1,3 mois de loyer hors charges, remplacée par le dernier montant saisi).
- **Cashflow réel**, mis en avant : sur les 12 derniers mois, loyers et charges encaissés, autres recettes, moins dépenses payées et échéances de crédit (assurance comprise), à la part détenue.
- **Cashflow prévu** : par mois, d'après la situation actuelle :
  - loyer hors charges en cours de chaque lot (loyer espéré pour un lot vide) et provisions de charges ;
  - moins les charges : copropriété, taxe foncière hors TEOM, assurance du propriétaire, gestion ;
  - moins les provisions pour vacance et travaux ;
  - moins la mensualité et l'assurance du crédit.

  Chaque poste est affiché, et l'écart avec le réel est expliqué.
- **Badge** positif, neutre ou négatif.
- **Onglet « Rentabilité »**, en premier pour un bien en location. Les cartes des tranches suivantes s'y ajoutent.

## Tranche 2. Bilan depuis l'achat

**Statut :** faite le 13 novembre 2026. Décisions prises en codant : l'apport inclut les travaux d'amélioration (ils ne comptent donc pas aussi dans les dépenses) ; il peut être négatif si le crédit dépasse le coût ; les remboursements anticipés et leurs indemnités comptent dans les échéances payées ; pour un bien vendu, la valeur nette est ce qu'il reste de la vente après frais et crédit.

**Pourquoi.** Savoir ce que le bien a réellement coûté de sa poche, et ce qu'il a fait gagner.

**Ce qu'on ajoute.**

- **Sorti de votre poche** : apport (coût d'achat complet moins capital emprunté), échéances payées (capital, intérêts, assurance), dépenses payées, impôts estimés (après la tranche 4).
- **Rentré** : loyers, charges et autres recettes encaissés.
- **Effort net** = sorti − rentré, et effort moyen par mois.
- **Enrichissement** = valeur nette d'aujourd'hui (valeur détenue − capital restant dû) − effort net.
- Pour un bien en location, les quatre chiffres en tête deviennent : valeur nette, cashflow réel par mois, effort net depuis l'achat, enrichissement.

## Tranche 3. Coût complet

**Statut :** faite le 13 novembre 2026. Décision prise en codant : les rendements sont ceux d'une année type, d'après le cashflow prévu (loyers en cours, charges et provisions), affichés sur le coût d'achat et sur le coût total crédit compris.

**Pourquoi.** Le coût d'un bien acheté à crédit comprend le crédit.

**Ce qu'on ajoute.**

- **Coût de revient** : achat, frais, travaux d'amélioration, plus intérêts et assurance du crédit, payés à ce jour et total prévu jusqu'à la fin du crédit.
- **Rendements** sur ce coût : brut, net de charges, puis net après impôt (après la tranche 4).

## Tranche 4. Impôts sur les loyers

**Statut :** faite le 13 novembre 2026. Décisions prises en codant : régime par groupe du foyer (vide, meublé), réglé dans Paramètres ; un bien est meublé si son mode l'est ou si son dernier bail est meublé, étudiant ou mobilité ; impôt à la tranche marginale, sur l'année civile, régime d'aujourd'hui pour toutes les années ; assurance de l'emprunt traitée comme les intérêts dans le déficit foncier (prudent, à vérifier) ; régularisations de charges hors des recettes foncières ; composants d'amortissement proposés (gros œuvre 50 %/50 ans, toiture et façades 15 %/25 ans, installations 20 %/20 ans, agencements 15 %/12 ans, améliorations 10 ans) et terrain à 15 %, réglable ; l'impôt d'un groupe est réparti entre ses biens au prorata de leur résultat ; l'impôt de la dernière année complète, divisé par 12, entre dans le cashflow. Non faits : déficit majoré pour rénovation énergétique, meublés de tourisme, LMP, SCI à l'IS, dispositifs de défiscalisation, mobilier distinct, repères pour la déclaration (à relier au Récapitulatif fiscal plus tard).

**Pourquoi.** Le cashflow qui compte est celui qui reste après impôt, et le régime change beaucoup le résultat.

**Ce qu'on ajoute.**

- **Le régime**. La location vide relève du micro-foncier ou du réel foncier ; la location meublée relève du LMNP, au micro-BIC ou au réel. Le régime vaut pour tout le foyer (tous les biens loués vides ensemble, tous les meublés ensemble), pas pour un seul bien : il se règle dans Paramètres, et Hamac signale un régime impossible (plafond dépassé, mode de location incompatible).
- **Micro-foncier** : abattement de 30 % si les loyers bruts du foyer ne dépassent pas 15 000 € par an. Pas de déficit.
- **Réel foncier** : charges déductibles (intérêts, assurance emprunteur, taxe foncière hors TEOM, copropriété non récupérable, assurance du propriétaire, gestion, travaux d'entretien, de réparation et d'amélioration, frais de gestion forfaitaires par local). Déficit imputable sur le revenu global jusqu'à 10 700 € par an hors intérêts, et 21 400 € pour une rénovation énergétique (jusqu'au 31 décembre 2027 selon la loi de finances 2026). Le reste se reporte sur les revenus fonciers des 10 années suivantes. Le bien doit rester loué jusqu'au 31 décembre de la troisième année.
- **LMNP au micro-BIC** : abattement de 50 % jusqu'à 77 700 € de recettes (revenus 2025), puis 83 600 € (revenus 2026). Meublé de tourisme non classé : 30 % jusqu'à 15 000 € (loi Le Meur).
- **LMNP au réel** :
  - amortissement par composant : terrain non amortissable ; gros œuvre, toiture, installations et agencements, mobilier, chacun sur sa durée ; frais d'acquisition déduits ou amortis. Durées proposées, réglables.
  - L'amortissement ne peut pas créer de déficit (CGI art. 39 C) : l'excédent se reporte sans limite.
  - Charges déductibles, dont les **frais comptables** et l'adhésion à un organisme de gestion agréé.
  - Déficit imputable sur les revenus de même nature pendant 10 ans.
  - Amortissements réintégrés dans la plus-value à la revente (CGI art. 150 VB, depuis la loi de finances 2025).
- **Prélèvements sociaux** : 17,2 % sur les revenus fonciers, 18,6 % sur les revenus de LMNP depuis la LFSS 2026 (CSS art. L136-8). À brancher sur `socialRateFor`.
- **Impôt sur le revenu** : à la tranche marginale d'imposition des réglages (une approximation, signalée dans l'interface).
- **Ce qu'on obtient** :
  - l'impôt estimé par bien et par an (réparti au prorata quand le régime porte sur plusieurs biens) ;
  - le cashflow après impôt, dans les tranches 1 à 3 ;
  - la comparaison des régimes possibles pour ce bien ;
  - les repères pour la déclaration (2044, cases 4BE ou 5ND), en lien avec le Récapitulatif fiscal.

**Hors de cette tranche.** SCI à l'impôt sur les sociétés ; LMP (loueur professionnel) ; dispositifs de défiscalisation (Pinel, Denormandie, Loc'Avantages). Ils sont signalés comme non pris en compte.

## Tranche 5. Projection et revente

**Statut :** faite le 13 novembre 2026. Décisions prises en codant : hausses par défaut +1,5 % des loyers, +2 % des charges, +1 % de la valeur (réglables) ; projection depuis le mois type du cashflow prévu, jusqu'à la fin du crédit (au moins 10 ans, au plus 30) ; impôt du bien estimé seul, avec ses reports ; revente au 31 décembre, net vendeur, sans frais ; barème actuel des abattements (22 et 30 ans), la réforme discutée pour 2026 n'étant pas confirmée.

**Pourquoi.** Un cashflow négatif pendant le crédit peut cacher un très bon investissement, et l'inverse.

**Ce qu'on ajoute.**

- **Le bien année par année** jusqu'à la fin du crédit et au-delà, avec des hypothèses réglables : hausse des loyers (IRL), des charges et de la valeur. On y suit cashflow après impôt, capital restant dû et valeur nette.
- **Revente à une date choisie** : plus-value immobilière avec les abattements pour durée de détention (exonération d'impôt après 22 ans, de prélèvements sociaux après 30 ans), taux de 19 % plus prélèvements sociaux, surtaxe au-delà de 50 000 € de plus-value, réintégration des amortissements LMNP. On en tire le rendement global (taux de rendement interne) de l'opération.

## Questions encore ouvertes

1. ~~Provisions par défaut~~ : 4 % pour la vacance, 5 % pour les travaux (décidé le 13 novembre 2026).
2. ~~Seuil du cashflow « neutre »~~ : ±2 % du loyer hors charges (décidé le 13 novembre 2026).
3. ~~Régime fiscal du foyer~~ : un pour la location vide, un pour la location meublée, comme la règle fiscale (appliqué le 13 novembre 2026, à confirmer par l'utilisateur).
4. **Composants et durées d'amortissement** du LMNP au réel : valeurs proposées en tranche 4, à valider par l'utilisateur.

## Ordre proposé

0 → 1 → 2 → 3 → 4 → 5. La tranche 4 est la plus lourde. Elle peut se couper en deux : location vide d'abord, puis location meublée.
