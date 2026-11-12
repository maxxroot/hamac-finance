# Exposition réelle : guide

> Pour les développeurs : [documentation technique](technique.md).

## À quoi sert cette page

Un ETF contient souvent des centaines, voire des milliers d'actions. La page Exposition réelle regarde à l'intérieur de vos ETF et de vos actions pour montrer où votre argent est vraiment placé : dans quels pays, quels secteurs, quelles devises, et quelles sont les plus grosses lignes, tous titres confondus.

Elle s'appuie sur la composition que l'émetteur publie pour chaque ETF. Hamac sait la récupérer chez deux émetteurs : **Amundi** et **iShares**.

La page est la même en plan de retraite et en gestion de patrimoine. Elle fait partie du module « Actions & ETF » : si ce module est retiré du menu (Paramètres › Plan › Modules), la page l'est aussi.

## Ce que vous y voyez

Sans action ni ETF détenu, la page l'indique simplement. Sinon :

1. **Quatre chiffres** :
   - **Actions et ETF** : la valeur de vos actions et ETF ;
   - **Composition connue** : la part de cette valeur dont on connaît le contenu ;
   - **Montant analysé** : cette même part, en euros ;
   - **ETF sans composition** : le nombre d'ETF pour lesquels aucune composition ne sert encore.
2. **Quatre répartitions**, en barres, sur le montant analysé :
   - **Pays** : les dix premiers, puis « Autres pays » ;
   - **Secteurs** : technologie, santé, banques et assurances, industrie, États…
   - **Devises** : les huit premières, puis « Autres devises » ; c'est la devise de cotation des titres ;
   - **Types de ligne** : actions, obligations, liquidités, dérivés, autres.
3. **Plus grosses lignes, tous titres confondus** : les quinze plus grosses positions, avec leur part, leur montant et les titres par lesquels vous les détenez (le nom de l'ETF, ou « en direct »).
4. **Vos ETF** : pour chaque ETF, son montant et l'état de sa composition (émetteur, physique ou synthétique, nombre de lignes, date), ou la raison pour laquelle elle manque. Un bouton « Choisir un équivalent » ou « Changer » apparaît quand c'est utile.
5. **Une note** qui rappelle les règles de lecture.

Pendant qu'une composition se télécharge, la page se met à jour d'elle-même toutes les quelques secondes, pendant deux minutes au plus.

## Comment faire

**Faire analyser un nouvel ETF** : donnez-lui son ISIN quand vous le créez ou le modifiez. Dès que l'ISIN est saisi, avant même l'enregistrement, Hamac demande sa composition et affiche ce qu'il en sait déjà (connue, reprise d'un équivalent, ETF synthétique, émetteur non lu). Sans ISIN, la page vous invite à l'ajouter.

