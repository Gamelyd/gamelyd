"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  createIconInputSchema,
  iconKindSchema,
  listIconsInputSchema,
  updateIconInputSchema,
  type IconAsset,
} from "@/lib/schemas/icon";
import {
  allocateIconSlug,
  archiveIcon,
  createIcon,
  deleteIcon,
  getIconById,
  listIcons,
  updateIcon,
} from "@/server/services/iconService";
import { putIconFile } from "@/server/iconFiles";
import { ServiceError } from "@/server/services/userService";
import { guardAdmin } from "@/server/auth/admin";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function slugFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return (
    stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

function contentTypeFor(file: File): string | null {
  if (IMAGE_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

async function fileFromForm(
  formData: FormData,
): Promise<{ ok: true; file: File | null } | { ok: false; error: string }> {
  const raw = formData.get("file");
  if (!(raw instanceof File) || raw.size === 0) return { ok: true, file: null };
  if (raw.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be 6 MB or smaller" };
  }
  if (!contentTypeFor(raw)) {
    return { ok: false, error: "Use a PNG, JPEG, WebP, or GIF" };
  }
  return { ok: true, file: raw };
}

/** Public catalog for pickers. Archived images are omitted. */
export async function listIconsAction(
  input: unknown = {},
): Promise<ActionResult<IconAsset[]>> {
  const parsed = parseInput(listIconsInputSchema, input ?? {});
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  return ok(
    await listIcons({
      ...parsed.data,
      includeArchived: false,
    }),
  );
}

export async function adminListIconsAction(
  input: unknown = {},
): Promise<ActionResult<IconAsset[]>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(listIconsInputSchema, input ?? {});
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  return ok(
    await listIcons({
      ...parsed.data,
      includeArchived: true,
    }),
  );
}

export async function createIconAction(
  input: unknown,
): Promise<ActionResult<IconAsset>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(createIconInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await createIcon(parsed.data), "Image added");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong adding the image");
  }
}

/** Create or update a catalog image, optionally uploading a file to GridFS. */
export async function saveIconFormAction(
  formData: FormData,
): Promise<ActionResult<IconAsset>> {
  if (!(await guardAdmin())) return fail("Admin access required");

  const iconId = String(formData.get("icon_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const kindParsed = iconKindSchema.safeParse(
    String(formData.get("kind") ?? ""),
  );
  const url = String(formData.get("url") ?? "").trim();
  let gameIds: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("gameIds") ?? "[]"));
    if (Array.isArray(raw)) {
      gameIds = raw.filter((id): id is string => typeof id === "string");
    }
  } catch {
    return fail("Game tags are invalid");
  }

  if (!name) return fail("Name is required");
  if (!kindParsed.success) return fail("Pick a kind");

  const fileResult = await fileFromForm(formData);
  if (!fileResult.ok) return fail(fileResult.error);
  const file = fileResult.file;

  if (!file && !url && !iconId) {
    return fail("Select an image file or paste an image URL");
  }

  try {
    if (file) {
      const type = contentTypeFor(file);
      if (!type) return fail("Use a PNG, JPEG, WebP, or GIF");
      const buffer = Buffer.from(await file.arrayBuffer());
      if (iconId) {
        const existing = await getIconById(iconId);
        if (!existing) return fail("Image not found");
        await putIconFile(existing.slug, buffer, type);
        return ok(
          await updateIcon(iconId, {
            name,
            kind: kindParsed.data,
            gameIds,
            url: `/api/icons/${existing.slug}`,
          }),
          "Image updated",
        );
      }
      const slug = await allocateIconSlug(slugFromFilename(file.name));
      await putIconFile(slug, buffer, type);
      return ok(
        await createIcon(
          {
            name,
            kind: kindParsed.data,
            gameIds,
            url: `/api/icons/${slug}`,
          },
          { slug },
        ),
        "Image added",
      );
    }

    if (iconId) {
      const parsed = parseInput(updateIconInputSchema, {
        name,
        url,
        kind: kindParsed.data,
        gameIds,
      });
      if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
      return ok(await updateIcon(iconId, parsed.data), "Image updated");
    }
    const parsed = parseInput(createIconInputSchema, {
      name,
      url,
      kind: kindParsed.data,
      gameIds,
    });
    if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
    return ok(await createIcon(parsed.data), "Image added");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong saving the image");
  }
}

export async function updateIconAction(
  iconId: string,
  input: unknown,
): Promise<ActionResult<IconAsset>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(updateIconInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await updateIcon(iconId, parsed.data), "Image updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating the image");
  }
}

export async function archiveIconAction(
  iconId: string,
  archived: boolean,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const next = await archiveIcon(iconId, archived);
    return ok(next, next ? "Image archived" : "Image restored");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function deleteIconAction(
  iconId: string,
): Promise<ActionResult<null>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    await deleteIcon(iconId);
    return ok(null, "Image deleted from the catalog");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
