CREATE TABLE IF NOT EXISTS "oauth_accounts" (
	"provider_name" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "oauth_accounts_provider_name_provider_user_id_pk" PRIMARY KEY("provider_name","provider_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_github_id_unique";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "github_id";