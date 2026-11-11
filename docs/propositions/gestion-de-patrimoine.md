# Propositions pour le format « gestion de patrimoine »

Document de travail, ouvert le 11 novembre 2026. Il garde la trace de douze propositions discutées pour le format gestion de patrimoine (`profile.goal = "patrimoine"`), à développer une par une. La plupart servent aussi au format préparation de retraite, mais elles sont pensées pour le premier.

Chaque proposition indique son statut, ce qui existe déjà dans Hamac, ce qu'il faut ajouter et les questions à trancher avant de coder. Les montants et règles légales cités sont **à vérifier sur la source officielle au moment du développement**, comme pour toute règle de `@hamac/core` (source citée, date de vérification, tests chiffrés).

## Déjà en place

Sur la branche `patrimoine`, au 11 novembre 2026 :

- **Protection en cas de faillite (proposition 1)** : carte sur la Synthèse, part garantie et non garantie par établissement garant, alerte au-delà d'un plafond, champs « Établissement garant » et « Pays » sur la fiche de l'établissement.
- **Qui possède quoi (proposition 3)** : usufruit et nue-propriété d'un bien immobilier au barème fiscal, sociétés (SCI) avec la part des parts détenue, part détenue sur les comptes joints.
- **Rapprochement avec les relevés (proposition 12 a)** : page « Rapprochement » (groupe Saisie), relevé avec valeur, espèces et quantités, comparé au calcul à sa date, correction en un clic, rappel au-delà de 12 mois sans relevé.
- **Poids des crédits (proposition 8)** : sur la page Crédits, part du patrimoine financée à crédit, part de chaque bien encore due, taux d'effort, taux assurance comprise et coût restant de chaque crédit, et comparateur « rembourser par avance ou placer ».
- **Compteurs et plafonds (proposition 9)** : page « Compteurs et plafonds » (groupe Fiscalité) : ancienneté du PEA et des assurances-vie, plafonds du PEA, du PEA-PME, des livrets et du PER, abattement annuel de l'assurance-vie, versements avant et après 70 ans, donations faites et reçues avec leurs abattements.
- **Liste de fin d'année (proposition 10)** : repliée en bas de la page Impôts, moins-values à réaliser, abattement de l'assurance-vie, versement PER, plafonds libres et préparation de la déclaration, chiffrés, avec une case par geste ; alerte au tableau de bord en novembre et décembre.
- **Autres biens (proposition 4)** : page « Autres biens », en dernier des enveloppes ; or, objets, véhicules, parts de société (démembrables), compte courant d'associé et argent prêté, avec décote, délai de vente et impôt estimé à la vente.

Le détail, les décisions prises et ce qui reste hors de chaque version sont dans la section de chaque proposition.

## Suivi

| N° | Proposition | Statut |
|----|-------------|--------|
| 1 | Ce qui est protégé si un établissement fait faillite | Fait le 11 novembre 2026 (commit `bd14015`) |
| 2 | Calcul de l'IFI | Reporté |
| 3 | Qui possède quoi | Fait le 11 novembre 2026 (commit `c92ceb0`) |
| 4 | Biens qui ne sont pas des placements | Fait le 11 novembre 2026, sans les actions de l'employeur (commit `adc3eb5`) |
| 5 | Exposition réelle derrière les ETF | À étudier : faisabilité des données incertaine |
| 6 | Concentration et risque | À faire, à détailler |
| 7 | Disponibilité de l'argent | À faire, sous forme d'option |
| 8 | Poids des crédits et aide à la décision | Fait le 11 novembre 2026 |
| 9 | Compteurs d'ancienneté et plafonds | Fait le 11 novembre 2026 |
| 10 | Liste de fin d'année | Fait le 11 novembre 2026 |
| 11 | Objectifs par projet | À faire |
| 12 | Rapprochement avec les relevés et journal des décisions | 12 a fait le 11 novembre 2026 ; 12 b à faire |

---

## 1. Ce qui est protégé si un établissement fait faillite

