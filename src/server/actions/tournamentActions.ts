"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  saveTournamentInputSchema,
  updateTournamentInputSchema,
  type Tournament,
  type TournamentGroup,
} from "@/lib/schemas/tournament";
import {
  registerTournamentInputSchema,
  type RegisterTournament,
} from "@/lib/schemas/register";
import type { Player } from "@/lib/schemas/draw";
import {
  acceptInvite,
  getPublicTournaments,
  getTournamentById,
  getTournamentsByMode,
  getTournamentsByModeLimit,
  groupTournament,
  inviteUser,
  listParticipants,
  listUserTournaments,
  listUserTournamentsLimit,
  registerForTournament,
  removeUserFromTournament,
  saveTournament,
  toggleDeleteTournament,
  toggleSuspendTournament,
  updateTournament,
  userRegisteredTournaments,
  userRegisteredTournamentsLimit,
} from "@/server/services/tournamentService";
import { ServiceError } from "@/server/services/userService";
import { getSessionClaims } from "@/server/auth/session";

export async function saveTournamentAction(
  input: unknown,
): Promise<ActionResult<Tournament>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(saveTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await saveTournament(claims.uid, parsed.data),
      "Tournament created",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating the tournament");
  }
}

export async function getTournamentAction(
  id: string,
): Promise<ActionResult<Tournament | null>> {
  return ok(await getTournamentById(id));
}

export async function getTournamentsAction(
  search: string,
  page: number,
): Promise<ActionResult<Paginated<Tournament>>> {
  return ok(await getPublicTournaments(search, page));
}

export async function getTournamentsByModeAction(
  payment: string,
  type: string,
  page: number,
): Promise<ActionResult<Paginated<Tournament>>> {
  return ok(await getTournamentsByMode(payment, type, page));
}

export async function getTournamentsByModeLimitAction(
  payment: string,
): Promise<ActionResult<Tournament[]>> {
  return ok(await getTournamentsByModeLimit(payment));
}

export async function listUserTournamentsAction(
  userId: string,
  page: number,
): Promise<ActionResult<Paginated<Tournament>>> {
  return ok(await listUserTournaments(userId, page));
}

export async function listUserTournamentsLimitAction(
  userId: string,
): Promise<ActionResult<Tournament[]>> {
  return ok(await listUserTournamentsLimit(userId));
}

export async function userRegisteredTournamentsAction(
  userId: string,
  page: number,
): Promise<ActionResult<Paginated<RegisterTournament>>> {
  return ok(await userRegisteredTournaments(userId, page));
}

export async function userRegisteredTournamentsLimitAction(
  userId: string,
): Promise<ActionResult<RegisterTournament[]>> {
  return ok(await userRegisteredTournamentsLimit(userId));
}

export async function registerForTournamentAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<RegisterTournament>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(registerTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await registerForTournament(tournamentId, parsed.data),
      "Registered successfully",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong registering");
  }
}

export async function listParticipantsAction(
  tournamentId: string,
): Promise<ActionResult<RegisterTournament[]>> {
  return ok(await listParticipants(tournamentId));
}

export async function inviteUserAction(
  userId: string,
  tournamentId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await inviteUser(userId, tournamentId);
    return ok(null, "Invite sent successfully");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong sending the invite");
  }
}

export async function acceptInviteAction(
  userId: string,
  tournamentId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  await acceptInvite(userId, tournamentId);
  return ok(null, "Invite accepted");
}

export async function removeUserAction(
  userId: string,
  tournamentId: string,
): Promise<ActionResult<Player[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  return ok(
    await removeUserFromTournament(userId, tournamentId),
    "Removed from tournament",
  );
}

export async function deleteTournamentAction(
  id: string,
): Promise<ActionResult<{ isDeleted: boolean }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    const isDeleted = await toggleDeleteTournament(claims.uid, id);
    return ok({ isDeleted });
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function suspendTournamentAction(
  id: string,
): Promise<ActionResult<{ isSuspended: boolean }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    const isSuspended = await toggleSuspendTournament(claims.uid, id);
    return ok({ isSuspended });
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function updateTournamentAction(
  id: string,
  input: unknown,
): Promise<ActionResult<Tournament>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(updateTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await updateTournament(claims.uid, id, parsed.data),
      "Tournament updated",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating the tournament");
  }
}

export async function groupTournamentAction(
  tournamentId: string,
): Promise<ActionResult<TournamentGroup[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await groupTournament(claims.uid, tournamentId), "Groups created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong grouping the tournament");
  }
}
