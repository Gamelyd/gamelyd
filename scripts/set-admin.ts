/**
 * Promote (or demote) a user to admin by email. Use this to bootstrap the very
 * first admin, since the in-app admin tools themselves require an existing
 * admin.
 *
 * Usage:
 *   npm run set-admin -- you@example.com            # promote to ADMIN
 *   npm run set-admin -- you@example.com --demote   # back to USER
 */
import { MongoClient } from "mongodb";

function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // ignore missing files; env may already be set
    }
  }
}

async function main(): Promise<void> {
  loadEnvFiles();

  const email = process.argv[2];
  const demote = process.argv.includes("--demote");
  if (!email || email.startsWith("--")) {
    console.error("Usage: npm run set-admin -- <email> [--demote]");
    process.exit(1);
  }

  const url = process.env.MONGODB_URL;
  const dbName = process.env.DB_NAME ?? "cluster0";
  if (!url) {
    console.error("Missing MONGODB_URL (set it in .env.local or the environment).");
    process.exit(1);
  }

  const nextType = demote ? "USER" : "ADMIN";
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const res = await client
      .db(dbName)
      .collection("user")
      .updateOne(
        { email },
        { $set: { user_type: nextType, updated_at: new Date().toISOString() } },
      );

    if (res.matchedCount === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }
    console.log(`${email} is now ${nextType}.`);
    console.log("It takes effect immediately (refresh the app to see the Admin nav link).");
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error("set-admin failed:", err);
  process.exit(1);
});
