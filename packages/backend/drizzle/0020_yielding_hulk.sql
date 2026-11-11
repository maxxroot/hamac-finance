CREATE TABLE "goal_allocations" (
	"goal_id" text NOT NULL,
	"account_id" text NOT NULL,
	"mode" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "goal_allocations_goal_id_account_id_pk" PRIMARY KEY("goal_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"target_cents" bigint NOT NULL,
	"target_date" text NOT NULL,
	"start_date" text NOT NULL,
	"rate" double precision DEFAULT 0 NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD CONSTRAINT "goal_allocations_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD CONSTRAINT "goal_allocations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;