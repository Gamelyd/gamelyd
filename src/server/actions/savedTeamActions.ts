"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  createSavedTeamInputSchema,
  inviteToSavedTeamInputSchema,
  setGameUserNameInputSchema,
  updateSavedTeamInputSchema,
  type SavedTeam,
  type SavedTeamInvite,
} from "@/lib/schemas/savedTeam";
import { getSessionClaims } from "@/server/auth/session";
import { ServiceError } from "@/server/services/userService";
import {
  alertCaptainAboutTournament,
  createSavedTeam,
  deleteSavedTeam,
  getSavedTeam,
  inviteToSavedTeam,
  leaveSavedTeam,
  listMySavedTeamInvites,
  listMySavedTeams,
  removeSavedTeamMember,
  respondToSavedTeamInvite,
  resolveSavedTeamRegistration,
  setMyGameUserName,
  transferSavedTeamCaptain,
  updateSavedTeam,
} from "@/server/services/savedTeamService";
import {
  getTournamentById,
  registerForTournament,
} from "@/server/services/tournamentService";
import { startEntryCheckout } from "@/server/services/paymentService";
import { rosterSize } from "@/lib/schemas/common";

export async function mySavedTeamsAction(): Promise<ActionResult<SavedTeam[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await listMySavedTeams(claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load your teams");
  }
}

export async function getSavedTeamAction(
  teamId: string,
): Promise<ActionResult<SavedTeam | null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await getSavedTeam(teamId, claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load that team");
  }
}

export async function createSavedTeamAction(
  input: unknown,
): Promise<ActionResult<SavedTeam>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(createSavedTeamInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await createSavedTeam(claims.uid, parsed.data), "Team created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not create that team");
  }
}

export async function updateSavedTeamAction(
  teamId: string,
  input: unknown,
): Promise<ActionResult<SavedTeam>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(updateSavedTeamInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await updateSavedTeam(claims.uid, teamId, parsed.data),
      "Team updated",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not update that team");
  }
}

export async function deleteSavedTeamAction(
  teamId: string,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await deleteSavedTeam(claims.uid, teamId);
    return ok({ ok: true } as const, "Team deleted");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not delete that team");
  }
}

export async function inviteToSavedTeamAction(
  teamId: string,
  input: unknown,
): Promise<ActionResult<SavedTeamInvite>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(inviteToSavedTeamInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await inviteToSavedTeam(claims.uid, teamId, parsed.data.usernameOrEmail),
      "Invite sent",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not send that invite");
  }
}

export async function mySavedTeamInvitesAction(): Promise<
  ActionResult<SavedTeamInvite[]>
> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await listMySavedTeamInvites(claims.uid));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load your invites");
  }
}

export async function respondToSavedTeamInviteAction(
  inviteId: string,
  accept: boolean,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await respondToSavedTeamInvite(claims.uid, inviteId, accept);
    return ok({ ok: true } as const, accept ? "Team joined" : "Invite declined");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not answer that invite");
  }
}

export async function removeSavedTeamMemberAction(
  teamId: string,
  memberId: string,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await removeSavedTeamMember(claims.uid, teamId, memberId);
    return ok({ ok: true } as const, "Player removed");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not remove that player");
  }
}

export async function leaveSavedTeamAction(
  teamId: string,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await leaveSavedTeam(claims.uid, teamId);
    return ok({ ok: true } as const, "You left the team");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not leave that team");
  }
}

export async function transferSavedTeamCaptainAction(
  teamId: string,
  memberId: string,
): Promise<ActionResult<SavedTeam>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(
      await transferSavedTeamCaptain(claims.uid, teamId, memberId),
      "Captain updated",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not hand over the captaincy");
  }
}

export async function setMyGameUserNameAction(
  teamId: string,
  input: unknown,
): Promise<ActionResult<SavedTeam>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(setGameUserNameInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await setMyGameUserName(claims.uid, teamId, parsed.data.game_user_name),
      "Saved",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not save that");
  }
}

/**
 * One-click entry for a captain: resolves the saved roster and either registers
 * it outright, or returns a checkout URL when the event charges an entry fee.
 */
export async function enterSavedTeamAction(
  teamId: string,
  tournamentId: string,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) return fail("Tournament not found");

    const roster = await resolveSavedTeamRegistration(
      claims.uid,
      teamId,
      rosterSize(tournament.Team, tournament.RosterCount),
    );

    if (tournament.Payment === "PAID") {
      const checkout = await startEntryCheckout(claims.uid, tournamentId, {
        ...roster,
        SavedTeamId: teamId,
      });
      return ok(checkout, "Redirecting to pay the entry fee");
    }

    await registerForTournament(
      tournamentId,
      { ...roster, RefNumber: "", PaymentChannel: "", Amount: 0 },
      { actorUid: claims.uid, allowPartialRoster: true },
    );
    return ok({ checkoutUrl: "" }, `${roster.TeamName} is registered`);
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not enter that team");
  }
}

export async function alertCaptainAboutTournamentAction(
  teamId: string,
  tournamentId: string,
): Promise<ActionResult<{ ok: true }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await alertCaptainAboutTournament(claims.uid, teamId, tournamentId);
    return ok({ ok: true } as const, "Your captain has been notified");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not alert your captain");
  }
}
