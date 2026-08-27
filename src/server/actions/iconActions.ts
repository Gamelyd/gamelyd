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
  listIcons,
  seedIconsFromApp,
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

export async function seedIconsAction(): Promise<
  ActionResult<{ inserted: number; updated: number; total: number }>
> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const result = await seedIconsFromApp();
    return ok(
      result,
      result.inserted > 0
        ? `Downloaded ${result.inserted} new image${result.inserted === 1 ? "" : "s"} into the catalog`
        : "Catalog is already up to date",
    );
  } catch (error) {
    console.error(error);
    return fail("Something went wrong downloading images");
  }
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
