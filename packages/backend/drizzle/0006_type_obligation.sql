ALTER TABLE `assets` ADD `bond_kind` text;--> statement-breakpoint
-- Reprise : les obligations dont l'émetteur est l'État français sont des OAT.
UPDATE `assets` SET `bond_kind` = CASE WHEN lower(coalesce(`issuer`, '')) LIKE '%publique fran%' OR lower(`name`) LIKE 'oat%' THEN 'etat' ELSE 'entreprise' END WHERE `kind` = 'obligation';
