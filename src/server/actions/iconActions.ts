"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  createIconInputSchema,
  listIconsInputSchema,
  updateIconInputSchema,
  type IconAsset,
} from "@/lib/schemas/icon";
import {
  archiveIcon,
  createIcon,
  deleteIcon,
  ingestIconFilesFromDisk,
  listIcons,
  updateIcon,
} from "@/server/services/iconService";
import { ServiceError } from "@/server/services/userService";
import { guardAdmin } from "@/server/auth/admin";

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

export async function ingestIconFilesAction(): Promise<
  ActionResult<{
    uploaded: number;
    skipped: number;
    missing: number;
    remaining: number;
    total: number;
  }>
> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const result = await ingestIconFilesFromDisk(8);
    if (result.total === 0) {
      return ok(result, "No catalog files to upload for this database");
    }
    if (result.remaining > 0) {
      const done = result.total - result.remaining;
      return ok(
        result,
        `Saved ${done} of ${result.total} catalog images. Keep the page open…`,
      );
    }
    if (result.missing > 0) {
      return ok(
        result,
        `Catalog upload finished. ${result.missing} row${result.missing === 1 ? "" : "s"} had no PNG on this server.`,
      );
    }
    return ok(result, "Catalog images are in the database");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong uploading catalog images");
  }
}
