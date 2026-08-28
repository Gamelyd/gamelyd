"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  createCatalogKindInputSchema,
  updateCatalogKindInputSchema,
  type CatalogKind,
} from "@/lib/schemas/catalogKind";
import {
  createCatalogKind,
  deleteCatalogKind,
  listCatalogKinds,
  updateCatalogKind,
} from "@/server/services/catalogKindService";
import { ServiceError } from "@/server/services/userService";
import { guardAdmin } from "@/server/auth/admin";

export async function getCatalogKindsAction(): Promise<
  ActionResult<CatalogKind[]>
> {
  return ok(await listCatalogKinds());
}

export async function createCatalogKindAction(
  input: unknown,
): Promise<ActionResult<CatalogKind>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(createCatalogKindInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await createCatalogKind(parsed.data), "Kind created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function updateCatalogKindAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<CatalogKind>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(updateCatalogKindInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await updateCatalogKind(slug, parsed.data), "Kind updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function deleteCatalogKindAction(
  slug: string,
): Promise<ActionResult<null>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    await deleteCatalogKind(slug);
    return ok(null, "Kind deleted");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
