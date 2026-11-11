CREATE TABLE "statement_positions" (
	"statement_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"quantity" double precision NOT NULL,
	CONSTRAINT "statement_positions_statement_id_asset_id_pk" PRIMARY KEY("statement_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "statements" ADD COLUMN "cash_cents" bigint;--> statement-breakpoint
ALTER TABLE "statement_positions" ADD CONSTRAINT "statement_positions_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_positions" ADD CONSTRAINT "statement_positions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;