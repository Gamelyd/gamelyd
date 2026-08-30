"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  forgotPasswordInputSchema,
  loginInputSchema,
  resetPasswordInputSchema,
  signupInputSchema,
  type User,
} from "@/lib/schemas/user";
import {
  authenticate,
  createUser,
  exchangeRefreshToken,
  forgotPassword,
  getUserById,
  isAccountLocked,
  resetPassword,
  resolveCurrentUser,
  revokeUserSessions,
  ServiceError,
} from "@/server/services/userService";
import {
  clearSessionCookie,
  getAccessClaims,
  getRefreshCookie,
  getSessionClaims,
  setSessionCookies,
} from "@/server/auth/session";
import { verifyToken } from "@/server/auth/jwt";

async function issueSession(session: {
  user: User;
  token: string;
  refreshToken: string;
}): Promise<User> {
  await setSessionCookies(session.token, session.refreshToken);
  return session.user;
}

async function destroySession(uid?: string): Promise<void> {
  // Drop only this device's session, leaving the user signed in elsewhere.
  const refresh = await getRefreshCookie();
  if (uid) await revokeUserSessions(uid, refresh ?? undefined);
  await clearSessionCookie();
}

export async function signupAction(
  input: unknown,
): Promise<ActionResult<User>> {
  const parsed = parseInput(signupInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    const session = await createUser(parsed.data);
    const user = await issueSession(session);
    return ok(user, "Account created successfully");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating your account");
  }
}

export async function loginAction(input: unknown): Promise<ActionResult<User>> {
  const parsed = parseInput(loginInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    const session = await authenticate(parsed.data.email, parsed.data.password);
    const user = await issueSession(session);
    return ok(user, "Signed in successfully");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong signing you in");
  }
}

export async function logoutAction(): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  await destroySession(claims?.uid);
  return ok(null, "Signed out");
}

export async function forgotPasswordAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = parseInput(forgotPasswordInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  await forgotPassword(parsed.data.email);
  // Always report success to avoid leaking which emails exist.
  return ok(null, "Check your email for a reset link");
}

export async function resetPasswordAction(
  token: string,
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = parseInput(resetPasswordInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  const claims = await verifyToken(token);
  if (!claims) return fail("Reset link is invalid or has expired");

  try {
    await resetPassword(claims.uid, parsed.data.newPassword);
    return ok(null, "Password reset successfully");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong resetting your password");
  }
}

/**
 * Keep the access cookie alive from the httpOnly refresh cookie. Returns the
 * current user. Cookies are cleared only when the refresh token is gone or
 * actually invalid - not on a failed cookie write.
 */
export async function refreshSessionAction(): Promise<
  ActionResult<User | null>
> {
  const access = await getAccessClaims();
  const refresh = await getRefreshCookie();

  if (!refresh) {
    if (!access) {
      await clearSessionCookie();
      return ok(null);
    }
    const user = await getUserById(access.uid);
    if (!user || isAccountLocked(user)) {
      await destroySession(access.uid);
      return ok(null);
    }
    return ok(user);
  }

  const session = await exchangeRefreshToken(refresh);
  if (!session) {
    if (access) {
      const user = await getUserById(access.uid);
      if (user && !isAccountLocked(user)) return ok(user);
    }
    await clearSessionCookie();
    return ok(null);
  }

  try {
    await setSessionCookies(session.token, session.refreshToken);
  } catch {
    // Cookie writes are not allowed during RSC render; identity still holds
    // via the refresh cookie until the next client-side Server Action.
  }
  return ok(session.user);
}

export async function getCurrentUserAction(): Promise<ActionResult<User | null>> {
  const user = await resolveCurrentUser();
  if (!user) return ok(null);
  return ok(user);
}
