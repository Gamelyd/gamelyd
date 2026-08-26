"use server";

import { parseInput } from "@/lib/validate";
import { ok, fail, type ActionResult, type Paginated } from "@/lib/result";
import type { User } from "@/lib/schemas/user";
import { userTypeSchema, type UserType } from "@/lib/schemas/common";
import {
  updateOrgInputSchema,
  type Org,
  type OrgMemberWithUser,
} from "@/lib/schemas/org";
import {
  searchUsers,
  setUserType,
  toggleDeleteUser,
  toggleSuspendUser,
  ServiceError,
} from "@/server/services/userService";
import {
  getAdminStats,
  type AdminStats,
} from "@/server/services/adminService";
import {
  adminRemoveMember,
  adminUpdateOrg,
  getOrgByIdAdmin,
  listMembers,
  listOrgs,
  toggleDeleteOrg,
} from "@/server/services/orgService";
import {
  adminResetTournament,
  adminSetOwnerCanAddParticipants,
  adminSetOwnerCanReshuffleGroups,
  adminSetOwnerCanSelectQualifiers,
  adminToggleDeleteTournament,
  adminToggleFeaturedTournament,
  adminToggleSuspendTournament,
  getTournamentById,
  listParticipants,
  listTournamentsAdmin,
} from "@/server/services/tournamentService";
import { getDrawsByTournament } from "@/server/services/drawService";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import { guardAdmin } from "@/server/auth/admin";

export async function adminStatsAction(): Promise<ActionResult<AdminStats>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await getAdminStats());
}

export async function adminListUsersAction(
  search = "",
  page = 1,
): Promise<ActionResult<Paginated<User>>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await searchUsers(search, page));
}

export async function adminSetUserTypeAction(
  userId: string,
  type: UserType,
): Promise<ActionResult<User>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");

  const parsed = userTypeSchema.safeParse(type);
  if (!parsed.success) return fail("Invalid role");
  if (userId === admin.uid && parsed.data !== "ADMIN") {
    return fail("You cannot remove your own admin access");
  }
  try {
    return ok(
      await setUserType(userId, parsed.data),
      parsed.data === "ADMIN" ? "User promoted to admin" : "User set to member",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminToggleBanUserAction(
  userId: string,
): Promise<ActionResult<boolean>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  if (userId === admin.uid) return fail("You cannot ban yourself");
  try {
    const banned = await toggleSuspendUser(userId);
    return ok(
      banned,
      banned
        ? "User banned — their session has been revoked"
        : "User unbanned",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminToggleDeleteUserAction(
  userId: string,
): Promise<ActionResult<boolean>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  if (userId === admin.uid) return fail("You cannot delete yourself");
  try {
    const deleted = await toggleDeleteUser(userId);
    return ok(deleted, deleted ? "User deleted" : "User restored");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

/* ----------------------------- Orgs ----------------------------- */

export async function adminListOrgsAction(
  search = "",
  page = 1,
): Promise<ActionResult<Paginated<Org>>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await listOrgs(search, page));
}

export async function adminGetOrgAction(
  orgId: string,
): Promise<ActionResult<Org | null>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await getOrgByIdAdmin(orgId));
}

export async function adminListOrgMembersAction(
  orgId: string,
): Promise<ActionResult<OrgMemberWithUser[]>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await listMembers(orgId));
}

export async function adminUpdateOrgAction(
  orgId: string,
  input: unknown,
): Promise<ActionResult<Org>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = parseInput(updateOrgInputSchema, input);
  if (!parsed.ok) return fail(parsed.message, parsed.fieldErrors);
  try {
    return ok(await adminUpdateOrg(orgId, parsed.data), "Organization updated");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminToggleDeleteOrgAction(
  orgId: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const deleted = await toggleDeleteOrg(orgId);
    return ok(deleted, deleted ? "Organization deleted" : "Organization restored");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminRemoveOrgMemberAction(
  orgId: string,
  targetUid: string,
): Promise<ActionResult<null>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    await adminRemoveMember(orgId, targetUid);
    return ok(null, "Member removed");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

/* -------------------------- Tournaments ------------------------- */

export async function adminListTournamentsAction(
  search = "",
  page = 1,
): Promise<ActionResult<Paginated<Tournament>>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  return ok(await listTournamentsAdmin(search, page));
}

export async function adminToggleDeleteTournamentAction(
  id: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const deleted = await adminToggleDeleteTournament(id);
    return ok(deleted, deleted ? "Tournament deleted" : "Tournament restored");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminToggleFeaturedTournamentAction(
  id: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const featured = await adminToggleFeaturedTournament(id);
    return ok(
      featured,
      featured ? "Added to home banner" : "Removed from home banner",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminToggleSuspendTournamentAction(
  id: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const suspended = await adminToggleSuspendTournament(id);
    return ok(
      suspended,
      suspended ? "Tournament suspended" : "Tournament unsuspended",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminGetTournamentAction(
  id: string,
): Promise<
  ActionResult<{
    tournament: Tournament;
    drawCount: number;
    participants: RegisterTournament[];
  }>
> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const tournament = await getTournamentById(id);
  if (!tournament) return fail("Tournament not found");
  const [drawDocs, participants] = await Promise.all([
    getDrawsByTournament(id),
    listParticipants(id),
  ]);
  return ok({
    tournament,
    drawCount: drawDocs.length,
    participants,
  });
}

export async function adminResetTournamentAction(
  id: string,
): Promise<ActionResult<{ tournament: Tournament; deletedDraws: number }>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const result = await adminResetTournament(id);
    const extra =
      result.deletedDraws === 1
        ? "1 draw removed."
        : `${result.deletedDraws} draws removed.`;
    return ok(result, `Tournament reset. ${extra} Teams can join again.`);
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminSetOwnerCanReshuffleGroupsAction(
  id: string,
  enabled: boolean,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const next = await adminSetOwnerCanReshuffleGroups(id, enabled);
    return ok(
      next,
      next
        ? "Owners can reshuffle groups"
        : "Group reshuffle is locked to admins",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminSetOwnerCanAddParticipantsAction(
  id: string,
  enabled: boolean,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const next = await adminSetOwnerCanAddParticipants(id, enabled);
    return ok(
      next,
      next
        ? "Owners can add players"
        : "Adding players is locked to admins",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

export async function adminSetOwnerCanSelectQualifiersAction(
  id: string,
  enabled: boolean,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const next = await adminSetOwnerCanSelectQualifiers(id, enabled);
    return ok(
      next,
      next
        ? "The organiser can choose who qualifies"
        : "Qualification follows the group table",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}
