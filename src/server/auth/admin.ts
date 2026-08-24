import "server-only";
import type { TokenClaims } from "./jwt";
import { resolveCurrentUser } from "../services/userService";

/**
 * Guard for admin-only server actions and pages. Identity is resolved from
 * the access token, or the refresh token if access has expired. The admin
 * role is authorized against the live user record so promotions, demotions
 * and bans take effect on the next request.
 */
export async function guardAdmin(): Promise<TokenClaims | null> {
  const user = await resolveCurrentUser();
  if (!user || user.user_type !== "ADMIN") return null;
  return {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    uid: user.user_id,
    user_type: user.user_type,
  };
}
