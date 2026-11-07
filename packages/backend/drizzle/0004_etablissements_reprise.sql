-- Reprise des données avant suppression (écrite à la main) :
-- 1. un établissement par nom saisi sur les comptes, type déduit des comptes, frais repris des paramètres
--    (les frais calculés restent donc identiques) ;
-- 2. rattachement des comptes ;
-- 3. les offres de l'ancienne grille « Choix des plateformes » deviennent des établissements à l'étude.
INSERT INTO `institutions` (`id`, `name`, `kind`, `offers`)
SELECT
  lower(hex(randomblob(16))),
  g.name,
  CASE WHEN g.has_pea OR g.has_cto THEN 'courtier' WHEN g.has_av THEN 'assureur' WHEN g.has_crypto THEN 'crypto' ELSE 'banque' END,
  json_patch(json_patch(json_patch(json_patch(json_patch('{}',
    CASE WHEN g.has_pea THEN json_object('pea', json(b.offer)) ELSE '{}' END),
    CASE WHEN g.has_cto THEN json_object('cto', json(b.offer)) ELSE '{}' END),
    CASE WHEN g.has_av THEN json_object('assurance_vie', json(b.av)) ELSE '{}' END),
    CASE WHEN g.has_crypto THEN json_object('crypto', json_object('tradeFee', b.crypto_fee, 'spread', 0)) ELSE '{}' END),
    CASE WHEN g.has_livret THEN '{"livret":{}}' ELSE '{}' END)
FROM (
  SELECT trim(`institution`) AS name,
    MAX(`kind` = 'pea') AS has_pea, MAX(`kind` = 'cto') AS has_cto, MAX(`kind` = 'assurance_vie') AS has_av,
    MAX(`kind` = 'crypto') AS has_crypto, MAX(`kind` = 'livret') AS has_livret
  FROM `accounts` WHERE trim(`institution`) <> '' GROUP BY trim(`institution`) COLLATE NOCASE
) AS g,
(
  SELECT
    json_object(
      'orderFees', json_object(
        'tiers', json_array(json_object('upTo', NULL, 'fixed', 0, 'rate', coalesce((SELECT json_extract(`value`, '$.broker.feeRate') FROM `settings` WHERE `key` = 'plan.parameters'), 0.005))),
        'min', nullif(coalesce((SELECT json_extract(`value`, '$.broker.minFee') FROM `settings` WHERE `key` = 'plan.parameters'), 0), 0),
        'max', NULL),
      'custodyFixed', 0, 'custodyRate', 0, 'etfWorld', NULL, 'directBonds', NULL, 'programmed', NULL, 'reachableSupport', NULL
    ) AS offer,
    '{"entryFee":0,"euroFee":0,"ucFee":0,"arbitrageFee":0,"euroRateLast":null,"euroRate5y":null,"full100Euro":null,"bonusConditioned":null,"etfWorld":null,"datedFunds":null,"programmedFrom":null,"insurer":""}' AS av,
    coalesce((SELECT json_extract(`value`, '$.crypto.feeRate') FROM `settings` WHERE `key` = 'plan.parameters'), 0) AS crypto_fee
) AS b;
--> statement-breakpoint
UPDATE `accounts` SET `institution_id` = (
  SELECT i.`id` FROM `institutions` i WHERE i.`name` = trim(`accounts`.`institution`) COLLATE NOCASE LIMIT 1
) WHERE trim(`institution`) <> '';
--> statement-breakpoint
INSERT INTO `institutions` (`id`, `name`, `kind`, `score`, `comment`, `offers`)
SELECT
  lower(hex(randomblob(16))),
  c.`name`,
  CASE c.`kind` WHEN 'courtier' THEN 'courtier' ELSE 'assureur' END,
  c.`score`,
  trim(c.`comment` || CASE WHEN c.`values` <> '{}' THEN ' — Ancienne grille : ' || c.`values` ELSE '' END),
  CASE c.`kind`
    WHEN 'courtier' THEN '{"pea":{"orderFees":{"tiers":[{"upTo":null,"fixed":0,"rate":0}],"min":null,"max":null},"custodyFixed":0,"custodyRate":0,"etfWorld":null,"directBonds":null,"programmed":null,"reachableSupport":null},"cto":{"orderFees":{"tiers":[{"upTo":null,"fixed":0,"rate":0}],"min":null,"max":null},"custodyFixed":0,"custodyRate":0,"etfWorld":null,"directBonds":null,"programmed":null,"reachableSupport":null}}'
    ELSE '{"assurance_vie":{"entryFee":0,"euroFee":0,"ucFee":0,"arbitrageFee":0,"euroRateLast":null,"euroRate5y":null,"full100Euro":null,"bonusConditioned":null,"etfWorld":null,"datedFunds":null,"programmedFrom":null,"insurer":""}}'
  END
FROM `comparisons` c;
--> statement-breakpoint
DROP TABLE `comparisons`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `institution`;
