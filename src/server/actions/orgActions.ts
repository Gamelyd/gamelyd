"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import {
  createOrgInputSchema,
  inviteMemberInputSchema,
  updateOrgInputSchema,
  type Org,
  type OrgInvite,
  type OrgMemberWithUser,
  type OrgWithRole,
} from "@/lib/schemas/org";
import type { Tournament } from "@/lib/schemas/tournament";
import {
  acceptInvite,
  createOrg,
  declineInvite,
  getOrgById,
  inviteMember,
  listMembers,
  listOrgTournaments,
  listUserInvites,
  listUserOrgs,
  removeMember,
  updateOrg,
} from "@/server/services/orgService";
import { ServiceError } from "@/server/services/userService";
import { getSessionClaims } from "@/server/auth/session";
import { resolveCurrentUser } from "@/server/services/userService";

export async function createOrgAction(
  input: unknown,
): Promise<ActionResult<Org>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(createOrgInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await createOrg(claims.uid, parsed.data), "Organization created");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong creating the organization");
  }
}

export async function updateOrgAction(
  orgId: string,
  input: unknown,
): Promise<ActionResult<Org>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(updateOrgInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(
      await updateOrg(claims.uid, orgId, parsed.data),
      "Organization updated",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong updating the organization");
  }
}

export async function getOrgAction(
  orgId: string,
): Promise<ActionResult<Org | null>> {
  return ok(await getOrgById(orgId));
}

export async function getMyOrgsAction(): Promise<
  ActionResult<OrgWithRole[]>
> {
  const user = await resolveCurrentUser();
  if (!user) return ok([]);
  return ok(await listUserOrgs(user.user_id));
}

export async function listMembersAction(
  orgId: string,
): Promise<ActionResult<OrgMemberWithUser[]>> {
  return ok(await listMembers(orgId));
}

export async function inviteMemberAction(
  orgId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");

  const parsed = parseInput(inviteMemberInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    await inviteMember(claims.uid, orgId, parsed.data);
    return ok(null, "Invite sent");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Something went wrong sending the invite");
  }
}

export async function acceptOrgInviteAction(
  inviteId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await acceptInvite(claims.uid, inviteId);
    return ok(null, "Invite accepted");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function declineOrgInviteAction(
  inviteId: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await declineInvite(claims.uid, inviteId);
    return ok(null, "Invite declined");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function removeMemberAction(
  orgId: string,
  targetUid: string,
): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();
  if (!claims) return fail("You must be signed in");
  try {
    await removeMember(claims.uid, orgId, targetUid);
    return ok(null, "Member removed");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function getMyOrgInvitesAction(): Promise<
  ActionResult<OrgInvite[]>
> {
  const claims = await getSessionClaims();
  if (!claims) return ok([]);
  return ok(await listUserInvites(claims.uid));
}

export async function listOrgTournamentsAction(
  orgId: string,
  page: number,
): Promise<ActionResult<Paginated<Tournament>>> {
  return ok(await listOrgTournaments(orgId, page));
}
