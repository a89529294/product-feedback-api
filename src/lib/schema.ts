import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
});

export const sessionTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export type User = typeof userTable.$inferSelect;
export type NewUser = typeof userTable.$inferInsert;
