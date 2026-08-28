/**
 * Standalone index setup script. Run this once when provisioning a new
 * database (dev, staging, prod). It uses the exact same index definitions the
 * app uses at runtime (`src/server/indexes.ts`), so there is a single source
 * of truth.
 *
 * Usage:
 *   npm run db:indexes                       # uses .env.local / .env / process env
 *   MONGODB_URL="..." DB_NAME="..." npm run db:indexes
 *
 * It is idempotent - safe to run repeatedly.
 */
import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/server/indexes";

function loadEnvFiles(): void {
  // Node's built-in dotenv loader (Node >= 20.12). Load .env then .env.local so
  // .env.local wins. Missing files are ignored; in prod the vars are usually
  // already present in process.env.
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file not found or not supported - fine, fall back to process.env
    }
  }
}

async function main(): Promise<void> {
  loadEnvFiles();

  const url = process.env.MONGODB_URL;
  const dbName = process.env.DB_NAME ?? "cluster0";
  if (!url) {
    console.error("Missing MONGODB_URL (set it in .env.local or the environment).");
    process.exit(1);
  }

  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    console.log(`Connected. Ensuring indexes on "${dbName}"...`);
    const result = await ensureIndexes(client.db(dbName));
    for (const [collection, names] of Object.entries(result)) {
      console.log(`  ${collection}: ${names.join(", ")}`);
    }
    console.log("Done. Indexes are up to date.");
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error("Index setup failed:", err);
  process.exit(1);
});
