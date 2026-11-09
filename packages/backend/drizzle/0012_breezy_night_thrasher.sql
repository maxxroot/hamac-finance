CREATE TABLE "loan_prepayments" (
	"id" text PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"date" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"mode" text DEFAULT 'duree' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"date" text,
	"expires_on" text,
	"location" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "landlord" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "guarantor" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "tenant_insurance_until" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "deferred_months" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "deferred_kind" text DEFAULT 'partiel' NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_prepayments" ADD CONSTRAINT "loan_prepayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loan_prepayments_loan_idx" ON "loan_prepayments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "property_documents_property_idx" ON "property_documents" USING btree ("property_id");