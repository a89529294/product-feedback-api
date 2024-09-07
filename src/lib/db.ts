import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

interface DatabaseUser {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
}

export { db, DatabaseUser };
