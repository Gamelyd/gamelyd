import { apiFail, apiOk } from "@/lib/apiJson";
import { authenticate, ServiceError } from "@/server/services/userService";
import { setSessionCookies } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return apiFail("Expected JSON", 400);
  }
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) return apiFail("Email and password are required", 400);

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
