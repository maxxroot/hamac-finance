# Propositions pour le format « gestion de patrimoine »

Document de travail, ouvert le 11 novembre 2026. Il garde la trace de douze propositions discutées pour le format gestion de patrimoine (`profile.goal = "patrimoine"`), à développer une par une. La plupart servent aussi au format préparation de retraite, mais elles sont pensées pour le premier.

Chaque proposition indique son statut, ce qui existe déjà dans Hamac, ce qu'il faut ajouter et les questions à trancher avant de coder. Les montants et règles légales cités sont **à vérifier sur la source officielle au moment du développement**, comme pour toute règle de `@hamac/core` (source citée, date de vérification, tests chiffrés).

## Déjà en place

Sur la branche `patrimoine`, au 11 novembre 2026 :

- **Protection en cas de faillite (proposition 1)** : carte sur la Synthèse, part garantie et non garantie par établissement garant, alerte au-delà d'un plafond, champs « Établissement garant » et « Pays » sur la fiche de l'établissement.
- **Qui possède quoi (proposition 3)** : usufruit et nue-propriété d'un bien immobilier au barème fiscal, sociétés (SCI) avec la part des parts détenue, part détenue sur les comptes joints.
- **Poids des crédits (proposition 8)** : sur la page Crédits, part du patrimoine financée à crédit, part de chaque bien encore due, taux d'effort, taux assurance comprise et coût restant de chaque crédit, et comparateur « rembourser par avance ou placer ».
- **Compteurs et plafonds (proposition 9)** : page « Compteurs et plafonds » (groupe Fiscalité) : ancienneté du PEA et des assurances-vie, plafonds du PEA, du PEA-PME, des livrets et du PER, abattement annuel de l'assurance-vie, versements avant et après 70 ans, donations faites et reçues avec leurs abattements.
- **Liste de fin d'année (proposition 10)** : repliée en bas de la page Impôts, moins-values à réaliser, abattement de l'assurance-vie, versement PER, plafonds libres et préparation de la déclaration, chiffrés, avec une case par geste ; alerte au tableau de bord en novembre et décembre.
- **Autres biens (proposition 4)** : page « Autres biens », en dernier des enveloppes ; or, objets, véhicules, parts de société (démembrables), compte courant d'associé et argent prêté, avec décote, délai de vente et impôt estimé à la vente.

