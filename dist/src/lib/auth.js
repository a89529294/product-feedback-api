import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { GitHub, Google } from "arctic";
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
            oauthProviderName: attributes.oauthProviderName,
            username: attributes.username,
        };
    },
});
export const github = new GitHub(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET);
export const google = new Google(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, "http://localhost:3000/login/google/callback");
