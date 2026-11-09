ALTER TABLE "lease_rents" ADD COLUMN "revision_anniversary" text;--> statement-breakpoint
ALTER TABLE "lease_rents" ADD COLUMN "revision_demand_date" text;--> statement-breakpoint
ALTER TABLE "lease_rents" ADD COLUMN "revision_previous_rent_cents" bigint;--> statement-breakpoint
ALTER TABLE "lease_rents" ADD COLUMN "revision_quarter_new" text;--> statement-breakpoint
ALTER TABLE "lease_rents" ADD COLUMN "revision_quarter_old" text;--> statement-breakpoint
ALTER TABLE "lease_rents" ADD COLUMN "revision_index_new" double precision;--> statement-breakpoint
ALTER TABLE "lease_rents" ADD COLUMN "revision_index_old" double precision;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "revisable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "irl_quarter" bigint;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "landlord_address" text DEFAULT '' NOT NULL;