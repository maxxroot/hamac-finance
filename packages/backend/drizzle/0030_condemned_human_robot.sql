ALTER TABLE "accounts" ADD COLUMN "per_kind" text;--> statement-breakpoint
-- Les PER existants ont reçu un fonds euros (migration 0028) : ils sont assurantiels.
UPDATE "accounts" SET "per_kind" = 'assurantiel' WHERE "kind" = 'per';
