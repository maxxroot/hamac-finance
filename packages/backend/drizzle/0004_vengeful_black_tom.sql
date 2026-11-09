CREATE TABLE "tax_statement_amounts" (
	"institution_id" text NOT NULL,
	"year" bigint NOT NULL,
	"box" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "tax_statement_amounts_institution_id_year_box_pk" PRIMARY KEY("institution_id","year","box")
);
--> statement-breakpoint
ALTER TABLE "tax_statement_amounts" ADD CONSTRAINT "tax_statement_amounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;