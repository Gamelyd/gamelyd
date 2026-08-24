"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  createPlatformInputSchema,
  updatePlatformInputSchema,
  type Platform,
} from "@/lib/schemas/platform";
import {
  createPlatform,
  deletePlatform,
  listPlatforms,
  togglePlatformActive,
  updatePlatform,
} from "@/server/services/platformService";
import { ServiceError } from "@/server/services/userService";
import { guardAdmin } from "@/server/auth/admin";

/** Public: active platforms for tournament (and game) pickers. */
export async function getPlatformsAction(): Promise<ActionResult<Platform[]>> {
  return ok(await listPlatforms(true));
}

export async function adminListPlatformsAction(): Promise<
  ActionResult<Platform[]>
> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await listPlatforms(false));
}

export async function createPlatformAction(
  input: unknown,
): Promise<ActionResult<Platform>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(createPlatformInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await createPlatform(parsed.data), "Platform created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating the platform");
  }
}

export async function updatePlatformAction(
  platformId: string,
  input: unknown,
): Promise<ActionResult<Platform>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(updatePlatformInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await updatePlatform(platformId, parsed.data), "Platform updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating the platform");
  }
}

export async function togglePlatformActiveAction(
  platformId: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const active = await togglePlatformActive(platformId);
    return ok(active, active ? "Platform activated" : "Platform deactivated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function deletePlatformAction(
  platformId: string,
): Promise<ActionResult<null>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    await deletePlatform(platformId);
    return ok(null, "Platform deleted");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
