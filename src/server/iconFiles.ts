import "server-only";
import { GridFSBucket } from "mongodb";
import { getDb } from "./db";

const BUCKET = "iconFiles";

async function bucket(): Promise<GridFSBucket> {
  return new GridFSBucket(await getDb(), { bucketName: BUCKET });
}

export async function getIconFile(slug: string): Promise<{
  contentType: string;
  stream: ReturnType<GridFSBucket["openDownloadStream"]>;
} | null> {
  const filesBucket = await bucket();
  const files = await filesBucket.find({ filename: slug }).limit(1).toArray();
  const file = files[0];
  if (!file) return null;
  return {
    contentType: file.contentType || "image/png",
    stream: filesBucket.openDownloadStream(file._id),
  };
}
