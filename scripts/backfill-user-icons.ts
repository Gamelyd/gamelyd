/**
 * Give a random player icon to accounts that never got one.
 *
 * New accounts pick an icon at registration, but anyone who signed up before
 * that was stored with an empty `icon`. Those accounts fall back to the single
 * default on any screen that cannot derive one from a user id - the
 * leaderboards especially, where every one of them shows the same token.
 *
 * Usage:
 *   npm run backfill:icons              # dry run, reports what it would change
 *   npm run backfill:icons -- --apply   # actually writes
 *
 * Safe to run repeatedly: it only touches accounts whose icon is still empty,
 * and never overwrites an icon somebody chose.
 */
import { MongoClient } from "mongodb";
import { Collections } from "../src/server/collections";
import { PLAYER_ICONS, FALLBACKS, type AppIcon } from "../src/lib/icons";

function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Not present, so rely on the ambient environment.
    }
  }
}

function pick(pool: AppIcon[]): string {
  if (pool.length === 0) return FALLBACKS.player;
  return pool[Math.floor(Math.random() * pool.length)]?.url ?? FALLBACKS.player;
}

async function main(): Promise<void> {
  loadEnvFiles();
  const apply = process.argv.includes("--apply");

  const url = process.env.MONGODB_URL;
  if (!url) {
    console.error("Missing MONGODB_URL (set it in .env.local or the environment).");
    process.exit(1);
  }

  const client = new MongoClient(url);
  await client.connect();
  try {
    const db = client.db(process.env.DB_NAME ?? "cluster0");

    const catalogue = await db
      .collection(Collections.icon)
      .find({ kind: "player", archived: { $ne: true } })
      .toArray();
    const pool: AppIcon[] =
      catalogue.length > 0
        ? catalogue.map((doc) => ({
            id: String(doc.icon_id),
            label: String(doc.name),
            url: String(doc.url),
          }))
        : PLAYER_ICONS;

    const users = db.collection(Collections.user);
    const blank = {
      $or: [
        { icon: "" },
        { icon: { $exists: false } },
        { icon: null },
      ],
    };
    const targets = await users.find(blank).project({ user_id: 1 }).toArray();

    console.log(`icon pool:            ${pool.length}`);
    console.log(`accounts without one: ${targets.length}`);

    if (targets.length === 0) {
      console.log("Nothing to do.");
      return;
    }
    if (!apply) {
      console.log("\nDry run. Re-run with --apply to write these changes.");
      return;
    }

    let changed = 0;
    for (const target of targets) {
      const icon = pick(pool);
      // Both spellings: older documents carry `Icon`, current ones `icon`.
      const res = await users.updateOne(
        { _id: target._id, ...blank },
        { $set: { icon, Icon: icon, updated_at: new Date().toISOString() } },
      );
      changed += res.modifiedCount;
    }
    console.log(`\nUpdated ${changed} account${changed === 1 ? "" : "s"}.`);
  } finally {
    await client.close();
  }
}

void main();
