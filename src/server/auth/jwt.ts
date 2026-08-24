import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../env";

const claimsSchema = z.object({
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  uid: z.string(),
  user_type: z.enum(["ADMIN", "USER"]),
  typ: z.enum(["access", "refresh"]).optional(),
});
export type TokenClaims = z.infer<typeof claimsSchema>;

function secret(): Uint8Array {
  return new TextEncoder().encode(env.secretKey);
}

export interface TokenPair {
  token: string;
  refreshToken: string;
}

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

async function sign(claims: TokenClaims, ttl: string): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret());
}

export async function generateTokens(claims: TokenClaims): Promise<TokenPair> {
  const base = {
    email: claims.email,
    first_name: claims.first_name,
    last_name: claims.last_name,
    uid: claims.uid,
    user_type: claims.user_type,
  };
  const [token, refreshToken] = await Promise.all([
    sign({ ...base, typ: "access" }, ACCESS_TTL),
    sign({ ...base, typ: "refresh" }, REFRESH_TTL),
  ]);
  return { token, refreshToken };
}

export async function verifyToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    // Access tokens are typed as "access". Legacy tokens (issued before typ
    // existed) have no typ and are still accepted as access.
    if (parsed.data.typ === "refresh") return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function generatePasswordResetToken(
  claims: TokenClaims,
): Promise<string> {
  return sign(
    {
      email: claims.email,
      first_name: claims.first_name,
      last_name: claims.last_name,
      uid: claims.uid,
      user_type: claims.user_type,
      typ: "access",
    },
    "1h",
  );
}

export async function verifyRefreshToken(
  token: string,
): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    // New refresh tokens carry typ=refresh. Reject access tokens so they
    // cannot be used to mint a new session.
    if (parsed.data.typ === "access") return null;
    return parsed.data;
  } catch {
    return null;
  }
}