**Choisir un ETF équivalent** (pour un ETF synthétique ou d'un émetteur que Hamac ne lit pas) :

1. Dans « Vos ETF », cliquez sur « Choisir un équivalent ».
2. Si Hamac reconnaît l'indice dans le nom de l'ETF, il propose un ETF physique qui le suit : cliquez sur « Utiliser ».
3. Sinon, saisissez l'ISIN d'un ETF **physique** publié par Amundi ou iShares, puis « Vérifier et utiliser ».
4. Hamac vérifie que ce n'est pas le même ETF, qu'il est bien physique et que sa composition se télécharge. Sinon, il explique pourquoi il refuse.

Ce choix ne vaut que pour vous. Pour revenir en arrière, rouvrez la fenêtre et cliquez sur « Retirer mon choix » (ou « Revenir à la proposition commune » s'il en existe une).

**Pour l'administrateur de l'instance** : Paramètres › Cours affiche deux cartes. « Compositions des ETF » liste les téléchargements en échec. « ETF équivalents » liste les liens communs (voir plus bas) : vous pouvez corriger un lien qui ne suit pas le même indice, ou le supprimer. Le tableau de bord de l'administrateur signale aussi les échecs dans « À regarder ».

## Comprendre les chiffres

**Comment un ETF est réparti** : sa valeur est découpée selon les poids de sa composition. Exemple : un ETF de 10 000 € dont la composition compte 70 % d'actions américaines met 7 000 € dans « États-Unis ». Les poids publiés sont ramenés à 100 %, car un fonds publie souvent un peu plus ou un peu moins (par exemple 99,8 %).

**Les actions détenues en direct** comptent pour le pays de leur ISIN, c'est-à-dire le pays où elles sont enregistrées, pas forcément celui où l'entreprise fait son chiffre d'affaires. Leur secteur et leur devise ne sont pas connus : elles apparaissent en « Non renseigné ».

**Comptes joints** : seule votre part compte.

**Pays et secteurs harmonisés** : Amundi et iShares n'écrivent pas les pays et les secteurs de la même façon. Hamac les ramène à une même liste pour pouvoir additionner deux ETF d'émetteurs différents. Les liquidités et les contrats à terme n'ont ni pays ni secteur : ils sont regroupés à part (« Sans pays », « Non renseigné »).

**Plus grosses lignes** : une même entreprise détenue par deux ETF n'apparaît qu'une fois, si on peut la reconnaître. Les lignes d'Amundi ont un ISIN ; celles d'iShares n'en ont pas et ne se regroupent avec les autres que par le nom. Seules les trente plus grosses lignes de chaque ETF sont prises en compte pour ce tableau.

**ETF physique et ETF synthétique** : un ETF physique achète les titres de son indice ; sa composition dit ce qu'il vous expose. Un ETF synthétique détient un autre panier de titres et échange sa performance contre celle de l'indice : sa composition publiée n'est pas votre exposition. Hamac ne l'utilise donc jamais. Il reprend à la place la composition d'un ETF physique qui suit le même indice.

**Quelle composition sert, dans l'ordre** :

1. l'équivalent que **vous** avez choisi, s'il existe ;
2. sinon, la composition de l'ETF lui-même, s'il est physique ;
3. sinon, l'**équivalent commun** de l'instance ;
4. sinon, rien : l'ETF est compté dans « ETF sans composition ».

**Équivalent commun** : la première personne de l'instance qui choisit un équivalent vérifié pour un ETF synthétique ou non lu par Hamac crée un lien commun. Il sert ensuite de proposition à tous les autres utilisateurs qui détiennent cet ETF, sans dire qui l'a choisi. Chacun peut en choisir un autre pour lui seul. L'administrateur peut corriger ou supprimer ce lien. Un ETF physique n'ouvre jamais de lien commun, même si son détenteur choisit un équivalent.

**Compositions partagées** : chaque composition n'est téléchargée qu'une fois pour toute l'instance, quel que soit le nombre de personnes qui détiennent l'ETF. Elle est remise à jour chaque trimestre, au rythme des révisions des grands indices. Si une mise à jour échoue, la composition précédente est gardée et la page le signale ; un nouvel essai a lieu après quelques heures. Un ETF qu'aucun des deux émetteurs ne connaît est recherché de nouveau au bout d'un mois. Les autres utilisateurs ne voient jamais vos montants : seul l'ISIN sert au téléchargement.

## Limites

- Seuls Amundi et iShares sont lus. Pour un ETF d'un autre émetteur, il faut choisir un équivalent physique chez l'un d'eux.
- Une composition date de sa dernière publication, parfois de plusieurs semaines ; elle est relue chaque trimestre.
- La devise affichée est celle de cotation des titres, pas le risque de change réel d'une part couverte.
- Les actions détenues en direct n'ont ni secteur ni devise.
- Le pays d'une action détenue en direct est celui de son ISIN, qui peut différer de son activité réelle.
- Le regroupement des lignes iShares avec celles d'autres émetteurs se fait par le nom : deux écritures différentes du même nom restent séparées.
- Seuls les ETF et les actions sont analysés : fonds, SCPI, obligations détenues en direct, fonds euros et crypto n'entrent pas dans la page.
- Les adresses de téléchargement d'Amundi et d'iShares ne sont pas documentées par les émetteurs et peuvent changer sans prévenir.
