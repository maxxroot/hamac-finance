ALTER TABLE "transactions" ADD COLUMN "fx_rate" double precision;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;