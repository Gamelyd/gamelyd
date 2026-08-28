import "server-only";
import { ObjectId } from "mongodb";
import { catalogKinds } from "../db";
import type { CatalogKindDoc } from "../documents";
import { serializeCatalogKind } from "../serialize";
import { ServiceError } from "./userService";
import { DEFAULT_CATALOG_KINDS, GAMES_KIND, SPORTS_KIND } from "@/lib/catalog";
import type {
  CatalogKind,
  CreateCatalogKindInput,
  UpdateCatalogKindInput,
} from "@/lib/schemas/catalogKind";

async function dropDuplicateSlugs(
  col: Awaited<ReturnType<typeof catalogKinds>>,
): Promise<void> {
  const docs = await col.find({}).project({ slug: 1 }).sort({ _id: 1 }).toArray();
  const seen = new Set<string>();
  const extra: ObjectId[] = [];
  for (const doc of docs) {
    const slug = String(doc.slug ?? "").trim().toLowerCase();
    if (!slug) continue;
    if (seen.has(slug)) extra.push(doc._id);
    else seen.add(slug);
  }
  if (extra.length > 0) await col.deleteMany({ _id: { $in: extra } });
}

function uniqueBySlug(kinds: CatalogKind[]): CatalogKind[] {
  const seen = new Set<string>();
  return kinds.filter((kind) => {
    if (seen.has(kind.slug)) return false;
    seen.add(kind.slug);
    return true;
  });
}

async function ensureSeeded(): Promise<void> {
  const col = await catalogKinds();
  const [count, slugs] = await Promise.all([
    col.countDocuments(),
    col.distinct("slug"),
  ]);
  if (count > slugs.length) await dropDuplicateSlugs(col);

  const have = new Set(slugs.map((s) => String(s).toLowerCase()));
  const missing = DEFAULT_CATALOG_KINDS.filter((kind) => !have.has(kind.slug));
  if (missing.length > 0) {
    const now = new Date().toISOString();
    await col.bulkWrite(
      missing.map((kind) => {
        const _id = new ObjectId();
        return {
          updateOne: {
            filter: { slug: kind.slug },
            update: {
              $setOnInsert: {
                _id,
                kind_id: _id.toHexString(),
                slug: kind.slug,
                label: kind.label,
                usesPlatforms: kind.usesPlatforms,
                usesBattleRoyale: kind.usesBattleRoyale,
                usesInGameName: kind.usesInGameName,
                usesVenue: kind.usesVenue,
                sort: kind.sort,
                created_at: now,
                updated_at: now,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }
  await col.updateMany(
    { slug: SPORTS_KIND, usesVenue: { $ne: true } },
    { $set: { usesVenue: true } },
  );
}

export async function listCatalogKinds(): Promise<CatalogKind[]> {
  await ensureSeeded();
  const col = await catalogKinds();
  const docs = await col.find({}).sort({ sort: 1, label: 1 }).limit(50).toArray();
  return uniqueBySlug(docs.map(serializeCatalogKind));
}

export async function getCatalogKindBySlug(
  slug: string,
): Promise<CatalogKind | null> {
  await ensureSeeded();
  const col = await catalogKinds();
  const found = await col.findOne({ slug });
  return found ? serializeCatalogKind(found) : null;
}

export async function createCatalogKind(
  input: CreateCatalogKindInput,
): Promise<CatalogKind> {
  await ensureSeeded();
  const col = await catalogKinds();
  const slug = input.slug.trim().toLowerCase();
  const taken = await col.countDocuments({ slug });
  if (taken > 0) throw new ServiceError("A kind with that slug already exists");

  const now = new Date().toISOString();
  const _id = new ObjectId();
  const last = await col.find().sort({ sort: -1 }).limit(1).toArray();
  const sort = (last[0]?.sort ?? 0) + 1;
  const doc: CatalogKindDoc = {
    _id,
    kind_id: _id.toHexString(),
    slug,
    label: input.label.trim(),
    usesPlatforms: input.usesPlatforms,
    usesBattleRoyale: input.usesBattleRoyale,
    usesInGameName: input.usesInGameName,
    usesVenue: Boolean(input.usesVenue),
    sort,
    created_at: now,
    updated_at: now,
  };
  await col.insertOne(doc);
  return serializeCatalogKind(doc);
}

export async function updateCatalogKind(
  slug: string,
  input: UpdateCatalogKindInput,
): Promise<CatalogKind> {
  const col = await catalogKinds();
  const updated = await col.findOneAndUpdate(
    { slug },
    { $set: { ...input, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ServiceError("Kind not found");
  return serializeCatalogKind(updated);
}

export async function deleteCatalogKind(slug: string): Promise<void> {
  if (slug === GAMES_KIND) {
    throw new ServiceError("You cannot delete the Games kind");
  }
  const col = await catalogKinds();
  const res = await col.deleteOne({ slug });
  if (res.deletedCount === 0) throw new ServiceError("Kind not found");
}
