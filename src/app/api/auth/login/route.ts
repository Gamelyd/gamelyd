import { z } from "zod";
import { apiFail, apiOk } from "@/lib/apiJson";
import { LIMITS } from "@/lib/limits";
import { authenticate, ServiceError } from "@/server/services/userService";
import { setSessionCookies } from "@/server/auth/session";

export const runtime = "nodejs";

/*
 * This route is reachable without the browser, so it validates its own body
 * rather than trusting a cast. Length caps only - deliberately no `.email()`
 * here, so the format rule stays exactly where sign-in already enforced it.
 */
const loginBodySchema = z.object({
  email: z.string().trim().min(1).max(LIMITS.email),
  password: z.string().min(1).max(LIMITS.password),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiFail("Expected JSON", 400);
  }
  const parsed = loginBodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiFail("Email and password are required", 400);
  }
  const { email, password } = parsed.data;

  try {
    const session = await authenticate(email, password);
    await setSessionCookies(session.token, session.refreshToken);
    return apiOk({
      token: session.token,
      refreshToken: session.refreshToken,
      user_type: session.user.user_type,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return apiFail(error.message, 401);
    }
    console.error(error);
    return apiFail("Sign-in failed", 500);
  }
}
