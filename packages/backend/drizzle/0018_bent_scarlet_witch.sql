CREATE TABLE "gifts" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"direction" text NOT NULL,
	"kind" text NOT NULL,
	"person" text NOT NULL,
	"relation" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
