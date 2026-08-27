import { createReadStream, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GridFSBucket, type Db } from "mongodb";

export const ICON_FILES_BUCKET = "iconFiles";

export type IconIngestResult = {
  uploaded: number;
  skipped: number;
  missing: number;
  remaining: number;
  total: number;
  source: string;
};

export function resolvePublicImagesDir(): string | null {
  const extra = process.env.ICON_SOURCE?.trim();
  const candidates = [
    extra,
    join(process.cwd(), "public/images"),
    join(process.cwd(), "images"),
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function indexPngs(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith(".png")) continue;
      map.set(entry.name.replace(/\.png$/i, ""), full);
    }
  };
  walk(dir);
  return map;
}

async function replaceFile(
  bucket: GridFSBucket,
  slug: string,
  filePath: string,
): Promise<void> {
  const existing = await bucket.find({ filename: slug }).toArray();
  await Promise.all(existing.map((file) => bucket.delete(file._id)));
  await new Promise<void>((resolve, reject) => {
    const upload = bucket.openUploadStream(slug, {
      contentType: "image/png",
      metadata: { slug },
    });
    upload.on("error", reject);
    upload.on("finish", () => resolve());
    createReadStream(filePath).pipe(upload);
  });
}

export async function ingestCatalogFromDisk(
  db: Db,
  options?: { limit?: number },
): Promise<IconIngestResult> {
  const bucket = new GridFSBucket(db, { bucketName: ICON_FILES_BUCKET });
  const icons = await db
    .collection("icon")
    .find({ url: { $not: /^https?:/ } })
    .project({ slug: 1 })
    .toArray();

  const already = new Set(
    (await bucket.find({}).project({ filename: 1 }).toArray())
      .map((file) => String(file.filename ?? ""))
      .filter(Boolean),
  );

  const needed = icons
    .map((icon) => String(icon.slug ?? ""))
    .filter((slug) => slug.length > 0 && !already.has(slug));

  if (needed.length === 0) {
    return {
      uploaded: 0,
      skipped: icons.length,
      missing: 0,
      remaining: 0,
      total: icons.length,
      source: resolvePublicImagesDir() ?? "",
    };
  }

  const source = resolvePublicImagesDir();
  if (!source) {
    throw new Error(
      "Catalog PNG files are not on this server. Deploy with public/images/crests and public/images/tournaments, then try again.",
    );
  }

  const files = indexPngs(source);
  const pending = needed.filter((slug) => files.has(slug));
  const missing = needed.length - pending.length;

  const limit = Math.max(1, options?.limit ?? (pending.length || 1));
  const batch = pending.slice(0, limit);
  let uploaded = 0;

  for (const slug of batch) {
    const filePath = files.get(slug);
    if (!filePath) continue;
    await replaceFile(bucket, slug, filePath);
    uploaded += 1;
  }

  return {
    uploaded,
    skipped: icons.length - needed.length,
    missing,
    remaining: Math.max(0, pending.length - uploaded),
    total: icons.length,
    source,
  };
}
