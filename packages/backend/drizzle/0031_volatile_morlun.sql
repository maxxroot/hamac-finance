ALTER TABLE "property_expenses" ADD COLUMN "recoverable_rate" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Charges de copropriété déjà saisies : deux tiers récupérables, la valeur proposée par défaut.
UPDATE "property_expenses" SET "recoverable_rate" = 2.0 / 3 WHERE "category" = 'copropriete';
