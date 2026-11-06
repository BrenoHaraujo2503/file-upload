import { drizzle } from "drizzle-orm/node-postgres";
import { schema } from "./schema";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: Bun.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  idle_in_transaction_session_timeout: 60_000,
});

export const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});
