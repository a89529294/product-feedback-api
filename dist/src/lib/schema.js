import { boolean, integer, pgTable, serial, text, timestamp, } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
    id: text("id").primaryKey(),
    email: text("email").unique(),
    hashedPassword: text("hashed_password"),
    emailVerified: boolean("email_verified"),
    username: text("username"),
    githubId: integer("github_id").unique(),
});
export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
        withTimezone: true,
        mode: "date",
    }).notNull(),
});
export const emailVerificationCodes = pgTable("email_verification_codes", {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", {
        withTimezone: true,
        mode: "date",
    }).notNull(),
});
export const rateLimit = pgTable("rate_limit", {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    attempts: integer("attempts").notNull(),
    firstAttemptTime: timestamp("first_attempt_time", {
        withTimezone: true,
        mode: "date",
    }).notNull(),
});
export const passwordResetTokens = pgTable("password_reset_tokens", {
    id: serial("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
        withTimezone: true,
        mode: "date",
    }).notNull(),
});
