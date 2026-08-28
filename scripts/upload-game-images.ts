/**
 * Walk a local folder of game art, create each game (no cover), then upload
 * images tagged to that game. The first image in each folder becomes the
 * game cover if it does not already have one.
 *
 * Re-runs skip existing games/images and still tag + fill a missing cover.
 *
 * Local (dev server running):
 *   ADMIN_EMAIL=you@site.com ADMIN_PASSWORD='secret' npm run catalog:upload
 *
 * Production, after deploy:
 *   ADMIN_EMAIL=you@site.com ADMIN_PASSWORD='secret' npm run catalog:upload -- \
 *     --base https://www.gamelyd.co
 *
 * Options:
 *   --dir PATH     Folder of game subfolders (default: ~/Documents/game images)
 *   --base URL     API origin (default: http://localhost:3001)
 *   --only NAME    Only this subfolder (e.g. smite)
 *   --dry-run      Print actions, do not write
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const GAME_NAMES: Record<string, string> = {
  "age of empires 4": "Age of Empires IV",
  "among us": "Among Us",
  ark: "ARK",
  "company of heroes 3": "Company of Heroes 3",
  "counter strike 2": "Counter-Strike 2",
  dayz: "DayZ",
  "dota 2": "Dota 2",
  "dragon ball fighterz": "Dragon Ball FighterZ",
  "escape from tarkov": "Escape from Tarkov",
  f1: "F1",
  "fall guys": "Fall Guys",
  forza: "Forza",
  "gran turismo": "Gran Turismo",
  "guilty gear strive": "Guilty Gear Strive",
  hearthstone: "Hearthstone",
  "heroes of the storm": "Heroes of the Storm",
  "hunt showdown": "Hunt: Showdown",
  iracing: "iRacing",
  "league of legends": "League of Legends",
  "madden nfl": "Madden NFL",
  "magic the gathering arena": "Magic: The Gathering Arena",
  "marvel rivals": "Marvel Rivals",
  minecraft: "Minecraft",
  "mobile legends": "Mobile Legends",
  "mortal kombat 1": "Mortal Kombat 1",
  "overwatch 2": "Overwatch 2",
  pubg: "PUBG",
  "rainbow six siege": "Rainbow Six Siege",
  "rocket league": "Rocket League",
  rust: "Rust",
  smite: "Smite",
  "starcraft 2": "StarCraft II",
  "street fighter 6": "Street Fighter 6",
  "super smash bros ultimate": "Super Smash Bros. Ultimate",
  "team fortress 2": "Team Fortress 2",
  "teamfight tactics": "Teamfight Tactics",
  tekken: "Tekken 8",
  "tekken 8": "Tekken 8",
  "the finals": "The Finals",
  valorant: "Valorant",
  "wild rift": "Wild Rift",
};

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: string };

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function titleCase(folder: string): string {
  return folder
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function gameNameForFolder(folder: string): string {
  const key = folder.trim().toLowerCase();
  return GAME_NAMES[key] ?? titleCase(folder);
}

function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function api<T>(
  base: string,
  token: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const json = (await res.json()) as Ok<T> | Fail;
  if (!json.ok) {
    throw new Error(`${path}: ${json.error} (${res.status})`);
  }
  return json.data;
}

async function main(): Promise<void> {
  const dir =
    arg("--dir") ||
    process.env.CATALOG_DIR ||
    join(homedir(), "Documents", "game images");
  const base = (
    arg("--base") ||
    process.env.CATALOG_BASE_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
  const email = arg("--email") || process.env.ADMIN_EMAIL || "";
  const password = arg("--password") || process.env.ADMIN_PASSWORD || "";
  const only = (arg("--only") || "").trim().toLowerCase();
  const dryRun = hasFlag("--dry-run");

  if (!email || !password) {
    console.error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD, or pass --email and --password.",
    );
    process.exit(1);
  }

  const listing = await readdir(dir, { withFileTypes: true });
  const folders = listing
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !only || name.toLowerCase() === only)
    .sort((a, b) => a.localeCompare(b));

  if (folders.length === 0) {
    console.error(`No game folders in ${dir}`);
    process.exit(1);
  }

  console.log(`Source: ${dir}`);
  console.log(`API:    ${base}`);
  console.log(`Games:  ${folders.length}${dryRun ? " (dry run)" : ""}`);

  if (dryRun) {
    for (const folder of folders) {
      const files = await listImages(join(dir, folder));
      console.log(`  ${gameNameForFolder(folder)}  (${files.length} images)`);
    }
    return;
  }

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = (await loginRes.json()) as Ok<{
    token: string;
    refreshToken: string;
    user_type: string;
  }> | Fail;
  if (!loginJson.ok) {
    console.error(`Login failed: ${loginJson.error}`);
    process.exit(1);
  }
  if (loginJson.data.user_type !== "ADMIN") {
    console.error("That account is not an admin.");
    process.exit(1);
  }

  const token = loginJson.data.refreshToken;
  let createdGames = 0;
  let uploaded = 0;
  let skipped = 0;
  let covers = 0;

  for (const folder of folders) {
    const name = gameNameForFolder(folder);
    const files = await listImages(join(dir, folder));
    const { game, created } = await api<{
      game: { game_id: string; name: string; image: string };
      created: boolean;
    }>(base, token, "/api/admin/catalog/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (created) createdGames += 1;
    console.log(
      `${created ? "created" : "exists "}  ${game.name}  (${files.length} files)`,
    );

    for (const [index, filePath] of files.entries()) {
      const fileName = basename(filePath);
      const bytes = await readFile(filePath);
      const form = new FormData();
      form.set(
        "file",
        new File([bytes], fileName, { type: mimeFor(fileName) }),
      );
      form.set("name", fileName.replace(/\.[^.]+$/, ""));
      form.set("kind", "tournament");
      form.set("gameId", game.game_id);
      if (index === 0) form.set("setCover", "true");

      const result = await api<{
        skipped: boolean;
        coverSet: boolean;
      }>(base, token, "/api/admin/catalog/image", {
        method: "POST",
        body: form,
      });
      if (result.skipped) skipped += 1;
      else uploaded += 1;
      if (result.coverSet) covers += 1;
      console.log(
        `          ${result.skipped ? "skip" : "up  "}  ${fileName}${
          result.coverSet ? "  (cover)" : ""
        }`,
      );
    }
  }

  console.log(
    `\nDone. games created=${createdGames}  uploaded=${uploaded}  skipped=${skipped}  covers set=${covers}`,
  );
}

async function listImages(folder: string): Promise<string[]> {
  const entries = await readdir(folder);
  const files: string[] = [];
  for (const name of entries.sort((a, b) => a.localeCompare(b))) {
    if (!IMAGE_EXT.has(extname(name).toLowerCase())) continue;
    const path = join(folder, name);
    const info = await stat(path);
    if (info.isFile()) files.push(path);
  }
  return files;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
