"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  sendInviteInputSchema,
  type InviteTournament,
} from "@/lib/schemas/misc";
import { getSessionClaims } from "@/server/auth/session";
import { ServiceError } from "@/server/services/userService";
import {
  acceptInviteById,
  countPendingInvites,
  declineInviteById,
  inviteToTeam,
  inviteToTournament,
  listHostTournamentInvites,
  listMyPendingInvites,
  listPendingTeamInvites,
  userMayJoinTournament,
} from "@/server/services/inviteService";

export async function inviteToTournamentAction(
  tournamentId: string,
  usernameOrEmail: string,
): Promise<ActionResult<InviteTournament>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(sendInviteInputSchema, { usernameOrEmail });
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await inviteToTournament(
        claims.uid,
        tournamentId,
        parsed.data.usernameOrEmail,
      ),
      "Invite sent",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not send the invite");
  }
}

export async function inviteToTeamAction(
  tournamentId: string,
  usernameOrEmail: string,
): Promise<ActionResult<InviteTournament>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(sendInviteInputSchema, { usernameOrEmail });
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await inviteToTeam(
        claims.uid,
        tournamentId,
        parsed.data.usernameOrEmail,
      ),
      "Invite sent. They join when they accept.",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not send the invite");
  }
}

export async function listMyInvitesAction(): Promise<
  ActionResult<InviteTournament[]>
> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  return ok(await listMyPendingInvites(claims.uid));
}

export async function listPendingTeamInvitesAction(
  tournamentId: string,
): Promise<ActionResult<InviteTournament[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  return ok(await listPendingTeamInvites(claims.uid, tournamentId));
}

export async function listHostTournamentInvitesAction(
  tournamentId: string,
): Promise<ActionResult<InviteTournament[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await listHostTournamentInvites(claims.uid, tournamentId));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Could not load invites");
  }
}

export async function countMyInvitesAction(): Promise<ActionResult<number>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  return ok(await countPendingInvites(claims.uid));
}

export async function canJoinTournamentAction(
  tournamentId: string,
): Promise<ActionResult<boolean>> {
  const claims = await getSessionClaims();
  if (!claims) return ok(false);
  return ok(await userMayJoinTournament(claims.uid, tournamentId));
}

export async function acceptInviteAction(
  inviteId: string,
): Promise<ActionResult<{ tournamentId: string; kind: "TOURNAMENT" | "TEAM" }>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    const data = await acceptInviteById(claims.uid, inviteId);
    return ok(
      data,
      data.kind === "TEAM"
        ? "You joined the team"
        : "Invite accepted. You can register now.",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not accept the invite");
  }
}

export async function declineInviteAction(
  inviteId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await declineInviteById(claims.uid, inviteId);
    return ok(null, "Invite declined");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not decline the invite");
  }
}
