/**
 * Upload catalog PNGs into Mongo GridFS.
 *
 * Local:
 *   npm run db:ingest-icons
 *
 * Production: use Admin → Upload catalog to database after deploy
 * (the production Mongo is not reachable from outside).
 */
import { MongoClient } from "mongodb";
import { ingestCatalogFromDisk } from "../src/server/iconIngest";

function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // missing file is fine
    }
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const mongoUrl = process.env.MONGODB_URL;
  const dbName = process.env.DB_NAME ?? "cluster0";
  if (!mongoUrl) {
    console.error("Missing MONGODB_URL");
    process.exit(1);
  }

  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const result = await ingestCatalogFromDisk(client.db(dbName));
  console.log(
    `Done. uploaded=${result.uploaded} skipped=${result.skipped} missing=${result.missing} remaining=${result.remaining} catalog=${result.total} source=${result.source}`,
  );
  await client.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
