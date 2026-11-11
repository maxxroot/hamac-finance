CREATE TABLE "other_asset_values" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"date" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "other_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"value_date" text,
	"purchase_price_cents" bigint,
	"purchase_date" text,
	"share" double precision DEFAULT 1 NOT NULL,
	"dismemberment" text DEFAULT 'pleine' NOT NULL,
	"usufruct_birth_date" text,
	"usufruct_end" text,
	"depreciation" double precision,
	"quick_sale_discount" double precision,
	"sale_delay_months" bigint,
	"loan_principal_cents" bigint,
	"loan_rate" double precision,
	"loan_term_months" bigint,
	"loan_first_payment" text,
	"class_id" text,
	"in_allocation" boolean,
	"comment" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "other_asset_values" ADD CONSTRAINT "other_asset_values_asset_id_other_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."other_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "other_asset_values_asset_date_uq" ON "other_asset_values" USING btree ("asset_id","date");