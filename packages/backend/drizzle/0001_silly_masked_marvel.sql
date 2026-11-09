ALTER TABLE "loans" ADD COLUMN "insurance_mode" text DEFAULT 'montant' NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "insurance_rate" double precision DEFAULT 0 NOT NULL;