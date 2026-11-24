# Journal : documentation technique

> Pour l'utilisateur : [guide](guide.md).

## Où est le code

| Couche | Fichier | Rôle |
|---|---|---|
| UI, tri | `packages/ui/src/features/journal/lib/dateOrder.ts` | `dateOrderKey` : tri « Date », puis à date égale frais et impôts après les autres opérations (comme `RANK` du moteur), puis ordre de saisie ; dans les deux sens. |
| UI, page | `packages/ui/src/features/journal/pages/Journal.tsx` | Page `/journal` : filtres (y compris `du`, `au`, `filtre` dans l'adresse), tableau trié, export CSV, actions par ligne, saisie pré-remplie par `?nouveau=1&compte=&type=&titre=`. |
| UI, fenêtre | `packages/ui/src/features/journal/dialogs/StatementImportDialog.tsx` | Import d'un relevé : choix du fichier, rôle des colonnes CSV, titres inconnus, aperçu, envoi groupé, mémoire par format. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/TransactionDialog.tsx` | Fenêtre « Nouvelle opération » : champs selon le type, frais suggérés, prix unitaire ↔ total, coupon couru, support fonds euros, arbitrage, titre en devise. Préréglage `NEW_FUND_PRESET`. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/transactionDraft.ts` | Brouillon de la fenêtre : `Draft`, `TxPreset`, `blank` (préréglage), `fromTx` (opération à modifier). |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/FxFields.tsx` | Titre en devise : taux de change (BCE pré-rempli) et total dans la devise ([devises](../devises/technique.md)). |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/AvailableBalanceHint.tsx` | `useAvailableBalance`, `AvailableBalanceHint` : solde disponible sous le montant d'un retrait, bouton « Tout retirer », alerte si le montant le dépasse. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/DepositElsewhere.tsx` | Case « Verser aussi cette somme sur un autre compte » d'un retrait, compte à créditer et son support ; `depositFor` construit le versement. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/BondTradeFields.tsx` | Champs d'un achat ou d'une vente d'obligation : nominal, prix en %, frais, coupon couru (calculé ou saisi), total. |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/ArbitrageFields.tsx` | Champs d'un arbitrage et `arbitrageChoices` (supports proposés). |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/TaxDetailFields.tsx` | Détail fiscal d'un dividende ou d'intérêts (brut, retenues, « Calculer d'après les taux »). |
| UI, saisie partagée | `packages/ui/src/features/entry/dialogs/NewAssetPanel.tsx` | Création d'un titre dans la fenêtre d'opération (« ＋ Nouveau titre »). |
| UI, saisie partagée | `packages/ui/src/features/entry/lib/tradeAmounts.ts` | `syncTradeAmounts` : total depuis le prix unitaire, ou l'inverse ; prix dans la devise d'un titre en devise (`rate`). |
| UI, saisie partagée | `packages/ui/src/features/entry/lib/journal.ts` | `useJournal` (opérations saisies + versements programmés prélevés) et `supportsLabel`. |
| UI, saisie partagée | `packages/ui/src/features/entry/components/Movements.tsx`, `TransactionButton.tsx` | Mouvements d'un ensemble de comptes sur les autres pages ; bouton « Nouvelle opération » pré-réglé. |
| UI, socle | `packages/ui/src/shared/lib/files.ts` | `pickTextFile`, `toCsv`, `downloadText`. |
| UI, socle | `packages/ui/src/shared/lib/queries.ts` | `useSetting` / `useSetSetting` (mémoire de l'import, clé `import.formats`). |
| Cœur, modèle | `packages/core/src/model/domain.ts` | `TX_TYPES`, `TX_LABELS`, `TX_HELP`, `TX_NEEDS_ASSET`, `TX_OPTIONAL_ASSET`, type `Transaction`. |
| Cœur, modèle | `packages/core/src/model/validation.ts` | `validateTransaction`, `ALLOWED_TYPES`, `ALLOWED_ASSETS`, `EURO_FUND_TYPES`. Partagé par la fenêtre et le backend. |
| Cœur, modèle | `packages/core/src/model/schedule.ts` | `Schedule.paidTransactions`, `isScheduled` : versements programmés affichés au journal. |
| Cœur, modèle | `packages/core/src/model/institutions.ts` | `tradeFeeFor`, `suggestTradeFee`, `suggestOrderFee`, `grossFromNet`. |
| Cœur, fiscalité | `packages/core/src/tax/taxReport.ts` | `institutionWithholding` : taux de retenue pour « Calculer d'après les taux ». |
| Cœur, import | `packages/core/src/imports/csv.ts` | `parseCsv`, `parseAmount`, `parseDate`, `guessType`. |
| Cœur, import | `packages/core/src/imports/statementImport.ts` | `detectFormat`, `parseOfx`, `parseQif`, `findHeaderRow`, `guessRoles`, `completeRoles`, `linesFromCsv`, `buildImport`. `guessAssetKind` (dans `csv.ts`) lit la classe d'un titre (« STOCK », « ETF », « BOND »…). |
| Cœur, portefeuille | `packages/core/src/portfolio/engine.ts` | `computePortfolio` : effet de chaque type d'opération (ordre `RANK`). |
| Cœur, portefeuille | `packages/core/src/portfolio/available.ts` | `availableBalance` : argent disponible pour un retrait à une date, espèces ou fonds euros. |
| Contrat | `packages/api/src/journal/procedures.ts`, `packages/api/src/journal/inputs.ts` | Procédures du journal ; `TransactionInput`, `PlanInput`, `SkipInput`. |
| Backend | `packages/backend/src/handlers/journal.ts` | Handlers des opérations, de l'import groupé, des plans et des mois manqués. |
| Backend | `packages/backend/src/db/schema/journal.ts` | Tables `transactions`, `contribution_plans`, `contribution_skips`. |
| Backend | `packages/backend/src/repo/mappers/journal.ts` | `mapTx`, `mapPlan`, `mapSkip` (centimes → euros). |

## Données

### Table `transactions`

`id`, `date`, `type`, `account_id`, `asset_id`, `counter_account_id` (transfert), `counter_asset_id` (fonds d'arrivée d'un transfert, support reçu d'un arbitrage), `counter_quantity` (arbitrage), `amount_cents`, `quantity`, `fee_cents`, `accrued_cents` (obligation : coupon couru saisi à la main, null = calculé), `comment`, `external_id` (index unique avec `account_id`), `gross_cents`, `withheld_income_tax_cents`, `withheld_social_cents`, `withheld_foreign_cents`, horodatage. Clés étrangères en `restrict` vers `accounts` et `assets`.

### Procédures

| Procédure | Entrée | Effet |
|---|---|---|
| `transactions.upsert` | `TransactionInput` | Valide avec `validateTransaction`, crée ou met à jour. Erreur `VALIDATION` avec la liste des champs, `NOT_FOUND` si l'id n'existe pas. |
| `transactions.delete` | `{ id }` | Supprime. |
| `transactions.createWithAsset` | `{ asset, transaction }` | Crée le titre (`assets.upsert`) puis l'opération, dans une seule transaction SQL. |
| `transactions.createWithdrawalAndDeposit` | `{ withdrawal, deposit }` | Retrait puis versement sur un autre compte, dans une seule transaction SQL (chacun par `transactions.upsert`). Le `created_at` du versement est celui du retrait + 1 ms : dans une même transaction, `now()` donne le même instant aux deux. `VALIDATION` si l'un a un id, si les types ne sont pas `retrait` puis `versement`, si le compte est le même, ou si la date ou le montant diffèrent. |
| `transactions.bulkCreate` | `{ items }` (1 à 5 000) | Valide chaque ligne, insère les valides dans une seule transaction SQL, renvoie `{ created, errors: [{ index, message }] }`. Sert à l'import de relevés et à `DeclareInterestDialog` (crowdlending). |
| `skips.upsert` | `SkipInput` | Bouton « mois manqué » d'une ligne programmée. |
| `assets.upsert` | `AssetInput` | Création d'un titre inconnu depuis l'aperçu d'import. |
| `settings.get` / `settings.set` | clé `import.formats` | Mémoire de l'import : `{ [clé]: { roles?, accountId?, defaultType? } }`, clé `csv:<en-têtes en minuscules joints par |>` ou `ofx:<4 derniers caractères du numéro de compte>`. Le QIF n'a pas de clé. |

### Champs du `Workspace` utilisés

`transactions`, `accounts`, `assets`, `plans`, `skips`, `institutions`, `params` (`profile.startMonth`, `profile.contributionDay`, `broker`, `crypto`, taux de retenue).

## Règles de calcul

### Conventions

Voir `docs/architecture/modele-de-donnees.md`. Montants positifs, le type donne le sens ; seule la correction peut être négative (jamais nulle). Achat = total débité frais compris ; vente = net reçu. Transfert en une seule ligne. Dividende et intérêts : `amount` = net crédité, brut et retenues facultatifs.

### Validation (`validateTransaction`)

- Le type doit figurer dans `ALLOWED_TYPES[account.kind]`. L'arbitrage n'existe que pour `assurance_vie`, `per`, `epargne_salariale` et `crypto` ; l'achat et la vente n'existent pas sur un livret ni en crowdlending.
- Achat et vente exigent un titre et une quantité > 0 ; le titre doit être dans `ALLOWED_ASSETS[account.kind]`, et un fonds euros seulement dans un compte qui en détient (`holdsEuroFunds` : assurance-vie et PER non bancaire).
- Intérêts et dividende acceptent un titre facultatif. Les autres types refusent un titre, sauf un fonds euros pour les types de `EURO_FUND_TYPES` (apport, versement, retrait, intérêts, transfert, frais, impôts, correction). Un fonds euros ne s'achète ni ne se vend.
- Transfert : destination obligatoire, différente, existante ; `counterAssetId` éventuel = un fonds euros d'un compte qui en détient. Aucun autre type n'a de destination.
- Arbitrage (`arbitrageErrors`) : deux supports différents, détenables dans le compte, jamais une obligation ; quantité > 0 pour un titre, aucune pour un fonds euros. Seul un arbitrage a `counterQuantity`.
- Brut et retenues : seulement sur un revenu ; brut ≥ montant − 0,01 €.
- Frais : seulement sur achat, vente ou arbitrage, et strictement inférieurs au montant.

### Saisie (fenêtre d'opération)

- Frais suggérés tant que `feeManual` est faux. `tradeFeeFor` : grille crypto de l'établissement pour une plateforme crypto, grille PEA (PEA et PEA-PME) ou compte-titres de l'établissement, sinon « Frais par défaut » (`params.broker`, `params.crypto`). Sur un total saisi, `suggestTradeFee` extrait les frais inclus ; sur un prix unitaire, `suggestOrderFee` les calcule sur l'ordre.
- `syncTradeAmounts` : total = quantité × prix ÷ `per` + coupon couru ± frais (`per` = 100 pour une obligation, prix en % du nominal) ; ou prix = (total ∓ frais − coupon couru) × `per` ÷ quantité, arrondi à 6 décimales.
- Coupon couru d'une obligation : `quantity × accruedFraction(terms, date)`, arrondi au centime, sauf s'il est saisi (`Draft.accrued` non nul, envoyé comme `accrued`). Vider le champ ou « Calculer » remet `accrued` à null. `validateTransaction` le refuse hors achat ou vente d'une obligation, négatif, ou s'il dépasse le montant une fois les frais comptés.
- Le champ « Support » n'apparaît que pour un compte qui détient des fonds euros et un type de `EURO_FUND_TYPES`. Vide = `assetId` nul : le moteur prend le fonds par défaut du contrat.
- Le détail fiscal n'est proposé que pour un dividende ou des intérêts sur un compte `cto` ou `crowdlending`. « Calculer d'après les taux » appelle `grossFromNet(net, institutionWithholding(…))`. Un écart ≥ 0,02 € entre brut − retenues et net est signalé.
- Retrait : `availableBalance(data, compte, date, { supportId, excludeTxId })` calcule le portefeuille à la date de l'opération (`computePortfolio`), sans l'opération en cours de modification. Les opérations du même jour comptent : un retrait passe en dernier dans la journée (`RANK`). Versements programmés compris. Dans un contrat, c'est la valeur du fonds euros choisi, sinon du fonds par défaut (même choix que `moveMoney`) ; sinon les espèces. « Tout retirer » recopie ce montant ; un montant supérieur affiche un avertissement, sans bloquer l'envoi. Rien n'est affiché pendant la création d'un nouveau fonds euros.
- Champs numériques (`NumberInput`, donc `MoneyInput` et `PercentInput`) : une saisie qui commence par « = » est un calcul (`readTypedNumber`, `evaluateExpression` dans `packages/ui/src/shared/lib/expression.ts`) : + − × ÷, parenthèses, virgule ou point, lu pas à pas sans `eval` (la CSP l'interdit de toute façon). Le résultat, arrondi à `decimals`, part à chaque frappe ; un calcul incomplet, impossible ou négatif sans `allowNegative` garde la valeur précédente. À la sortie du champ, le texte devient le résultat : le calcul n'est pas conservé. Sur mobile, `inputMode="decimal"` n'offre pas toujours les touches = et +.
- Retrait avec versement : proposé à la création seulement, et pas pendant la création d'un fonds euros. Le versement (`depositFor`) reprend la date, le montant et le commentaire du retrait ; il est validé par `validateTransaction` comme le retrait (compte vide ou support refusé : rien n'est envoyé). Envoi par `transactions.createWithdrawalAndDeposit`. Les deux opérations ne sont pas liées ensuite : modifier ou supprimer l'une ne touche pas l'autre.
- Un titre ou un fonds euros à créer est validé comme s'il existait, sous l'identifiant provisoire `__nouveau__`, puis envoyé par `transactions.createWithAsset`.

### Effet dans le moteur (`computePortfolio`)

Ordre dans une même journée (`RANK`) : apport, versement, transfert, intérêts, dividende, correction, vente, arbitrage, achat, retrait, frais, impôts. Apport, versement, retrait et transfert changent le versé net ; intérêts, dividendes, frais, impôts et corrections non. Dans un contrat, l'argent sans support précisé va au fonds euros par défaut (`moveMoney`), sinon aux espèces. Un achat sort l'argent du même endroit. Un arbitrage n'est pas une cession (`Disposal`) : le support reçu prend la valeur de l'échange comme prix de revient ; vers un fonds euros, les frais sont déduits.

### Versements programmés au journal

`Schedule.paidTransactions(today)` produit une opération `versement` par compte et par mois prélevé, d'id `programme:<compte>:<mois>`, datée du jour de prélèvement (`dayOfMonth`, ramené au dernier jour des mois courts), pour le montant prévu moins les mois manqués. Ces lignes ne sont jamais enregistrées. Le bouton « mois manqué » envoie `skips.upsert` avec le montant de la ligne.

### Import de relevés (`buildImport`)

1. **Lecture.** `detectFormat` : extension `.ofx`/`.qfx` ou balise `<OFX>` → OFX ; `.qif` ou `!Type:` → QIF ; sinon CSV. CSV : séparateur `;`, tabulation ou `,` (celui qui découpe le plus de lignes en un même nombre de colonnes), ligne d'en-tête trouvée après un éventuel préambule (`findHeaderRow`), rôles devinés par `guessRoles` : une colonne qui porte le rôle en propre passe avant une colonne approchée (« date » avant « datetime », « type » avant « Type d'opération », « amount » avant « original_amount »), la date d'opération avant la date de valeur, et une colonne qui parle du compte ou de la contrepartie (« account_type », « counterparty_name ») n'a pas de rôle. Rôles reconnus en plus du libellé : nom du titre (« name », « nom »), ISIN ou symbole, quantité (« shares »), type de titre (« asset_class », « classe »). Une correspondance mémorisée pour ce format est complétée par `completeRoles` avec les rôles qu'elle n'a pas encore. OFX : mouvements `STMTTRN` et opérations sur titres (`BUY*`, `SELL*`, `INCOME`), ISIN depuis `UNIQUEID`. QIF : un achat ou des frais d'un relevé de titres deviennent négatifs.
2. **Type.** En mode automatique, `guessType(libellé, montant)`. Si le fichier contient au moins un débit, `matchSign` corrige un type contredit par le signe (frais ou impôts crédités → correction ; autre sortie créditée → versement ; intérêts ou dividende débités → frais ; autre entrée débitée → retrait). Un type interdit sur le compte devient retrait ou versement.
3. **Titre.** Recherché par ISIN (colonne ou libellé), puis par nom exact, puis par nom contenu (clé de plus de 3 caractères), parmi les titres non archivés. Une association manuelle (`assetOverrides`) prime. Un titre introuvable rend la ligne invalide ; il est proposé à la création avec le nom et le type lus dans le fichier (`unknownAsset.kind`), une obligation exceptée (ses caractéristiques se saisissent ailleurs).
4. **État.** `erreur` si la date, le montant ou la validation échoue. `doublon` si un versement ou retrait correspond à un transfert du journal (même sens, même montant à 0,005 € près, ±3 jours), ou si la clé `date|type|centimes|titre` existe au journal pour ce compte (chaque opération existante n'excuse qu'une ligne). `programme` si un versement égale le montant programmé d'un mois déjà prélevé (une fois par mois). Sinon `ok`.

Les lignes cochées partent par `transactions.bulkCreate`. Le compte rendu affiche `created` et « lignes non importées » = total des lignes − `created`.

## Tests

- `packages/core/src/model/validation.test.ts` : règles de `validateTransaction`.
- `packages/core/src/portfolio/euroFunds.test.ts` (bloc « validation des opérations ») et `packages/core/src/portfolio/arbitrage.test.ts` : fonds euros et arbitrages.
- `packages/core/src/portfolio/available.test.ts` : solde disponible (date, même jour, opération modifiée, fonds euros, versements programmés).
- `packages/core/src/portfolio/engine.test.ts` : effet des opérations (transfert, vente au-delà du détenu, coupons…).
- `packages/core/src/model/schedule.test.ts` : opérations programmées au journal.
- `packages/core/src/imports/csv.test.ts`, `packages/core/src/imports/statementImport.test.ts` : lecture des formats, doublons, programmés, titres, signe.
- `packages/ui/src/features/entry/lib/tradeAmounts.test.ts` : prix unitaire ↔ total.
- `packages/ui/src/shared/lib/expression.test.ts` : calculs « = » (priorités, parenthèses, saisies incomplètes, arrondi).
- `packages/backend/src/handlers/journal.test.ts` : retrait et versement ensemble (même commentaire, versement créé après le retrait, tout ou rien, refus des incohérences).
- `packages/ui/src/features/journal/lib/dateOrder.test.ts` : à date égale, frais et impôts après l'action, puis ordre de saisie, dans les deux sens de tri.
- `packages/backend/src/backend.test.ts` : import groupé (lignes valides, erreurs par ligne, brut et retenues conservés), achat avec création du titre.
- `packages/ui/src/flows/suivi.flow.test.tsx` : blocs « journal », « fenêtre de saisie d'une opération », « mouvements d'un compte ».
- `packages/ui/src/flows/reglages.flow.test.tsx` (« import d'un relevé ») et `packages/ui/src/flows/flows.test.tsx` (import, puis doublon au second passage).

## Limites connues

- Un retrait et le versement enregistré avec lui ne gardent aucun lien : les modifier ou les supprimer se fait opération par opération.

- `transactions.bulkCreate` n'insère ni `counter_asset_id`, ni `counter_quantity`, ni `external_id` : un arbitrage, ou un transfert vers un fonds euros précis, envoyé par cette procédure perdrait ces champs. L'import de relevés n'en produit pas (pas de transfert, arbitrage refusé faute de support reçu), mais rien ne l'empêche au niveau du contrat.
- L'import ne se sert pas de `external_id` : la détection des doublons repose sur la clé `date|type|montant|titre`. Deux opérations réellement distinctes mais identiques sur ces quatre points sont prises pour un doublon si l'une est déjà au journal.
- L'aperçu est limité à 300 lignes (`PREVIEW_LIMIT`), mais `selected` porte sur toutes les propositions : les lignes au-delà partent selon leur état par défaut.
- L'export CSV part de `rows` (filtré, non trié) et n'a pas de colonnes pour `counterAssetId`, `counterQuantity`, ni le détail fiscal.
- La recherche ne lit que `assetId`, pas `counterAssetId`.
- Pour une assurance-vie, un PER ou l'épargne salariale, `tradeFeeFor` retombe sur les frais par défaut : la grille de l'établissement n'est pas lue pour les achats d'unités de compte.
- Le bouton « mois manqué » déclare le montant de la ligne, donc le mois entier ; un montant partiel passe par la page Versements.
