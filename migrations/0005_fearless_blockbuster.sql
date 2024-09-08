ALTER TABLE "rate-limit" RENAME TO "rate_limit";--> statement-breakpoint
ALTER TABLE "rate_limit" DROP CONSTRAINT "rate-limit_user_id_users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
