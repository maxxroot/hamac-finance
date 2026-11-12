ALTER TABLE "accounts" ADD COLUMN "default_asset_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "counter_asset_id" text;--> statement-breakpoint
ALTER TABLE "fund_rates" ADD COLUMN "asset_id" text;--> statement-breakpoint
-- Reprise : les espèces d'un contrat d'assurance-vie ou de PER tenaient lieu de fonds euros.
-- Chaque contrat reçoit son fonds euros, qui devient son support par défaut : les opérations sans
-- support y vont, donc les valeurs ne changent pas. Les taux servis passent sur ce fonds.
INSERT INTO "assets" ("id", "kind", "name", "price_source")
  SELECT 'fe-' || "id", 'fonds_euros', 'Fonds euros (' || "name" || ')', 'modele' FROM "accounts" WHERE "kind" IN ('assurance_vie', 'per');--> statement-breakpoint
UPDATE "accounts" SET "default_asset_id" = 'fe-' || "id" WHERE "kind" IN ('assurance_vie', 'per');--> statement-breakpoint
DELETE FROM "fund_rates" WHERE "account_id" NOT IN (SELECT "id" FROM "accounts" WHERE "kind" IN ('assurance_vie', 'per'));--> statement-breakpoint
UPDATE "fund_rates" SET "asset_id" = 'fe-' || "account_id";--> statement-breakpoint
ALTER TABLE "fund_rates" ALTER COLUMN "asset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fund_rates" DROP CONSTRAINT "fund_rates_account_id_year_pk";--> statement-breakpoint
ALTER TABLE "fund_rates" ADD CONSTRAINT "fund_rates_account_id_asset_id_year_pk" PRIMARY KEY("account_id","asset_id","year");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_default_asset_id_assets_id_fk" FOREIGN KEY ("default_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_rates" ADD CONSTRAINT "fund_rates_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_asset_id_assets_id_fk" FOREIGN KEY ("counter_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;
