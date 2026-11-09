ALTER TABLE "properties" ADD COLUMN "property_type" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "postal_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "surface" double precision;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "rooms" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "bedrooms" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "floor" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "build_year" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "outdoor" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "parking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "cellar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "heating" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "co_ownership" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "syndic" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "dpe" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "ges" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "dpe_date" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "dpe_reminders" boolean DEFAULT true NOT NULL;