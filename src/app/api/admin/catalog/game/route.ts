import { apiFail, apiOk } from "@/lib/apiJson";
import { guardAdmin } from "@/server/auth/admin";
import { ensureGame } from "@/server/services/gameService";
import { ServiceError } from "@/server/services/userService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await guardAdmin())) return apiFail("Admin access required", 401);

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return apiFail("Expected JSON", 400);
  }
  const name = body.name?.trim() ?? "";
  if (!name) return apiFail("Name is required", 400);
  if (name.length > 100) return apiFail("Name is too long", 400);

  try {
    const { game, created } = await ensureGame(name);
    return apiOk({ game, created });
  } catch (error) {
    if (error instanceof ServiceError) return apiFail(error.message, 400);
    console.error(error);
    return apiFail("Could not create game", 500);
  }
}
