"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { registerTournamentInputSchema } from "@/lib/schemas/register";
import type { JoinRequest } from "@/lib/schemas/joinRequest";
import { getSessionClaims } from "@/server/auth/session";
import {
  ServiceError,
  getUserById,
} from "@/server/services/userService";
import {
  createJoinRequest,
  listJoinRequests,
  acceptJoinRequest,
  declineJoinRequest,
} from "@/server/services/joinRequestService";

export async function requestToJoinAction(
  tournamentId: string,
  input: unknown,
): Promise<ActionResult<JoinRequest>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  const parsed = parseInput(registerTournamentInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    const user = await getUserById(claims.uid);
    const data = await createJoinRequest(
      claims.uid,
      tournamentId,
      user?.user_name ?? "",
      {
        TeamName: parsed.data.TeamName,
        Players: parsed.data.Players,
        Icon: parsed.data.Icon,
      },
    );
    return ok(data, "Request sent. The host will review it.");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong sending your request");
  }
}

export async function listJoinRequestsAction(
  tournamentId: string,
): Promise<ActionResult<JoinRequest[]>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    return ok(await listJoinRequests(tournamentId));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Could not load requests");
  }
}

export async function acceptJoinRequestAction(
  requestId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await acceptJoinRequest(requestId, claims.uid);
    return ok(null, "Request accepted. The team is registered.");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not accept the request");
  }
}

export async function declineJoinRequestAction(
  requestId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await declineJoinRequest(requestId, claims.uid);
    return ok(null, "Request declined");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Could not decline the request");
  }
}
