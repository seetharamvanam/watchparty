import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDb =
  | ReturnType<typeof drizzlePostgres<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

let prodDb: ReturnType<typeof drizzlePostgres<typeof schema>> | undefined;
let testDb: AppDb | undefined;

export function setTestDb(db: AppDb | undefined) {
  testDb = db;
}

export function getDb(): AppDb {
  if (testDb) {
    return testDb;
  }

  if (!prodDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not configured");
    }
    const client = postgres(url, { max: 10, prepare: false });
    prodDb = drizzlePostgres(client, { schema });
  }

  return prodDb;
}

export { schema };
