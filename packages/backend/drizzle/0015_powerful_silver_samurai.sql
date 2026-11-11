CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"share" double precision DEFAULT 1 NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "share" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "dismemberment" text DEFAULT 'pleine' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "usufruct_birth_date" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "usufruct_end" text;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;