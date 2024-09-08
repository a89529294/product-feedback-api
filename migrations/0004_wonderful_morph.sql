CREATE TABLE IF NOT EXISTS "rate-limit" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"path" text,
	"attempts" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rate-limit" ADD CONSTRAINT "rate-limit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
