ALTER TABLE "institutions" ADD COLUMN "tax" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "gross_cents" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "withheld_income_tax_cents" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "withheld_social_cents" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "withheld_foreign_cents" bigint;