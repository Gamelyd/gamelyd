/**
 * Whisperly JWTs. Signed with WHISPERLY_SECRET_KEY (never gamelyd's
 * SECRET_KEY) and audience "whisperly", so Whisperly and gamelyd tokens can
 * never be used in place of each other.
 *
 * The secret is passed in, so this stays pure and testable.
 */
import { jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";

export const WL_ISSUER = "whisperly-api";
export const WL_AUDIENCE = "whisperly";
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export type WlTokenType = "access" | "refresh";

export interface WlClaims {
  sub: string; // user_id
  did: string; // device id the token was issued to
  role: "USER" | "ADMIN";
  typ: WlTokenType;
  jti: string;
}

function key(secret: string): Uint8Array {
  if (!secret || secret.length < 32) throw new Error("WHISPERLY_SECRET_KEY must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signWlToken(
  claims: Omit<WlClaims, "jti">,
  secret: string,
  ttlSeconds = claims.typ === "access" ? ACCESS_TTL_SECONDS : REFRESH_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({ did: claims.did, role: claims.role, typ: claims.typ })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(WL_ISSUER)
    .setAudience(WL_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(key(secret));
}

/** Verifies signature, issuer, audience, expiry and the expected token type. Returns null when invalid. */
export async function verifyWlToken(token: string, secret: string, typ: WlTokenType): Promise<WlClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: WL_ISSUER, audience: WL_AUDIENCE, algorithms: ["HS256"] });
    if (payload.typ !== typ || typeof payload.sub !== "string" || typeof payload.did !== "string") return null;
    if (payload.role !== "USER" && payload.role !== "ADMIN") return null;
    return { sub: payload.sub, did: payload.did, role: payload.role, typ, jti: String(payload.jti ?? "") };
  } catch {
    return null;
  }
}