**Statut :** fait le 11 novembre 2026. Calcul dans `core/src/protection.ts`, carte sur la Synthèse, alerte dans « À regarder », champs « Établissement garant » et « Pays » sur la fiche de l'établissement. Décisions : la carte va sur la Synthèse ; l'établissement garant est un champ libre (avec les noms déjà saisis proposés) ; pour l'assurance-vie, l'assureur de l'offre fait foi ; l'épargne salariale est classée à part (fonds détenus hors de l'établissement) ; dans un autre pays de l'Union européenne, 100 000 € sur les dépôts et au moins 20 000 € sur les titres (minimum européen de la directive 97/9/CE, à confirmer sur une source officielle).

**Pourquoi.** Personne ne regarde combien il a chez un même établissement par rapport aux garanties légales. Une alerte comme « 140 000 € chez le même assureur, dont 70 000 € non garantis » prévient un vrai risque, sans rien demander de plus à l'utilisateur que ce qu'il saisit déjà.

**Ce qui existe.** Chaque compte est rattaché à un établissement (`accounts.institution_id`), et chaque établissement a un type : banque, courtier, assureur, crowdlending, crypto (`INSTITUTION_KINDS`).

**Règles à vérifier :**

| Ce qui est détenu | Garantie | Plafond | Source |
|---|---|---|---|
| Dépôts : comptes courants, livrets non réglementés, espèces des PEA et comptes-titres | FGDR, garantie des dépôts | 100 000 € par personne et par établissement | Code monétaire et financier, art. L312-4 et suivants ; fgdr.fr |
| Livret A, LDDS, LEP | FGDR, plafond distinct qui s'ajoute au précédent | 100 000 € | fgdr.fr |
| Titres (actions, ETF, obligations) qui ne pourraient pas être restitués | FGDR, garantie des titres | 70 000 € par personne et par établissement | CMF, art. L322-1 et suivants |
| Assurance-vie et PER assurance | FGAP | 70 000 € par assuré et par assureur, tous contrats confondus | Code des assurances, art. L423-1 et suivants |
| Crowdlending | Aucune garantie | — | — |
| Crypto | Aucune garantie | — | — |

Points à ne pas rater :

- **La garantie s'applique par établissement agréé, pas par marque.** Plusieurs marques peuvent partager le même agrément ; il faut pouvoir les regrouper.
- **Pour l'assurance-vie, c'est l'assureur qui compte, pas le courtier.** Un contrat souscrit chez un courtier en ligne est porté par un assureur qu'il faut connaître : deux contrats de deux courtiers peuvent être chez le même assureur.
- **Un établissement d'un autre pays de l'Union européenne** est couvert par la garantie de son pays, avec le même plafond de 100 000 € pour les dépôts. Sa garantie des titres et ses règles d'assurance diffèrent : à préciser au cas par cas.
- Les titres sont en principe conservés à part et restent la propriété du client. La garantie des titres ne joue que s'ils ne peuvent pas être restitués. Il faut le dire simplement pour ne pas inquiéter à tort.

**Ce qu'il faut ajouter :**

- Sur la fiche de l'établissement : un champ « établissement garant » (l'établissement agréé ou l'assureur réel) et le pays.
- Sur un contrat d'assurance-vie ou de PER : l'assureur, s'il diffère de l'établissement saisi.
- Dans `@hamac/core` : un calcul qui regroupe les sommes par établissement garant et par type de garantie, et renvoie la part garantie et la part non garantie.
- Affichage : une carte « Protection en cas de faillite » (Synthèse ou Établissements), une ligne par établissement garant avec une barre garanti / non garanti, et une alerte quand un plafond est dépassé.

**Questions ouvertes :**

- Faut-il une liste de référence des agréments (marque → établissement garant), tenue par l'administrateur de l'instance, ou une saisie libre suffit-elle ?
- Où afficher la carte : tableau de bord, Synthèse ou Établissements ?

---

## 2. Calcul de l'IFI

**Statut :** reporté, décision du 11 novembre 2026.

Pas de calcul pour le moment. La proposition 3 (qui possède quoi) et la proposition 4 (autres biens) prépareront les données nécessaires si on y revient : part détenue, démembrement, dettes rattachées, parts de SCI.

---

## 3. Qui possède quoi

**Statut :** fait le 11 novembre 2026. Décisions : usufruit et nue-propriété au barème fiscal (`core/src/ownership.ts`), pour l'immobilier ; parts de SCI détaillées (table `companies`, biens rattachés, carte « Sociétés (SCI) » dans Immobilier) ; part détenue sur les comptes qui peuvent être joints (compte-titres, livret bancaire, crypto). La nature « bien propre / commun » est reportée au foyer. Le démembrement des parts de SCI elles-mêmes (nue-propriété de parts reçue en donation) n'est pas couvert : décision du 11 novembre 2026 de ne pas l'ajouter pour l'instant. Les montants des comptes joints restent ceux du compte entier dans les pages des comptes et la Performance : seuls le patrimoine net, la répartition et la protection comptent la part détenue. La trésorerie et les autres dettes d'une SCI ne sont pas saisies pour l'instant.

**Pourquoi.** La façon dont un bien est détenu change sa valeur réelle dans le patrimoine, le calcul d'un futur IFI et une éventuelle succession. C'est aussi ce qui préparera le foyer, prévu plus tard.

**Ce qui existe.** Pour l'immobilier uniquement : le statut de détention (`ownership` : nom propre, indivision, SCI familiale, autre SCI, autre) et la part détenue (`share`, une fraction). Les crédits ont aussi une part à charge (`loans.share`). Les comptes financiers n'ont rien.

**Ce qu'il faut ajouter :**

- **Le démembrement :** pleine propriété, usufruit ou nue-propriété, pour un bien immobilier, un bien de la proposition 4 ou un compte-titres. Avec l'âge de l'usufruitier, la valeur de chaque part se calcule avec le barème fiscal (CGI, art. 669 ; à vérifier). Exemple : usufruitier entre 61 et 70 ans, usufruit 40 % et nue-propriété 60 %.
- **La nature du bien dans un couple** (facultative, utile une fois le foyer en place) : bien propre, bien commun, bien indivis.
- **Les parts de SCI :** au lieu de saisir directement le bien, pouvoir saisir la SCI, ses biens et ses dettes, et la part de parts détenue. La valeur de la part est alors l'actif net de la SCI multiplié par cette part.
- **Les comptes joints :** une part détenue sur un compte-titres joint ou un compte courant.
- Affichage : sur la Synthèse, un choix « valeur totale des biens / valeur de ma part », et sur chaque fiche une ligne qui explique comment la part est calculée.

**Questions ouvertes :**

- Le patrimoine net affiché par défaut doit-il compter la nue-propriété à sa valeur fiscale ou à 100 % ?
- Faut-il garder `ownership` et `share` tels quels et ajouter un champ de démembrement, ou regrouper le tout dans une structure commune à tous les biens ?

---

## 4. Biens qui ne sont pas des placements

**Statut :** fait le 11 novembre 2026. Les actions gratuites, BSPCE et stock-options de l'employeur sont écartés pour le moment. Module « Autres biens » (page `/autres-biens`, tables `other_assets` et `other_asset_values`, calculs dans `core/src/otherAssets.ts`) : valeur et estimations passées, baisse annuelle facultative, échéancier pour l'argent prêté, part détenue, démembrement pour les seules parts de société (l'or, les objets et les véhicules restent en pleine propriété), décote et délai de vente, impôt estimé à la vente au régime le plus avantageux. Dans la répartition seulement avec une classe personnalisée. Cours de l'or saisi à la main pour l'instant. À confirmer : le taux des prélèvements sociaux sur les plus-values de meubles (17,2 % retenu, articles 150 U à 150 UC non relevés en 2026). Un bien archivé sort aussi de l'historique : une date de vente serait à ajouter si besoin.

**Pourquoi.** Sans eux, le patrimoine net affiché est incomplet.

**Ce qui existe.** Rien en dehors des comptes financiers, de l'immobilier et des crédits.

**Biens à couvrir :**

| Bien | Valeur | Particularités à vérifier |
|---|---|---|
| Or et métaux précieux (pièces, lingots) | Poids × cours si une source de cours le permet, sinon saisie | À la vente : taxe forfaitaire de 11,5 % ou régime des plus-values avec abattement de 5 % par an au-delà de la 2e année, exonération après 22 ans (CGI, art. 150 VI et 150 VC) |
| Véhicules | Saisie, avec une baisse annuelle facultative | Perd de la valeur avec le temps |
| Objets de valeur : œuvres d'art, montres, bijoux, collections | Saisie et date d'estimation | Même régime que l'or ou taxe forfaitaire selon le cas |
| Parts de société non cotée, holding | Saisie et date d'estimation | Liquidité faible |
| Compte courant d'associé | Montant prêté à la société | Échéance et intérêts éventuels |
| Argent prêté à des proches | Capital restant dû selon un échéancier | Prêt de plus de 5 000 € à déclarer (formulaire 2062) ; reconnaissance de dette |

Pour chaque bien :

- une valeur estimée et sa date ;
- une **décote en cas de vente rapide**, qui sert à la proposition 7 ;
- un délai de vente estimé, pour la proposition 7 ;
- la façon dont le bien est détenu, pour la proposition 3 ;
- une classe d'actifs, pour la répartition cible (les classes personnalisées existent déjà).

**Technique.** Probablement une nouvelle table « autres biens » avec un type, plus son historique de valeurs, comme `property_values` pour l'immobilier. Une nouvelle table impose de toucher au mappeur et à `loadWorkspace` dans `repo.ts`, au type `Workspace`, à `normalizeWorkspace` et à la liste `TABLES` de `dump.ts` (voir CLAUDE.md).

**Questions ouvertes :**

- Un nouveau module à activer (« Autres biens ») ou une rubrique de la page Immobilier ?
- Cours de l'or : quelle source, dans la chaîne de sources de cours existante ?

---

## 5. Exposition réelle derrière les ETF

**Statut :** à étudier. Utile, mais les données sont difficiles à obtenir automatiquement à partir de l'ISIN.

**Pourquoi.** Un ETF MSCI World, c'est environ 70 % d'actions américaines. Un ETF du S&P 500 coté en euros reste exposé au dollar. La répartition par classe d'actifs ne le montre pas.

**Pistes, de la plus simple à la plus ambitieuse :**

1. **Répartition par indice, saisie une fois pour toute l'instance.** On rattache chaque ETF à son indice (MSCI World, S&P 500, Stoxx Europe 600, MSCI Emerging Markets…). L'administrateur tient la répartition de chaque indice par pays, secteur et devise, mise à jour une ou deux fois par an. C'est simple, assez juste pour les grands indices et sans source externe.
2. **Saisie manuelle par ETF**, pour les fonds qui ne suivent pas un grand indice, à partir de la fiche de l'émetteur.
3. **Téléchargement des fichiers de composition des émetteurs** (fichiers CSV publiés par les grands émetteurs), via `packages/backend/src/market/` et le `Fetcher`. Fragile : chaque émetteur a son format, qui change sans prévenir.
4. Les sites tiers d'information sur les ETF sont écartés : conditions d'utilisation et risque de blocage.

**Ce qu'on afficherait :** la répartition réelle par pays, par secteur et par devise de tout le patrimoine en actions. Les titres détenus en double d'un ETF à l'autre demandent la composition complète (piste 3) : seulement dans un second temps.

**Questions ouvertes :** commencer par la piste 1 seule ? Quels indices fournir au départ ?

---

## 6. Concentration et risque

**Statut :** à faire, à détailler avant de coder.

**Pourquoi.** Voir d'un coup d'œil si le patrimoine dépend trop d'une seule ligne, d'un seul établissement ou d'un seul émetteur.

**Indicateurs proposés :**

- poids de la première ligne et des cinq premières dans le patrimoine ;
- part chez un seul établissement (le lien avec la proposition 1 est direct) ;
- part chez un même émetteur d'obligations (le champ `issuer` existe sur les titres) ;
- part sur une seule plateforme de crowdlending, et part des projets en retard ou en défaut ;
- part par devise, une fois la proposition 5 en place ;
- **plus forte baisse subie** : le pire écart entre un sommet et le creux qui suit, sur le patrimoine et sur chaque enveloppe ;
- **variations de valeur** : l'écart-type annualisé des rendements mensuels.

**Technique.** `Workspace.prices` ne garde que le dernier cours de chaque mois : la plus forte baisse et les variations seront calculées mois par mois, à partir de l'historique de `buildHistory`. C'est une approximation, à dire à l'écran.

**Affichage.** Une carte « Concentration » avec des seuils réglables (par exemple, alerte au-dessus de 20 % sur une seule ligne), et des alertes dans `computeAlerts`.

**Questions ouvertes :** quels seuils par défaut ? Les ETF larges comptent-ils comme une ligne concentrée (un ETF MSCI World à 60 % n'est pas un risque de concentration) ?

---

## 7. Disponibilité de l'argent

**Statut :** à faire, sous forme d'option à activer.

**Pourquoi.** Savoir combien on peut récupérer, et en combien de temps, si un besoin arrive.

**Classement proposé :**

| Délai | Ce qui en relève en général |
|---|---|
| Sous 48 h | Livrets, comptes courants, espèces disponibles |
| Sous un mois | Titres d'un PEA ou d'un compte-titres, rachat d'assurance-vie, crypto |
| Sous un an | SCPI (selon l'attente à la revente), épargne salariale dans un cas de déblocage anticipé |
| Bloqué | Crowdlending jusqu'à l'échéance, PER jusqu'à la retraite, immobilier, biens de la proposition 4 selon leur délai |

- Chaque compte et chaque bien reçoit un délai par défaut selon son type, modifiable.
- Le **coût de la sortie** s'affiche à côté : impôt sur les gains (déjà calculé dans `taxes.ts`), clôture d'un PEA de moins de 5 ans, décote des biens de la proposition 4.
- L'**épargne de précaution en mois de dépenses** : il faut un nouveau réglage de dépenses mensuelles dans `PlanParams`, à ajouter aussi à `defaultParams`.

**Affichage.** Une barre empilée par délai sur la Synthèse, avec le montant net de sortie au survol.

---

## 8. Poids des crédits et aide à la décision

**Statut :** fait le 11 novembre 2026. Calculs dans `core/src/debt.ts`, cartes « Poids des crédits » et « Rembourser par avance ou placer ? » sur la page Crédits, nouveau réglage « Revenus nets par mois » (Paramètres › Plan), alerte au-delà de 35 % de taux d'effort. Décisions : comparaison avec un taux net saisi, prérempli d'après les hypothèses du plan (livret, fonds euros, obligations, actions sur PEA, impôts estimés) ; les deux options sont comparées à la fin prévue du crédit, les échéances libérées étant placées au même rendement ; l'indemnité est préremplie au plafond légal et modifiable ; le taux d'équilibre est affiché. Non fait : déduction des intérêts d'un bien loué, alerte de renégociation (il faudrait une source de taux du marché). Règles vérifiées sur des sources secondaires : plafond des indemnités (R313-25), crédit à la consommation (L312-34), 35 % du HCSF.

**Pourquoi.** Savoir où en sont les crédits, et décider s'il vaut mieux rembourser par avance ou placer l'argent.

**Ce qui existe.** Crédits avec différé, assurance, remboursements anticipés (`loan_prepayments`), part à charge, coût année par année. Rattachement d'un crédit à un bien. Simulateurs de rendement net d'impôts.

**Indicateurs à ajouter :**

- part du patrimoine financée à crédit (dettes ÷ actifs) ;
- pour chaque bien, la part encore due à la banque (capital restant dû ÷ valeur du bien) ;
- taux d'endettement (mensualités ÷ revenus), ce qui demande un réglage de revenus mensuels ;
- coût réel de chaque crédit : taux, assurance comprise, et moins les intérêts déductibles si le bien est loué (à vérifier selon le régime fiscal du bien).

**L'aide à la décision : « rembourser X € par avance, ou les placer ? »**

- D'un côté, les intérêts et l'assurance économisés sur la durée restante, moins les indemnités de remboursement anticipé. Pour un crédit immobilier, elles sont plafonnées au plus petit de deux montants : 6 mois d'intérêts sur la somme remboursée, ou 3 % du capital restant dû (Code de la consommation, art. L313-47 et R313-25 ; à vérifier).
- De l'autre, le gain net d'impôts du placement choisi, calculé avec le moteur des simulateurs (`simulation.ts`).
- Avec, en clair, ce qu'on perd en disponibilité (proposition 7) : l'argent remboursé ne revient pas.
- Résultat : « Rembourser 20 000 € maintenant vous fait gagner environ X € d'ici la fin du crédit. Les placer à Y % net rapporterait environ Z €. »

**Questions ouvertes :** une page à part ou un onglet de la page Crédits ? Proposer aussi une alerte « renégociation » quand l'écart avec les taux du marché est grand ? Il faudrait alors une source de taux.

---

## 9. Compteurs d'ancienneté et plafonds

**Statut :** fait le 11 novembre 2026. Calculs dans `core/src/counters.ts`, page « Compteurs et plafonds » (`/compteurs`, groupe Fiscalité, module Impôts), table `gifts` pour les donations, réglage « Plafond de déduction PER » (Paramètres › Plan). Décisions : les plafonds du PEA comptent les versements bruts (versé net plus retraits et transferts sortants), ce qui est prudent ; la part de gain d'un retrait d'assurance-vie se calcule au prorata du versé net juste avant le retrait ; les 70 ans sont comptés au 1er janvier de l'année des 70 ans, faute de date de naissance complète ; les donations se saisissent avec le lien du bénéficiaire avec le donateur, et le don familial d'argent s'impute d'abord sur son exonération. Abattements vérifiés sur service-public.gouv.fr (page vérifiée le 13 mai 2026). Non fait : abattement pour handicap, donations par représentation, droits de donation au-delà des abattements.

**Ce qui existe :**

- l'alerte six mois avant les 5 ans d'un PEA ou les 8 ans d'une assurance-vie (`alerts.ts`, à partir de `openedOn`), et l'alerte quand la date d'ouverture manque ;
- l'alerte quand un livret dépasse son plafond de dépôt (`LIVRET_LEGAL_CEILINGS`) ;
- les fourchettes plancher et plafond du plan pour les livrets.

**Ce qu'il faut ajouter :**

- **Une vue d'ensemble « Compteurs et plafonds »** au lieu d'alertes éparses : pour chaque compteur, la date ou le montant actuel, la limite et ce qui reste disponible.
- **Plafond des versements du PEA** : 150 000 € de versements, PEA et PEA-PME cumulés limités à 225 000 € (CMF, art. L221-30 et L221-32-1 ; à vérifier). Le calcul porte sur les versements cumulés, pas sur la valeur.
- **Abattement annuel de l'assurance-vie après 8 ans** : 4 600 € de gains par an, 9 200 € pour un couple (CGI, art. 125-0 A ; à vérifier), avec la part déjà utilisée par les rachats de l'année.
- **Versements sur l'assurance-vie avant et après 70 ans**, comptés séparément.
- **Donations** : le délai de 15 ans qui relance les abattements (100 000 € par parent et par enfant, CGI art. 779 et 784), et le don familial d'argent (31 865 €, CGI art. 790 G ; à vérifier). Il faut une petite saisie des donations faites et reçues.
- **Plafond PER déductible**, en option : le montant indiqué sur l'avis d'impôt, saisi par l'utilisateur.

---

## 10. Liste de fin d'année

**Statut :** fait le 11 novembre 2026. Calculs dans `core/src/yearEnd.ts`, carte « Liste de fin d'année » repliée en une ligne en bas de la page Impôts, toute l'année (décision du 11 novembre 2026 : la carte encombrait la page), alerte au tableau de bord en novembre et décembre, cases cochées gardées par année (réglage `taxes.yearEnd`). Décisions : les moins-values ne sont proposées que s'il y a des plus-values imposables cette année (après report des moins-values antérieures), l'économie est chiffrée au taux du plan (prélèvement forfaitaire ou barème) plus les prélèvements sociaux ; le retrait d'assurance-vie proposé est celui qui sort tout l'abattement restant, contrat par contrat ; le PER n'apparaît que si le plafond de déduction est renseigné. Le rachat immédiat d'un titre vendu à perte n'est pas interdit par une règle française connue, mais peut être contesté pour abus de droit : la liste le dit. Non fait : dons aux associations, crypto.

**Pourquoi.** Plusieurs gestes fiscaux ne se font que jusqu'au 31 décembre. Hamac a déjà les chiffres pour les calculer.

**Ce qui existe.** Registre des cessions datées et report des moins-values, impôts de la prochaine déclaration, impôt sur les gains latents par compte, comparaison du barème et du prélèvement forfaitaire dans les simulateurs.

**Éléments de la liste, chacun chiffré :**

- **Moins-values à réaliser sur le compte-titres** pour compenser les plus-values déjà réalisées dans l'année : liste des lignes en perte et impôt économisé. À vérifier : la France n'a pas de règle qui interdit de racheter le même titre juste après, mais il faut s'en assurer et le dire prudemment.
- **Abattement de l'assurance-vie non utilisé** (proposition 9) : le rachat partiel qui sortirait les gains sans impôt sur le revenu (prélèvements sociaux dus quand même), puis reversement éventuel.
- **Versement sur un PER** : économie d'impôt estimée selon le taux marginal, dans la limite du plafond saisi.
- **Plafonds encore disponibles** : livrets, PEA (proposition 9).
- **Rappel pour la déclaration du printemps** : choix entre barème et prélèvement forfaitaire, établissements cochés pour le récapitulatif fiscal.

**Affichage.** Une carte sur la page Impôts, mise en avant de novembre à décembre, et une alerte « Liste de fin d'année disponible » en novembre. Une case par élément pour noter ce qui est fait, à garder par année.

---

## 11. Objectifs par projet

**Statut :** à faire.

**Pourquoi.** Donner du sens à l'épargne : on n'investit pas « pour investir », mais pour acheter un logement, payer des études, faire des travaux.

**Ce qui existe.** Les dépenses prévues (`planned_expenses` : année, montant, libellé, compte payeur), utilisées par la projection.

**Ce qu'il faut ajouter :**

- un objectif = nom, montant cible, date, priorité, et les comptes affectés, en totalité ou pour un montant ;
- l'avancement : somme réunie, part de l'objectif, en avance ou en retard ;
- le **versement mensuel nécessaire** pour l'atteindre, avec le rendement attendu des comptes affectés ;
- un conseil de prudence quand l'échéance approche alors que l'argent est sur des placements qui varient beaucoup ;
- une fois l'objectif atteint ou passé : archivé, et la dépense passe au journal.

**Questions ouvertes :** faire évoluer les dépenses prévues en objectifs, ou garder deux notions séparées ? Un même compte peut servir plusieurs objectifs : partage par montant ou par pourcentage ?

---

## 12. Rapprochement avec les relevés et journal des décisions

**Statut :** à faire. Deux fonctions distinctes, simples à construire, qui rendent les chiffres fiables et les décisions plus réfléchies.

### 12 a. Rapprochement avec les relevés

**Statut :** fait le 11 novembre 2026. Décisions : une page dédiée « Rapprochement » dans le groupe Saisie (la carte des fonds euros y renvoie) ; relevé avec valeur totale, espèces facultatives et quantités facultatives par titre (table `statement_positions`) ; comparaison au calcul à la date du relevé (`core/src/reconciliation.ts`) ; correction proposée seulement quand l'écart porte sur l'argent du compte (espèces relevées, ou valeur d'un compte sans titres) ; rappel au-delà de 12 mois sans relevé, réglable (`alerts.reconcileMonths`, 0 = aucun), compté depuis l'ouverture pour un compte jamais rapproché. Le remplissage automatique par les imports de relevés n'est pas fait.

**Ce qui existe.** La table `statements` (valeur relevée d'un compte à une date) et le calcul de l'écart (`statementGap` dans `engine.ts`), avec une alerte, utilisés pour les fonds euros.

**Ce qu'il faut ajouter :**

- l'étendre à tous les comptes : saisir le solde réel, espèces et valeur totale, à une date ;
- pour les comptes de titres, comparer d'abord **les quantités par titre**, plus fiable que les valeurs puisque les cours diffèrent toujours un peu ;
- en cas d'écart, proposer l'opération de correction en un clic ;
- afficher pour chaque compte la date du dernier rapprochement, avec un rappel au-delà d'un délai réglable ;
- les imports de relevés (CSV, OFX, Bricks) pourraient remplir le solde relevé automatiquement.

### 12 b. Journal des décisions

- Pour un achat, une vente ou un titre : pourquoi on l'a fait, ce qui ferait changer d'avis, et une date de réexamen.
- À cette date, un rappel affiche la note avec l'évolution du titre depuis la décision.
- Une liste de toutes les décisions, pour relire ses raisonnements passés.
- Technique : une nouvelle table, avec le même rappel que pour la proposition 4 sur les fichiers à toucher.

---

## Ordre de développement proposé

À valider. L'ordre tient compte des dépendances entre propositions.

1. ~~**Proposition 1**, protection en cas de faillite~~ : faite.
2. ~~**Propositions 3 et 4**, qui possède quoi et autres biens~~ : faites.
3. ~~**Proposition 12 a**, rapprochement~~ : fait.
4. **Proposition 7**, disponibilité de l'argent.
5. **Proposition 6**, concentration et risque.
6. ~~**Proposition 8**, crédits~~ : fait.
7. ~~**Propositions 9 puis 10**, compteurs puis liste de fin d'année~~ : faites.
8. **Proposition 11**, objectifs par projet.
9. **Proposition 12 b**, journal des décisions.
10. **Proposition 5**, exposition réelle, après une étude de faisabilité.
