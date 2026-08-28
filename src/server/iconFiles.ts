import "server-only";
import { GridFSBucket } from "mongodb";
import { getDb } from "./db";

const BUCKET = "iconFiles";

async function bucket(): Promise<GridFSBucket> {
  return new GridFSBucket(await getDb(), { bucketName: BUCKET });
}

export async function getIconFile(slug: string): Promise<{
  contentType: string;
  length: number;
  stream: ReturnType<GridFSBucket["openDownloadStream"]>;
} | null> {
  const filesBucket = await bucket();
  const files = await filesBucket.find({ filename: slug }).limit(1).toArray();
  const file = files[0];
  if (!file) return null;
  const meta = file.metadata as { contentType?: string } | undefined;
  return {
    contentType: meta?.contentType || "image/png",
    length: file.length,
    stream: filesBucket.openDownloadStream(file._id),
  };
}

export async function getIconBuffer(slug: string): Promise<{
  contentType: string;
  buffer: Buffer;
} | null> {
  const found = await getIconFile(slug);
  if (!found) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of found.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return { contentType: found.contentType, buffer: Buffer.concat(chunks) };
}

/** Replace or insert a catalog file in GridFS. Filename must match `/api/icons/{slug}`. */
export async function putIconFile(
  slug: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const filesBucket = await bucket();
  const existing = await filesBucket.find({ filename: slug }).toArray();
  for (const file of existing) {
    await filesBucket.delete(file._id);
  }
  await new Promise<void>((resolve, reject) => {
    const upload = filesBucket.openUploadStream(slug, {
      contentType,
      metadata: { contentType },
    });
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(buffer);
  });
}
