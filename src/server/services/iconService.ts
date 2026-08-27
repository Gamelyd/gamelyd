import "server-only";
import { ObjectId } from "mongodb";
import { icons, getDb } from "../db";
import { ingestCatalogFromDisk } from "../iconIngest";
import type { IconDoc, IconKind } from "../documents";
import { serializeIcon } from "../serialize";
import { ServiceError } from "./userService";
import {
  FALLBACKS,
  catalogToAppIcon,
  pickStableIcon,
  type AppIcon,
} from "@/lib/icons";
import type {
  CreateIconInput,
  IconAsset,
  UpdateIconInput,
} from "@/lib/schemas/icon";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "icon";
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const col = await icons();
  let slug = base;
  let n = 2;
  while (true) {
    const taken = await col.findOne({
      slug,
      ...(excludeId ? { icon_id: { $ne: excludeId } } : {}),
    });
    if (!taken) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

type IconQuery = {
  kind?: IconKind;
  gameId?: string;
  search?: string;
  includeArchived?: boolean;
};

export async function listIcons(input: IconQuery = {}): Promise<IconAsset[]> {
  const col = await icons();
  const filter: Record<string, unknown> = {};
  if (input.kind) filter.kind = input.kind;
  if (!input.includeArchived) filter.archived = { $ne: true };

  const docs = await col.find(filter).sort({ name: 1 }).limit(500).toArray();
  return filterCatalog(docs.map(serializeIcon), input);
}

function filterCatalog(items: IconAsset[], input: IconQuery): IconAsset[] {
  let next = items;
  const search = input.search?.trim().toLowerCase();
  if (search) {
    next = next.filter((icon) => icon.name.toLowerCase().includes(search));
  }
  if (input.gameId && input.kind === "tournament") {
    const tagged = next.filter((icon) => icon.gameIds.includes(input.gameId!));
    if (tagged.length > 0) return tagged;
    return next.filter((icon) => icon.gameIds.length === 0);
  }
  return next;
}

export async function listAppIcons(
  kind: IconKind,
  gameId?: string,
): Promise<AppIcon[]> {
  const items = await listIcons({
    kind,
    gameId,
    includeArchived: false,
  });
  return items.map(catalogToAppIcon);
}

export async function playerIconForUser(userId: string): Promise<string> {
  const iconsList = await listAppIcons("player");
  return pickStableIcon(iconsList, userId, FALLBACKS.player);
}

export async function getIconById(iconId: string): Promise<IconAsset | null> {
  const col = await icons();
  const found = await col.findOne({ icon_id: iconId });
  return found ? serializeIcon(found) : null;
}

export async function createIcon(input: CreateIconInput): Promise<IconAsset> {
  const col = await icons();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(slugify(input.name));
  const _id = new ObjectId();
  const doc: IconDoc = {
    _id,
    icon_id: _id.toHexString(),
    slug,
    kind: input.kind,
    name: input.name.trim(),
    url: input.url.trim(),
    gameIds: input.gameIds ?? [],
    archived: false,
    created_at: now,
    updated_at: now,
  };
  await col.insertOne(doc);
  return serializeIcon(doc);
}

export async function updateIcon(
  iconId: string,
  input: UpdateIconInput,
): Promise<IconAsset> {
  const col = await icons();
  const found = await col.findOne({ icon_id: iconId });
  if (!found) throw new ServiceError("Image not found");

  const $set: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name) {
    $set.name = input.name.trim();
    if (input.name.trim() !== found.name) {
      $set.slug = await uniqueSlug(slugify(input.name), iconId);
    }
  }
  if (input.url) $set.url = input.url.trim();
  if (input.kind) $set.kind = input.kind;
  if (input.gameIds) $set.gameIds = input.gameIds;

  const updated = await col.findOneAndUpdate(
    { icon_id: iconId },
    { $set },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Image not found");
  return serializeIcon(updated);
}

export async function archiveIcon(
  iconId: string,
  archived: boolean,
): Promise<boolean> {
  const col = await icons();
  const res = await col.updateOne(
    { icon_id: iconId },
    { $set: { archived, updated_at: new Date().toISOString() } },
  );
  if (res.matchedCount === 0) throw new ServiceError("Image not found");
  return archived;
}

export async function deleteIcon(iconId: string): Promise<void> {
  const col = await icons();
  const res = await col.deleteOne({ icon_id: iconId });
  if (res.deletedCount === 0) throw new ServiceError("Image not found");
}

export async function ingestIconFilesFromDisk(limit = 8): Promise<{
  uploaded: number;
  skipped: number;
  missing: number;
  remaining: number;
  total: number;
}> {
  try {
    return await ingestCatalogFromDisk(await getDb(), { limit });
  } catch (error) {
    if (error instanceof Error) throw new ServiceError(error.message);
    throw error;
  }
}

