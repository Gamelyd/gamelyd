import { z } from "zod";
import { apiFail, apiOk } from "@/lib/apiJson";
import { LIMITS } from "@/lib/limits";
import { guardAdmin } from "@/server/auth/admin";
import { ensureGame } from "@/server/services/gameService";
import { ServiceError } from "@/server/services/userService";

export const runtime = "nodejs";

const gameBodySchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.gameName),
});

export async function POST(req: Request) {
  if (!(await guardAdmin())) return apiFail("Admin access required", 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiFail("Expected JSON", 400);
  }
  const parsed = gameBodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiFail(`Name is required, up to ${LIMITS.gameName} characters`, 400);
  }
  const { name } = parsed.data;

  try {
    const { game, created } = await ensureGame(name);
    return apiOk({ game, created });
  } catch (error) {
    if (error instanceof ServiceError) return apiFail(error.message, 400);
    console.error(error);
    return apiFail("Could not create game", 500);
  }
}
