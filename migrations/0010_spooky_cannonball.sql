ALTER TABLE "rate_limit" RENAME COLUMN "email" TO "ip";--> statement-breakpoint
ALTER TABLE "rate_limit" DROP CONSTRAINT "rate_limit_email_users_email_fk";
