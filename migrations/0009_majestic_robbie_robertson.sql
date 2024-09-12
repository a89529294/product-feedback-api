ALTER TABLE "rate_limit" RENAME COLUMN "user_id" TO "email";--> statement-breakpoint
ALTER TABLE "rate_limit" DROP CONSTRAINT "rate_limit_user_id_users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_email_users_email_fk" FOREIGN KEY ("email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "rate_limit" DROP COLUMN IF EXISTS "path";