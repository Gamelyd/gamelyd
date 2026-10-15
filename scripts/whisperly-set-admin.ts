/**
 * Promote (or demote) a Whisperly account to admin by email. Whisperly
 * accounts live in `whisperly_users` (separate from gamelyd users), so this is
 * separate from `npm run set-admin`.
 *
 * Usage:
 *   npm run whisperly:set-admin -- you@example.com            # promote to ADMIN (also grants access)
 *   npm run whisperly:set-admin -- you@example.com --demote   # back to USER
 *
 * Create the account in the Whisperly app first, then run this.
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
  const email = process.argv[2]?.trim().toLowerCase();
  const demote = process.argv.includes("--demote");
  if (!email || email.startsWith("--")) {
    console.error("Usage: npm run whisperly:set-admin -- <email> [--demote]");
    process.exit(1);
  }
  const url = process.env.MONGODB_URL;
  const dbName = process.env.WHISPERLY_DB_NAME || process.env.DB_NAME || "cluster0";
  if (!url) {
    console.error("Missing MONGODB_URL (set it in .env.local or the environment).");
    process.exit(1);
  }
  const now = new Date().toISOString();
  const set = demote
    ? { role: "USER", updated_at: now }
    : { role: "ADMIN", access: "ACTIVE", granted_by: "set-admin script", granted_at: now, updated_at: now };
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const res = await client.db(dbName).collection("whisperly_users").updateOne({ email }, { $set: set });
    if (res.matchedCount === 0) {
      console.error(`No Whisperly account found with email: ${email} (create it in the app first).`);
      process.exit(1);
    }
    console.log(`${email} is now ${demote ? "USER" : "ADMIN (access granted)"}.`);
    console.log("Restart Whisperly or press Check now in the Account window to see the Admin screen.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
