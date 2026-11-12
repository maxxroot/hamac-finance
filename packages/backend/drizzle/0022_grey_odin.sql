CREATE TABLE "lease_guarantees" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"amount_cents" bigint,
	"until" text,
	"comment" text DEFAULT '' NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_renters" (
	"lease_id" text NOT NULL,
	"renter_id" text NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "lease_renters_lease_id_renter_id_pk" PRIMARY KEY("lease_id","renter_id")
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"surface" double precision,
	"target_rent_cents" bigint,
	"comment" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renters" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"forwarding_address" text DEFAULT '' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "lot_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "rental_mode" text DEFAULT 'vide' NOT NULL;--> statement-breakpoint
UPDATE "properties" p SET "rental_mode" = CASE WHEN l."kind" IN ('vide', 'autre') THEN 'vide' ELSE 'meuble' END FROM (SELECT DISTINCT ON ("property_id") "property_id", "kind" FROM "leases" ORDER BY "property_id", "start_date" DESC) l WHERE l."property_id" = p."id";--> statement-breakpoint
INSERT INTO "lots" ("id", "property_id", "name", "kind") SELECT md5('lot:' || p."id")::uuid::text, p."id", 'Logement', 'logement' FROM "properties" p WHERE p."kind" = 'locatif' OR EXISTS (SELECT 1 FROM "leases" l WHERE l."property_id" = p."id");--> statement-breakpoint
UPDATE "leases" SET "lot_id" = md5('lot:' || "property_id")::uuid::text;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "lot_id" SET NOT NULL;--> statement-breakpoint
INSERT INTO "renters" ("id", "last_name") SELECT DISTINCT ON (lower(btrim("tenant"))) md5('locataire:' || lower(btrim("tenant")))::uuid::text, btrim("tenant") FROM "leases" WHERE btrim("tenant") <> '' ORDER BY lower(btrim("tenant")), "start_date" DESC;--> statement-breakpoint
INSERT INTO "lease_renters" ("lease_id", "renter_id") SELECT "id", md5('locataire:' || lower(btrim("tenant")))::uuid::text FROM "leases" WHERE btrim("tenant") <> '';--> statement-breakpoint
INSERT INTO "lease_guarantees" ("id", "lease_id", "kind", "name") SELECT md5('garantie:' || "id")::uuid::text, "id", 'caution', btrim("guarantor") FROM "leases" WHERE btrim("guarantor") <> '';--> statement-breakpoint
ALTER TABLE "lease_guarantees" ADD CONSTRAINT "lease_guarantees_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renters" ADD CONSTRAINT "lease_renters_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renters" ADD CONSTRAINT "lease_renters_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lease_guarantees_lease_idx" ON "lease_guarantees" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "lease_renters_renter_idx" ON "lease_renters" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "lots_property_idx" ON "lots" USING btree ("property_id");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leases_lot_idx" ON "leases" USING btree ("lot_id");