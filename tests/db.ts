import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { setDbOverride, type AppDb } from "@/db";
import * as schema from "@/db/schema";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

function loadMigrationSql(): string {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return files.map((name) => readFileSync(path.join(DRIZZLE_DIR, name), "utf8")).join("\n");
}

export async function createTestDb() {
  const client = new PGlite();
  await client.exec(loadMigrationSql());
  const db = drizzle({ client, schema }) as unknown as AppDb;
  setDbOverride(db);
  return client;
}

export function clearTestDb() {
  setDbOverride(undefined);
}
