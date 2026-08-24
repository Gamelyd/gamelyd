import "server-only";
import { cookies } from "next/headers";
import {
  verifyRefreshToken,
  verifyToken,
  type TokenClaims,
} from "./jwt";

export const SESSION_COOKIE = "gamelyd_token";
export const REFRESH_COOKIE = "gamelyd_refresh";

const ACCESS_MAX_AGE = 60 * 15; // 15 minutes
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function cookieBase() {
  // Never set Secure on plain HTTP — browsers drop those cookies and protected
  // routes look like a logout. Opt in only when COOKIE_SECURE=true (HTTPS).
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

/** Store the access JWT in an httpOnly cookie. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    ...cookieBase(),
    maxAge: ACCESS_MAX_AGE,
  });
}

export async function setRefreshCookie(refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set(REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function setSessionCookies(
  token: string,
  refreshToken: string,
): Promise<void> {
  await setSessionCookie(token);
  await setRefreshCookie(refreshToken);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const base = cookieBase();
  // delete() alone can miss cookies if Secure/path don't match; expire explicitly.
  store.set(SESSION_COOKIE, "", { ...base, maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getRefreshCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/** Returns verified access-token claims, or null if missing/expired/invalid. */
export async function getSessionClaims(): Promise<TokenClaims | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return verifyToken(token);
}

export async function getRefreshClaims(): Promise<TokenClaims | null> {
  const token = await getRefreshCookie();
  if (!token) return null;
  return verifyRefreshToken(token);
}

/** Throws if the caller is not authenticated. */
export async function requireAuth(): Promise<TokenClaims> {
  const claims = await getSessionClaims();
  if (!claims) {
    throw new UnauthorizedError();
  }
  return claims;
}

export class UnauthorizedError extends Error {
  constructor(message = "No Authorization header provided") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