- **Concentration et risque (proposition 6)** : carte « Concentration » sur la Synthèse (titres tous comptes confondus, émetteurs d'obligations, plateformes de crowdlending et projets en difficulté, établissements), alerte au-delà de 20 %, volatilité ajoutée à la page Performance.

- **Exposition réelle derrière les ETF (proposition 5)** : page « Exposition réelle » (Vue d'ensemble, après Performance, module Actions) ; répartition par pays, secteur, devise et type de ligne, plus grosses lignes tous titres confondus, d'après la composition publiée par Amundi ou iShares, récupérée dès le choix de l'ETF et mise à jour chaque trimestre ; ETF physique équivalent pour un ETF synthétique ou d'un émetteur non géré.

- **Objectifs par projet (proposition 11)** : page « Projets » (Vue d'ensemble) et carte « Projets en cours » au tableau de bord ; somme, date, comptes affectés en pourcentage ou en montant réservé, avancement, avance ou retard, versement mensuel nécessaire au taux du projet.

Hors propositions, ajouté pendant le même travail :

- **Prélèvement des impôts réglé par établissement** (commit `877a9a7`) : une case « L'établissement prélève les impôts sur les intérêts et dividendes » sur la fiche de chaque établissement remplace ce que Hamac supposait selon le type de compte. Décochée, le montant reçu compte comme brut et tout est à payer à la déclaration (compte-titres, assurance-vie, livret bancaire, crowdlending). Les fiches existantes reprennent l'ancien comportement (oui en France pour une banque, un courtier ou un assureur ; non pour une plateforme crypto, un établissement étranger ou des taux de retenue à 0 ; l'ancienne case des plateformes de crowdlending). Calcul dans `institutionWithholds` (`core/src/institutions.ts`).
- **Liste de fin d'année repliée** (commit `7a0a331`) et **rapprochement retiré** (commit `3e259b5`) : voir les propositions 10 et 12 a.

Le détail, les décisions prises et ce qui reste hors de chaque version sont dans la section de chaque proposition.

## Suivi

| N° | Proposition | Statut |
|----|-------------|--------|
| 1 | Ce qui est protégé si un établissement fait faillite | Fait le 11 novembre 2026 (commit `bd14015`) |
| 2 | Calcul de l'IFI | Reporté |
| 3 | Qui possède quoi | Fait le 11 novembre 2026 (commit `c92ceb0`) |
| 4 | Biens qui ne sont pas des placements | Fait le 11 novembre 2026, sans les actions de l'employeur (commit `adc3eb5`) |
| 5 | Exposition réelle derrière les ETF | Fait le 12 novembre 2026, compositions Amundi et iShares |
| 6 | Concentration et risque | Fait le 11 novembre 2026 |
| 7 | Disponibilité de l'argent | À faire, sous forme d'option |
| 8 | Poids des crédits et aide à la décision | Fait le 11 novembre 2026 |
| 9 | Compteurs d'ancienneté et plafonds | Fait le 11 novembre 2026 |
| 10 | Liste de fin d'année | Fait le 11 novembre 2026 |
| 11 | Objectifs par projet | Fait le 11 novembre 2026 |
| 12 | Rapprochement avec les relevés et journal des décisions | 12 a abandonné le 11 novembre 2026 ; 12 b à faire |

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

**Statut :** fait le 12 novembre 2026 (commits `c6f7460` à `0c45fed`). Où se trouve quoi :

- téléchargement et lecture : `backend/src/market/composition.ts` (`findComposition` par ISIN, `fetchComposition` par source connue) ;
- stockage commun, mise à jour trimestrielle, liens communs : `backend/src/market/compositionStore.ts`, tables `marche.compositions` et `marche.composition_links`, passage dans la boucle de `SharedMarket` ;
- choix propre à chaque utilisateur : colonne `assets.composition_isin` (dans la sauvegarde) ;
- procédures `exposure.load`, `exposure.lookup`, `exposure.choose`, `exposure.admin`, `exposure.adminLink` : `backend/src/exposure.ts` ;
- règles et calculs : `core/src/exposure.ts` (libellés harmonisés, résumé d'une composition, ETF de référence par indice, composition utilisée, exposition du portefeuille) ;
- interface : page `/exposition`, annonce dans la fiche d'un titre et à l'achat d'un nouveau titre (`CompositionNotice`), fenêtre de choix de l'équivalent, carte « Compositions des ETF » et « ETF équivalents » dans Paramètres › Cours pour l'administrateur, alerte « À regarder » en cas d'échec.

Les tests sur les vrais sites se lancent avec `HAMAC_LIVE=1`.

**Pourquoi.** Un ETF MSCI World, c'est environ 70 % d'actions américaines. Un ETF du S&P 500 coté en euros reste exposé au dollar. La répartition par classe d'actifs ne le montre pas.

### Ce que l'étude a montré (11 novembre 2026)

Adresses non documentées, testées à cette date, susceptibles de changer sans prévenir.

- **Amundi, une requête par ISIN** : `POST https://www.amundietf.fr/mapi/ProductAPI/getProductsData`. Elle renvoie chaque ligne (ISIN, nom, poids en fraction, secteur, pays de risque, devise, type, date) et la méthode de réplication (`FUND_REPLICATION_METHODOLOGY` : « Direct(Physical) » ou « Indirect(Swap Based) »). Un ISIN inconnu donne une liste vide. Deux ISIN français essayés (FR0011869353, FR0011550185) ne renvoient rien : à comprendre.
- **iShares, deux requêtes** : la recherche du site accepte l'ISIN et renvoie le numéro de produit (`GET https://www.ishares.com/varnish-api/core-search/search/products?site=ishares-uk&locale=en-gb&userType=individual&rows=5&start=0&query=<ISIN>`), puis le CSV est à `https://www.ishares.com/uk/individual/en/products/<numéro>/x/latest-holdings.csv`. L'adresse doit contenir un nom de fonds, mais n'importe quel mot convient (`x`). Le CSV donne le ticker, le nom, le secteur, le type de ligne, le poids en pourcentage, le pays et la devise de cotation, sans ISIN par ligne. Les ETF obligataires ont des colonnes en plus (durée, échéance, coupon) et une autre liste de secteurs (« Banking », « Electric »…). La méthode de réplication se lit sur la page produit (`productStructure` : « Physical » ou « Synthetic »). L'ancien lien `.ajax?fileType=csv`, cité partout, ne marche plus depuis la refonte du site.
- **Le piège des ETF synthétiques.** Un ETF à swap publie le panier qu'il détient, pas l'exposition qu'il donne. L'Amundi MSCI World Swap (LU1681043599) renvoie 153 lignes européennes (ASML, Airbus, Bayer…) ; l'Amundi MSCI Emerging Markets Swap a Amazon et NVIDIA en tête. Chez iShares, le CSV d'un ETF à swap commence par une ligne pour l'indice lui-même (« MSCI WORLD GROSS TR INDEX », 99,92 %) suivie du panier, soit environ 200 % au total. Or la plupart des ETF « monde » ou « États-Unis » éligibles au PEA sont synthétiques.

### Décisions (11 novembre 2026)

- **Récupération au choix du titre.** La composition se télécharge en tâche de fond quand l'utilisateur choisit l'ETF dans les résultats de recherche, pas pendant la recherche elle-même. Les ETF déjà saisis sont remplis lors d'un rafraîchissement.
- **ETF physique équivalent.** Pour un ETF synthétique, ou d'un émetteur non géré (Xtrackers, SPDR, Vanguard…), la composition vient d'un ETF physique qui suit le même indice. Hamac en propose un d'après le nom de l'indice, l'utilisateur confirme, et ne saisit un ISIN qu'en dernier recours. L'équivalent doit être physique, avec une composition récupérable, sinon il est refusé avec la raison.
- **Lien commun, choix propre à chaque utilisateur.** Le premier lien vérifié est gardé dans `marche` et proposé aux utilisateurs suivants. Chaque utilisateur peut choisir un autre équivalent, gardé dans son schéma, qui l'emporte sur le lien commun (comme un cours manuel l'emporte sur le cours partagé). L'administrateur peut corriger ou supprimer un lien commun. L'écran dit « Composition reprise de l'ETF … (physique, même indice), au … », avec un bouton « Changer », sans dire qu'un autre utilisateur l'a choisi.
- **On garde l'émetteur et son identifiant, pas l'adresse.** En base : `ishares` et son numéro de produit, ou `amundi` et l'ISIN ; l'adresse est reconstruite dans le code. Un changement d'adresse se corrige en un seul endroit, et le serveur ne télécharge jamais une adresse saisie par un utilisateur.
- **Mise à jour chaque trimestre**, au rythme des révisions des grands indices. On garde la dernière composition valable avec sa date, et une alerte pour l'administrateur si le téléchargement échoue.
- **Libellés harmonisés** : pays en code ISO, secteurs ramenés à une liste fixe (les secteurs des obligations iShares compris), lignes classées en actions, obligations, liquidités, dérivés ou autres.

### Décisions prises pendant le développement (12 novembre 2026)

- **Ordre de priorité de la composition utilisée** : l'équivalent choisi par l'utilisateur, puis la composition de l'ETF s'il n'est pas synthétique, puis le lien commun. Un ETF synthétique ne sert jamais par lui-même.
- **Lien commun** : créé seulement à partir d'un équivalent vérifié, et seulement pour un ETF dont la composition ne sert pas telle quelle (synthétique, émetteur non géré, échec). Les liens et les échecs ne sont visibles que de l'administrateur, puisqu'ils disent quels ETF sont détenus sur l'instance.
- **Équivalent proposé** : déduit du nom de l'ETF, à partir d'une table de 19 ETF physiques de référence, un par grand indice (`EQUIVALENT_REFERENCES`), chacun vérifié le 12 novembre 2026 sur le site de son émetteur. L'iShares STOXX Europe 600 (DE0002635307) est inconnu de la recherche iShares : l'Amundi Core Stoxx Europe 600 le remplace.
- **Rythme** : une composition est remise à jour au bout de 92 jours ; un échec est réessayé après 6 heures, la composition précédente étant gardée ; un ETF inconnu des deux émetteurs est recherché de nouveau après 30 jours. Les téléchargements se font un par un, à une seconde d'intervalle, au plus 20 par passage de la boucle et 100 en attente à la demande. Une composition que plus personne ne détient ni ne référence est oubliée une fois périmée.
- **Actions détenues en direct** : comptées pour le pays de leur ISIN (pays d'enregistrement), sans secteur.
- **Périmètre** : actions et ETF, pour la part détenue des comptes joints. Les fonds, les obligations détenues en direct et les autres placements n'y figurent pas.

### Questions encore ouvertes

- Les parts couvertes contre le change (« EUR Hedged ») : la devise des titres ne reflète pas le risque de change réel.
- Les titres en double d'un ETF à l'autre : rapprochés par ISIN chez Amundi, seulement par nom chez iShares (le CSV n'a pas d'ISIN par ligne).
- Deux ISIN français essayés (FR0011869353, FR0011550185) restent inconnus d'Amundi.
- L'indice suivi n'est pas fourni par Amundi : l'équivalent est déduit du nom, et un nom sans indice reconnaissable ne reçoit pas de proposition.

### Pistes envisagées avant l'étude

Gardées pour mémoire ; la piste 3 est retenue, complétée par l'ETF physique équivalent.

1. **Répartition par indice, saisie une fois pour toute l'instance.** On rattache chaque ETF à son indice (MSCI World, S&P 500, Stoxx Europe 600, MSCI Emerging Markets…). L'administrateur tient la répartition de chaque indice par pays, secteur et devise, mise à jour une ou deux fois par an. C'est simple, assez juste pour les grands indices et sans source externe.
2. **Saisie manuelle par ETF**, pour les fonds qui ne suivent pas un grand indice, à partir de la fiche de l'émetteur.
3. **Téléchargement des fichiers de composition des émetteurs** (fichiers CSV publiés par les grands émetteurs), via `packages/backend/src/market/` et le `Fetcher`. Fragile : chaque émetteur a son format, qui change sans prévenir.
4. Les sites tiers d'information sur les ETF sont écartés : conditions d'utilisation et risque de blocage.

**Ce qu'on afficherait :** la répartition réelle par pays, par secteur et par devise de tout le patrimoine en actions. Les titres détenus en double d'un ETF à l'autre demandent la composition complète (piste 3) : seulement dans un second temps.

---

## 6. Concentration et risque

**Statut :** fait le 11 novembre 2026. Calculs dans `core/src/concentration.ts` et `volatility` (`core/src/performance.ts`), carte « Concentration » sur la Synthèse, réglage « Concentration maximale » (Paramètres › Plan, 20 % par défaut, 0 = pas d'alerte), alertes au tableau de bord. Décisions : parts du patrimoine financier, pour la part détenue des comptes joints ; les ETF et fonds sont jugés comme les autres lignes ; une obligation se juge par son émetteur (pas d'alerte en double sur sa ligne) et les OAT ne déclenchent pas d'alerte ; les établissements sont montrés sans alerte (la protection en cas de faillite a la sienne). La plus forte baisse existait déjà sur la page Performance ; la volatilité (écart-type des rendements mensuels × √12, à partir de 12 mois) y est ajoutée. Non fait : exposition par devise (proposition 5).

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

**Statut :** fait le 11 novembre 2026. Calculs dans `core/src/goals.ts`, tables `goals` et `goal_allocations`, page « Projets » (`/projets`, module Projets) et carte au tableau de bord. Décisions : les projets et les dépenses prévues restent deux notions ; la liste de la projection de retraite est renommée « Dépenses imprévues » (provisions pour l'imprévu), les projets étant ce qui est prévu ; un compte sert un projet au choix en pourcentage de sa valeur ou en montant réservé (plafonné à ce que contient le compte), et peut servir plusieurs projets avec une alerte s'il est affecté à plus que sa valeur ; le versement mensuel nécessaire suit un taux saisi par projet, 0 % par défaut ; l'avance ou le retard se juge par rapport à une progression régulière depuis la date de début ; un avertissement apparaît à moins de 3 ans de l'échéance si plus de 30 % de l'argent est en actions ou en crypto. Non fait : les projets n'entrent pas dans la projection de retraite, et un projet atteint ne crée pas tout seul la dépense au journal.

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

**Statut :** abandonné le 11 novembre 2026, après avoir été construit (commit `8b734b8`) puis retiré. Raison : sans export du portefeuille par les plateformes (BoursoBank ne propose pas de CSV des positions du PEA, par exemple), la saisie manuelle des relevés n'apporte pas assez. Reste en place : la carte « Contrôle avec le relevé » des fonds euros, qui compare désormais à la date du relevé (`core/src/reconciliation.ts`), et son alerte. À reprendre si une plateforme utilisée fournit un export des positions (CSV ou OFX).

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
3. ~~**Proposition 12 a**, rapprochement~~ : abandonné.
4. **Proposition 7**, disponibilité de l'argent.
5. ~~**Proposition 6**, concentration et risque~~ : fait.
6. ~~**Proposition 8**, crédits~~ : fait.
7. ~~**Propositions 9 puis 10**, compteurs puis liste de fin d'année~~ : faites.
8. ~~**Proposition 11**, objectifs par projet~~ : fait.
9. **Proposition 12 b**, journal des décisions.
10. ~~**Proposition 5**, exposition réelle~~ : faite.
