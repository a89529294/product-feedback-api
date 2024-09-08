ALTER TABLE "rate_limit" ALTER COLUMN "path" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" ALTER COLUMN "attempts" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" ADD COLUMN "first_attempt_time" timestamp with time zone NOT NULL;