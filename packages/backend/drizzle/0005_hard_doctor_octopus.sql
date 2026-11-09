ALTER TABLE "loans" ADD COLUMN "share" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "ownership" text DEFAULT 'nom_propre' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "new_build" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "notary_fees_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "agency_fees_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "initial_works_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "other_fees_cents" bigint DEFAULT 0 NOT NULL;