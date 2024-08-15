import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

dotenv.config();

console.log(process.env.DATABASE_URL);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

interface DatabaseUser {
  id: string;
  username: string;
  password_hash: string;
}

export { db, DatabaseUser };
