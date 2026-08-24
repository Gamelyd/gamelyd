import "server-only";
import { ObjectId } from "mongodb";
import { platforms } from "../db";
import type { PlatformDoc } from "../documents";
import { serializePlatform } from "../serialize";
import { ServiceError } from "./userService";
import type {
  CreatePlatformInput,
  Platform,
  UpdatePlatformInput,
} from "@/lib/schemas/platform";

export async function listPlatforms(activeOnly = false): Promise<Platform[]> {
  const col = await platforms();
  const filter = activeOnly ? { active: { $ne: false } } : {};
  const docs = await col.find(filter).sort({ name: 1 }).limit(500).toArray();
  return docs.map(serializePlatform);
}

export async function createPlatform(
  input: CreatePlatformInput,
): Promise<Platform> {
  const col = await platforms();
  const exists = await col.countDocuments({
    name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
  });
  if (exists > 0) {
    throw new ServiceError("A platform with that name already exists");
  }

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const doc: PlatformDoc = {
    _id,
    platform_id: _id.toHexString(),
    name: input.name.trim(),
    active: input.active,
    created_at: now,
    updated_at: now,
  };
  await col.insertOne(doc);
  return serializePlatform(doc);
}

export async function updatePlatform(
  platformId: string,
  input: UpdatePlatformInput,
): Promise<Platform> {
  const col = await platforms();
  if (input.name) {
    const taken = await col.countDocuments({
      name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
      platform_id: { $ne: platformId },
    });
    if (taken > 0) {
      throw new ServiceError("A platform with that name already exists");
    }
  }

  const updated = await col.findOneAndUpdate(
    { platform_id: platformId },
    { $set: { ...input, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Platform not found");
  return serializePlatform(updated);
}

export async function togglePlatformActive(
  platformId: string,
): Promise<boolean> {
  const col = await platforms();
  const found = await col.findOne({ platform_id: platformId });
  if (!found) throw new ServiceError("Platform not found");
  const next = !found.active;
  await col.updateOne(
    { platform_id: platformId },
    { $set: { active: next, updated_at: new Date().toISOString() } },
  );
  return next;
}

export async function deletePlatform(platformId: string): Promise<void> {
  const col = await platforms();
  const res = await col.deleteOne({ platform_id: platformId });
  if (res.deletedCount === 0) throw new ServiceError("Platform not found");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
