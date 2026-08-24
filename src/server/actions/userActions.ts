"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  changePasswordInputSchema,
  updateUserInputSchema,
  type User,
} from "@/lib/schemas/user";
import {
  changePassword,
  checkUserName,
  getUserById,
  searchUsers,
  updateUser,
  ServiceError,
} from "@/server/services/userService";
import { getSessionClaims } from "@/server/auth/session";

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult<User>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(updateUserInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    const user = await updateUser(claims.uid, parsed.data);
    return ok(user, "Profile updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating your profile");
  }
}

export async function changePasswordAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(changePasswordInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    await changePassword(
      claims.uid,
      parsed.data.password,
      parsed.data.newPassword,
    );
    return ok(null, "Password changed");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong changing your password");
  }
}

export async function getUserAction(
  userId: string,
): Promise<ActionResult<User | null>> {
  const user = await getUserById(userId);
  return ok(user);
}

export async function searchUsersAction(
  search: string,
  page: number,
): Promise<ActionResult<Paginated<User>>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  return ok(await searchUsers(search, page));
}

export async function checkUserNameAction(
  name: string,
): Promise<ActionResult<{ available: boolean }>> {
  const count = await checkUserName(name);
  return ok({ available: count === 0 });
}
