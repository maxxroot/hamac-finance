ALTER TABLE "assets" ADD COLUMN "issuer_country" text;--> statement-breakpoint
-- Obligations d'État existantes : le pays se lit dans l'ISIN (la dette d'un État porte le code de son pays), sinon l'État français,
-- seul choix possible jusqu'ici.
UPDATE "assets" SET "issuer_country" = CASE
  WHEN substr(upper(coalesce("isin", '')), 1, 2) IN ('AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR', 'CI', 'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FJ', 'FI', 'FR', 'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY', 'HT', 'HN', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IL', 'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO', 'OM', 'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT', 'QA', 'RO', 'RU', 'RW', 'KN', 'LC', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VU', 'VE', 'VN', 'YE', 'ZM', 'ZW') THEN substr(upper("isin"), 1, 2)
  ELSE 'FR'
END
WHERE "kind" = 'obligation' AND "bond_kind" = 'etat';--> statement-breakpoint
-- Le nom généré « OAT … » ne vaut que pour l'État français : on reprend le nom d'usage de la dette des autres États connus.
UPDATE "assets" SET "name" = CASE "issuer_country" WHEN 'BE' THEN 'OLO' WHEN 'DE' THEN 'Bund' WHEN 'IT' THEN 'BTP' ELSE 'Bono' END || substr("name", 4)
WHERE "kind" = 'obligation' AND "bond_kind" = 'etat' AND "issuer_country" IN ('BE', 'DE', 'IT', 'ES') AND "name" LIKE 'OAT %';--> statement-breakpoint
-- Une obligation d'État se désigne désormais par son pays : l'émetteur saisi (souvent « République française » imposé) n'a plus cours.
UPDATE "assets" SET "issuer" = NULL WHERE "kind" = 'obligation' AND "bond_kind" = 'etat';
