import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";

import { Lucia } from "lucia";
import { DatabaseUser, db } from "./db.js";
import { sessionTable, userTable } from "./schema.js";

const adapter = new DrizzlePostgreSQLAdapter(db, sessionTable, userTable);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<DatabaseUser, "id">;
  }
}
