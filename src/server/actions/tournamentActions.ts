"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  adminAddParticipantsInputSchema,
  editTournamentInputSchema,
  saveTournamentInputSchema,
  setGroupsInputSchema,
  setGroupQualifiersInputSchema,
  updateTournamentInputSchema,
  type Tournament,
  type TournamentGroup,
  type TournamentManager,
  type GroupQualifier,
} from "@/lib/schemas/tournament";
import {
  registerTournamentInputSchema,
  type RegisterTournament,
} from "@/lib/schemas/register";
import type { Player, Draw } from "@/lib/schemas/draw";
import {
  acceptInvite,
  addTournamentManager,
  editTournamentSettings,
  getPublicTournaments,
  getTournamentById,
  getTournamentsByMode,
  getTournamentsByModeLimit,
  getBannerTournaments,
  groupTournament,
  inviteUser,
  listAssignableManagers,
  listParticipants,
  listTournamentManagers,
  listUserTournaments,
  listUserTournamentsLimit,
  checkInForTournament,
  registerForTournament,
  removeTournamentManager,
  removeUserFromTournament,
  saveTournament,
  setTournamentGroups,
  adminAddParticipants,
  setGroupQualifiers,
  disqualifyTeam,
  removeRegisteredTeam,
  toggleDeleteTournament,
  toggleSuspendTournament,
  updateTournament,
  userRegisteredTournaments,
  userRegisteredTournamentsLimit,
} from "@/server/services/tournamentService";
import { ServiceError } from "@/server/services/userService";
import { getSessionClaims } from "@/server/auth/session";
import {
  guardManageTournament,
  requireTournamentAdmin,
  requireTournamentManager,
} from "@/server/auth/tournament";

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
  status = "ALL",
): Promise<ActionResult<Paginated<Tournament>>> {
  return ok(await getTournamentsByMode(payment, type, page, status));
}

export async function getBannerTournamentsAction(): Promise<
  ActionResult<Tournament[]>
> {
  return ok(await getBannerTournaments());
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
  limit = 7,
): Promise<ActionResult<Tournament[]>> {
  return ok(await listUserTournamentsLimit(userId, limit));
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

export async function checkInForTournamentAction(
  tournamentId: string,
): Promise<ActionResult<RegisterTournament>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(
      await checkInForTournament(claims.uid, tournamentId),
      "You're checked in",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong checking in");
  }
}

export async function listParticipantsAction(
  tournamentId: string,
): Promise<ActionResult<RegisterTournament[]>> {
  return ok(await listParticipants(tournamentId));
}

export async function addParticipantsAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<RegisterTournament>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;

  const parsed = parseInput(adminAddParticipantsInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await adminAddParticipants(admin.uid, tournamentId, parsed.data),
      "Player added to the tournament",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong adding the player");
  }
}

export async function inviteUserAction(
  userId: string,
  tournamentId: string,
): Promise<ActionResult<null>> {
  const manager = await requireTournamentManager(tournamentId);
  if (!manager.ok) return manager;
  try {
    await inviteUser(manager.uid, userId, tournamentId);
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
  if (claims.uid !== userId) {
    return fail("You can only accept your own invite");
  }
  await acceptInvite(userId, tournamentId);
  return ok(null, "Invite accepted");
}

export async function removeUserAction(
  userId: string,
  tournamentId: string,
): Promise<ActionResult<Player[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  if (claims.uid !== userId) {
    const admin = await requireTournamentAdmin(tournamentId);
    if (!admin.ok) return admin;
  }
  try {
    return ok(
      await removeUserFromTournament(claims.uid, userId, tournamentId),
      "Removed from tournament",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function deleteTournamentAction(
  id: string,
): Promise<ActionResult<{ isDeleted: boolean }>> {
  const admin = await requireTournamentAdmin(id);
  if (!admin.ok) return admin;
  try {
    const isDeleted = await toggleDeleteTournament(admin.uid, id);
    return ok({ isDeleted });
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function suspendTournamentAction(
  id: string,
): Promise<ActionResult<{ isSuspended: boolean }>> {
  const admin = await requireTournamentAdmin(id);
  if (!admin.ok) return admin;
  try {
    const isSuspended = await toggleSuspendTournament(admin.uid, id);
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
  const manager = await requireTournamentManager(id);
  if (!manager.ok) return manager;

  const parsed = parseInput(updateTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await updateTournament(manager.uid, id, parsed.data),
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
  const manager = await requireTournamentManager(tournamentId);
  if (!manager.ok) return manager;
  try {
    return ok(
      await groupTournament(manager.uid, tournamentId),
      "Groups created",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong grouping the tournament");
  }
}

export async function setTournamentGroupsAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<TournamentGroup[]>> {
  const manager = await requireTournamentManager(tournamentId);
  if (!manager.ok) return manager;

  const parsed = parseInput(setGroupsInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await setTournamentGroups(manager.uid, tournamentId, parsed.data),
      "Groups updated",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating groups");
  }
}

export async function setGroupQualifiersAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<GroupQualifier[]>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;

  const parsed = parseInput(setGroupQualifiersInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await setGroupQualifiers(admin.uid, tournamentId, parsed.data),
      "Qualifiers saved",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong saving qualifiers");
  }
}

export async function disqualifyTeamAction(
  tournamentId: string,
  teamName: string,
): Promise<ActionResult<{ tournament: Tournament; forfeited: number; draws: Draw[] }>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;
  try {
    return ok(
      await disqualifyTeam(admin.uid, tournamentId, teamName),
      "Team disqualified",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong disqualifying that team");
  }
}

export async function removeRegisteredTeamAction(
  tournamentId: string,
  teamName: string,
): Promise<ActionResult<{ teamName: string; groups: TournamentGroup[] }>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;
  try {
    return ok(
      await removeRegisteredTeam(admin.uid, tournamentId, teamName),
      "Team removed",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong removing that team");
  }
}

export async function editTournamentSettingsAction(
  id: string,
  input: unknown,
): Promise<ActionResult<Tournament>> {
  const admin = await requireTournamentAdmin(id);
  if (!admin.ok) return admin;

  const parsed = parseInput(editTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);

  try {
    return ok(
      await editTournamentSettings(admin.uid, id, parsed.data),
      "Settings saved",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong saving settings");
  }
}

export async function listTournamentManagersAction(
  tournamentId: string,
): Promise<ActionResult<TournamentManager[]>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;
  try {
    return ok(await listTournamentManagers(admin.uid, tournamentId));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function listAssignableManagersAction(
  tournamentId: string,
): Promise<ActionResult<TournamentManager[]>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;
  try {
    return ok(await listAssignableManagers(admin.uid, tournamentId));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function addTournamentManagerAction(
  tournamentId: string,
  targetUserId: string,
): Promise<ActionResult<TournamentManager[]>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;
  try {
    return ok(
      await addTournamentManager(admin.uid, tournamentId, targetUserId),
      "Manager added",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function removeTournamentManagerAction(
  tournamentId: string,
  targetUserId: string,
): Promise<ActionResult<TournamentManager[]>> {
  const admin = await requireTournamentAdmin(tournamentId);
  if (!admin.ok) return admin;
  try {
    return ok(
      await removeTournamentManager(admin.uid, tournamentId, targetUserId),
      "Manager removed",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
