import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

let prodDb: AppDb | undefined;
let overrideDb: AppDb | undefined;

export function getDb(): AppDb {
  if (overrideDb) {
    return overrideDb;
  }

  if (!prodDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not configured");
    }
    const client = postgres(url, { max: 10, prepare: false });
    prodDb = drizzle(client, { schema });
  }

  return prodDb;
}

/**
 * Used by tests/ only. Production never imports PGlite; callers pass an already-built db.
 */
export function setDbOverride(db: AppDb | undefined) {
  overrideDb = db;
}

export { schema };
