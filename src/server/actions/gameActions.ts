"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  createGameInputSchema,
  updateGameInputSchema,
  type Game,
} from "@/lib/schemas/game";
import {
  createGame,
  deleteGame,
  listGames,
  listGamesPage,
  toggleGameActive,
  updateGame,
} from "@/server/services/gameService";
import { ServiceError } from "@/server/services/userService";
import { guardAdmin } from "@/server/auth/admin";

/** Public: active games, used to populate the tournament creation picker. */
export async function getGamesAction(): Promise<ActionResult<Game[]>> {
  return ok(await listGames(true));
}

/** Public: searchable, paginated active games. */
export async function getGamesPageAction(
  search = "",
  page = 1,
  perPage = 12,
): Promise<ActionResult<Paginated<Game>>> {
  return ok(await listGamesPage({ activeOnly: true, search, page, perPage }));
}

/** Admin: every game, including inactive ones. */
export async function adminListGamesAction(): Promise<ActionResult<Game[]>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await listGames(false));
}

export async function createGameAction(
  input: unknown,
): Promise<ActionResult<Game>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(createGameInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await createGame(parsed.data), "Game created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating the game");
  }
}

export async function updateGameAction(
  gameId: string,
  input: unknown,
): Promise<ActionResult<Game>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(updateGameInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await updateGame(gameId, parsed.data), "Game updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating the game");
  }
}

export async function toggleGameActiveAction(
  gameId: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const active = await toggleGameActive(gameId);
    return ok(active, active ? "Game activated" : "Game deactivated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function deleteGameAction(
  gameId: string,
): Promise<ActionResult<null>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    await deleteGame(gameId);
    return ok(null, "Game deleted");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
