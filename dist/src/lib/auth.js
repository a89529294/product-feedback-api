import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia } from "lucia";
import { db } from "./db.js";
import { sessions, users } from "./schema.js";
const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);
export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            // secure: process.env.NODE_ENV === "production",
            secure: true,
            sameSite: "none",
        },
    },
    getUserAttributes: (attributes) => {
        return {
            email: attributes.email,
            emailVerified: attributes.emailVerified,
        };
    },
});
