/**
 * Delete GridFS catalog files that no longer have an Admin → Images row.
 * Admin delete only removed the record, so those bytes still sit on Atlas.
 *
 * Usage (from gamelyd/):
 *   npm run catalog:prune-orphans           # list orphans, do not delete
 *   npm run catalog:prune-orphans -- --apply
 */
import { GridFSBucket, MongoClient } from "mongodb";

const BUCKET = "iconFiles";

function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // missing file is fine
    }
  }
}

function slugFromUrl(url: string): string {
  const match = url.trim().match(/\/api\/icons\/([^/?#]+)/);
  return match?.[1] ?? "";
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  loadEnvFiles();
  const apply = process.argv.includes("--apply");
  const url = process.env.MONGODB_URL;
  const dbName = process.env.DB_NAME ?? "cluster0";
  if (!url) {
    console.error("Missing MONGODB_URL (set it in .env.local).");
    process.exit(1);
  }

  const client = new MongoClient(url, { serverSelectionTimeoutMS: 15_000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const icons = await db
      .collection("icon")
      .find({}, { projection: { slug: 1, url: 1 } })
      .toArray();

    const keep = new Set<string>();
    for (const icon of icons) {
      const slug = typeof icon.slug === "string" ? icon.slug.trim() : "";
      const fromUrl =
        typeof icon.url === "string" ? slugFromUrl(icon.url) : "";
      if (slug) keep.add(slug);
      if (fromUrl) keep.add(fromUrl);
    }

    const files = await db
      .collection(`${BUCKET}.files`)
      .find({}, { projection: { filename: 1, length: 1 } })
      .toArray();

    const orphans = files.filter((file) => {
      const name = typeof file.filename === "string" ? file.filename : "";
      return name.length > 0 && !keep.has(name);
    });
    const orphanBytes = orphans.reduce(
      (sum, file) => sum + (typeof file.length === "number" ? file.length : 0),
      0,
    );

    console.log(`Database: ${dbName}`);
    console.log(`Catalog rows: ${icons.length}`);
    console.log(`GridFS files: ${files.length}`);
    console.log(`Orphans: ${orphans.length} (${mb(orphanBytes)})`);

    if (orphans.length === 0) {
      console.log("Nothing to delete.");
      return;
    }

    orphans.sort(
      (a, b) =>
        (typeof b.length === "number" ? b.length : 0) -
        (typeof a.length === "number" ? a.length : 0),
    );
    for (const file of orphans) {
      const size =
        typeof file.length === "number" ? mb(file.length) : "?";
      console.log(`  ${file.filename}  ${size}`);
    }

    if (!apply) {
      console.log("Dry run. Re-run with --apply to delete those GridFS files.");
      return;
    }

    const bucket = new GridFSBucket(db, { bucketName: BUCKET });
    let removed = 0;
    let failed = 0;
    for (const file of orphans) {
      try {
        await bucket.delete(file._id);
        removed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  failed ${file.filename}: ${message}`);
      }
    }
    console.log(`Deleted ${removed} file(s). Failed: ${failed}.`);
    if (failed > 0) {
      console.error(
        "If Atlas says the cluster is over quota, writes (including deletes) may still be blocked. Free a little space in Atlas, then run --apply again.",
      );
      process.exit(1);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error("Prune failed:", error);
  process.exit(1);
});
