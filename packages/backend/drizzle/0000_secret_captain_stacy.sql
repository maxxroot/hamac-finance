CREATE TABLE "account_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"from_date" text NOT NULL,
	"rate" double precision NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"livret_type" text,
	"name" text NOT NULL,
	"institution_id" text,
	"opened_on" text,
	"deposit_ceiling_cents" bigint,
	"rate" double precision,
	"role" text DEFAULT '' NOT NULL,
	"beneficiary_clause" boolean DEFAULT false NOT NULL,
	"entry_fee_rate" double precision,
	"management_fee_rate" double precision,
	"months_to_invest" bigint,
	"in_allocation" boolean,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"isin" text,
	"symbol" text,
	"price_source" text DEFAULT 'manuel' NOT NULL,
	"price_provider" text,
	"price_url" text,
	"price_path" text,
	"class_id" text,
	"in_allocation" boolean,
	"manual_price" double precision,
	"manual_price_date" text,
	"target_weight" double precision,
	"ter" double precision,
	"coupon_rate" double precision,
	"maturity_date" text,
	"coupon_frequency" bigint,
	"issuer" text,
	"bond_kind" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bond_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"label" text NOT NULL,
	"target_year" bigint NOT NULL,
	"nominal_cents" bigint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"from_month" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_skips" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"month" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crowd_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"rate" double precision,
	"start_date" text NOT NULL,
	"term_months" bigint,
	"repayment" text NOT NULL,
	"status" text DEFAULT 'en_cours' NOT NULL,
	"status_date" text,
	"repaid_capital_cents" bigint,
	"expected_recovery_cents" bigint,
	"in_allocation" boolean,
	"comment" text DEFAULT '' NOT NULL,
	"external_id" text,
	"extended_to" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fund_rates" (
	"account_id" text NOT NULL,
	"year" bigint NOT NULL,
	"rate" double precision NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	CONSTRAINT "fund_rates_account_id_year_pk" PRIMARY KEY("account_id","year")
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"score" double precision,
	"comment" text DEFAULT '' NOT NULL,
	"offers" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'immobilier' NOT NULL,
	"name" text NOT NULL,
	"property_id" text,
	"principal_cents" bigint NOT NULL,
	"rate" double precision NOT NULL,
	"term_months" bigint NOT NULL,
	"first_payment" text NOT NULL,
	"insurance_cents" bigint DEFAULT 0 NOT NULL,
	"manual_payment_cents" bigint,
	"manual_balance_cents" bigint,
	"manual_balance_date" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"year" bigint NOT NULL,
	"amount_cents" bigint NOT NULL,
	"label" text NOT NULL,
	"account_id" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"asset_id" text NOT NULL,
	"date" text NOT NULL,
	"price" double precision NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "prices_asset_id_date_pk" PRIMARY KEY("asset_id","date")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"value_date" text,
	"purchase_price_cents" bigint,
	"purchase_date" text,
	"share" double precision DEFAULT 1 NOT NULL,
	"in_allocation" boolean,
	"class_id" text,
	"comment" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"date" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"account_id" text NOT NULL,
	"asset_id" text,
	"counter_account_id" text,
	"amount_cents" bigint NOT NULL,
	"quantity" double precision,
	"fee_cents" bigint,
	"comment" text DEFAULT '' NOT NULL,
	"external_id" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_rates" ADD CONSTRAINT "account_rates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_plans" ADD CONSTRAINT "bond_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_plans" ADD CONSTRAINT "contribution_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_skips" ADD CONSTRAINT "contribution_skips_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crowd_projects" ADD CONSTRAINT "crowd_projects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_rates" ADD CONSTRAINT "fund_rates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_account_id_accounts_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_rates_account_date_uq" ON "account_rates" USING btree ("account_id","from_date");--> statement-breakpoint
CREATE INDEX "assets_isin_idx" ON "assets" USING btree ("isin");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_account_month_uq" ON "contribution_plans" USING btree ("account_id","from_month");--> statement-breakpoint
CREATE INDEX "skip_account_month_idx" ON "contribution_skips" USING btree ("account_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "crowd_external_uq" ON "crowd_projects" USING btree ("account_id","external_id");--> statement-breakpoint
CREATE INDEX "tx_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "tx_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tx_asset_idx" ON "transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "tx_counter_idx" ON "transactions" USING btree ("counter_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tx_external_uq" ON "transactions" USING btree ("account_id","external_id");