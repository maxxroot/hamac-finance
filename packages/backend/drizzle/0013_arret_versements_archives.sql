-- Les comptes déjà archivés cessent de recevoir leurs versements programmés à partir du mois prochain.
DELETE FROM `contribution_plans`
WHERE `from_month` > strftime('%Y-%m', 'now', '+1 month')
  AND `account_id` IN (SELECT `id` FROM `accounts` WHERE `archived` = 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `contribution_plans` (`id`, `account_id`, `from_month`, `amount_cents`, `comment`)
SELECT lower(hex(randomblob(16))), a.`id`, strftime('%Y-%m', 'now', '+1 month'), 0, 'Compte archivé'
FROM `accounts` a
WHERE a.`archived` = 1
  AND (SELECT p.`amount_cents` FROM `contribution_plans` p WHERE p.`account_id` = a.`id` ORDER BY p.`from_month` DESC LIMIT 1) > 0;
