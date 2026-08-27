"use server";

import { ok, fail, type ActionResult } from "@/lib/result";
import { refreshTournamentCatalogIcons } from "@/server/services/iconService";
import { ServiceError } from "@/server/services/userService";
import { guardAdmin } from "@/server/auth/admin";

export async function refreshTournamentIconsAction(
  tournamentId: string,
): Promise<ActionResult<{ teams: number; players: number }>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const result = await refreshTournamentCatalogIcons(tournamentId);
    const teamLabel = result.teams === 1 ? "team" : "teams";
    const playerLabel = result.players === 1 ? "player icon" : "player icons";
    return ok(
      result,
      `Updated ${result.teams} ${teamLabel} and ${result.players} ${playerLabel}`,
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error("[refreshTournamentIconsAction]", error);
    return fail("Something went wrong updating icons");
  }
}
