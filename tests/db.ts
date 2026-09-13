import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { setDbOverride, type AppDb } from "@/db";
import * as schema from "@/db/schema";

const MIGRATION_SQL = readFileSync(path.resolve(process.cwd(), "drizzle/0000_init.sql"), "utf8");

export async function createTestDb() {
  const client = new PGlite();
  await client.exec(MIGRATION_SQL);
  const db = drizzle({ client, schema }) as unknown as AppDb;
  setDbOverride(db);
  return client;
}

export function clearTestDb() {
  setDbOverride(undefined);
}
