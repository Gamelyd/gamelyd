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
  setUserDeleted,
  setUserSuspended,
  setUserType,
  setUserVerified,
  toggleDeleteUser,
  toggleSuspendUser,
  ServiceError,
} from "@/server/services/userService";
import {
  bulkTournamentOpSchema,
  bulkUserOpSchema,
  type BulkResult,
  type BulkTournamentOp,
  type BulkUserOp,
} from "@/lib/schemas/admin";
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
  setOrgVerified,
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
import { setPlan } from "@/server/services/planService";
import {
  setOneOff,
  setSponsorRequiresOrg,
} from "@/server/services/settingsService";
import { currencySchema } from "@/lib/schemas/common";
import { PLANS, planSchema, type Plan } from "@/lib/plans";
import {
  completeReport,
  deleteReport,
  getReportById,
  listReportsAdmin,
} from "@/server/services/contactService";
import type { ReportAbuse, ReportKind } from "@/lib/schemas/misc";
import {
  getPlatformSettings,
  setEventTypeEnabled,
  setPlatformFeeBps,
  type PlatformSettings,
} from "@/server/services/settingsService";

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
        ? "User banned. Their session has been revoked"
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

export async function adminSetUserVerifiedAction(
  userId: string,
  verified: boolean,
): Promise<ActionResult<User>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(
      await setUserVerified(userId, verified),
      verified ? "Player verified" : "Verification removed",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Something went wrong");
  }
}

/**
 * Applies one operation to many users. Each row is attempted independently so a
 * single failure (or the admin appearing in their own selection) does not stop
 * the rest, and the caller is told exactly how many landed.
 */
export async function adminBulkUserAction(
  userIds: string[],
  op: BulkUserOp,
): Promise<ActionResult<BulkResult>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  const parsed = bulkUserOpSchema.safeParse(op);
  if (!parsed.success) return fail("Unknown action");

  const ids = [...new Set(userIds.filter((id) => id.length > 0))].slice(0, 100);
  if (ids.length === 0) return fail("Select at least one user");

  let done = 0;
  const failed: string[] = [];
  for (const id of ids) {
    // Guard rails: an admin can never lock themselves out in a bulk sweep.
    if (
      id === admin.uid &&
      (parsed.data === "BAN" || parsed.data === "DELETE")
    ) {
      failed.push("You cannot ban or delete yourself");
      continue;
    }
    try {
      switch (parsed.data) {
        case "VERIFY":
          await setUserVerified(id, true);
          break;
        case "UNVERIFY":
          await setUserVerified(id, false);
          break;
        case "BAN":
          await setUserSuspended(id, true);
          break;
        case "UNBAN":
          await setUserSuspended(id, false);
          break;
        case "DELETE":
          await setUserDeleted(id, true);
          break;
        case "RESTORE":
          await setUserDeleted(id, false);
          break;
      }
      done += 1;
    } catch (error) {
      failed.push(
        error instanceof ServiceError ? error.message : "Update failed",
      );
    }
  }
  return ok(
    { done, failed },
    failed.length === 0
      ? `Updated ${done} user${done === 1 ? "" : "s"}`
      : `Updated ${done}, ${failed.length} failed`,
  );
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

export async function adminSetOrgVerifiedAction(
  orgId: string,
  verified: boolean,
): Promise<ActionResult<Org>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(
      await setOrgVerified(orgId, verified),
      verified ? "Organization verified" : "Verification removed",
    );
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

/**
 * Bulk tournament moderation. The underlying service calls are toggles (and the
 * featured one also juggles banner slots), so each row is only flipped when it
 * is not already in the requested state - that keeps the run idempotent.
 */
export async function adminBulkTournamentAction(
  tournamentIds: string[],
  op: BulkTournamentOp,
): Promise<ActionResult<BulkResult>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const parsed = bulkTournamentOpSchema.safeParse(op);
  if (!parsed.success) return fail("Unknown action");

  const ids = [...new Set(tournamentIds.filter((id) => id.length > 0))].slice(
    0,
    100,
  );
  if (ids.length === 0) return fail("Select at least one tournament");

  let done = 0;
  const failed: string[] = [];
  for (const id of ids) {
    try {
      const current = await getTournamentById(id);
      if (!current) {
        failed.push("Tournament not found");
        continue;
      }
      switch (parsed.data) {
        case "FEATURE":
          if (!current.Featured) await adminToggleFeaturedTournament(id);
          break;
        case "UNFEATURE":
          if (current.Featured) await adminToggleFeaturedTournament(id);
          break;
        case "SUSPEND":
          if (!current.IsSuspended) await adminToggleSuspendTournament(id);
          break;
        case "UNSUSPEND":
          if (current.IsSuspended) await adminToggleSuspendTournament(id);
          break;
        case "DELETE":
          if (!current.IsDeleted) await adminToggleDeleteTournament(id);
          break;
        case "RESTORE":
          if (current.IsDeleted) await adminToggleDeleteTournament(id);
          break;
      }
      done += 1;
    } catch (error) {
      failed.push(
        error instanceof ServiceError ? error.message : "Update failed",
      );
    }
  }
  return ok(
    { done, failed },
    failed.length === 0
      ? `Updated ${done} tournament${done === 1 ? "" : "s"}`
      : `Updated ${done}, ${failed.length} failed`,
  );
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

/* --------------------------- Platform settings --------------------------- */

export async function adminGetPlatformSettingsAction(): Promise<
  ActionResult<PlatformSettings>
> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(await getPlatformSettings());
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not load platform settings");
  }
}

/**
 * Sets the rate NEW tournaments are created with. Events already created keep
 * the rate stamped on them, so nobody's advertised terms change under them.
 */
export async function adminSetPlatformFeeAction(
  percent: number,
): Promise<ActionResult<PlatformSettings>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  if (!Number.isFinite(percent)) return fail("Enter a percentage");

  const bps = Math.round(percent * 100);
  try {
    await setPlatformFeeBps(bps, admin.uid);
    return ok(
      await getPlatformSettings(),
      `Platform fee set to ${percent}% for new tournaments`,
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not save the platform fee");
  }
}

/* ------------------------------- Reports ------------------------------- */

export async function adminListReportsAction(
  kind: ReportKind | "ALL" = "ALL",
  status: "OPEN" | "DONE" | "ALL" = "OPEN",
  page = 1,
): Promise<ActionResult<Paginated<ReportAbuse>>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    return ok(await listReportsAdmin({ kind, status, page }));
  } catch (error) {
    console.error(error);
    return fail("Could not load reports");
  }
}

export async function adminResolveReportAction(
  reportId: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const done = await completeReport(reportId);
    return ok(done, done ? "Marked as handled" : "Reopened");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Could not update that report");
  }
}

export async function adminDeleteReportAction(
  reportId: string,
): Promise<ActionResult<boolean>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  try {
    const deleted = await deleteReport(reportId);
    return ok(deleted, deleted ? "Report removed" : "Report restored");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    return fail("Could not update that report");
  }
}

/** Bulk resolve, so a wave of reports about one event clears in a click. */
export async function adminBulkResolveReportsAction(
  reportIds: string[],
): Promise<ActionResult<BulkResult>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  const ids = [...new Set(reportIds.filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return fail("Select at least one report");

  let done = 0;
  const failed: string[] = [];
  for (const id of ids) {
    try {
      const report = await getReportById(id);
      if (!report) {
        failed.push("Report not found");
        continue;
      }
      if (!report.IsCompleted) await completeReport(id);
      done += 1;
    } catch (error) {
      failed.push(
        error instanceof ServiceError ? error.message : "Update failed",
      );
    }
  }
  return ok(
    { done, failed },
    failed.length === 0
      ? `Handled ${done} report${done === 1 ? "" : "s"}`
      : `Handled ${done}, ${failed.length} failed`,
  );
}

/**
 * Pauses or resumes paid / sponsored tournament creation. Existing events are
 * untouched, so pausing never strands a tournament that is already running.
 */
export async function adminSetEventTypeEnabledAction(
  which: "paid" | "sponsored",
  enabled: boolean,
): Promise<ActionResult<PlatformSettings>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  if (which !== "paid" && which !== "sponsored") {
    return fail("Unknown event type");
  }
  try {
    const next = await setEventTypeEnabled(which, enabled, admin.uid);
    const label = which === "paid" ? "Paid" : "Sponsored";
    return ok(
      next,
      enabled
        ? `${label} tournaments are available again`
        : `${label} tournaments paused. Hosts will see "Coming back soon".`,
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not update that setting");
  }
}

/* -------------------------------- Plans -------------------------------- */

/**
 * Moves a host onto another tier. Sold by hand for now: an admin flips this
 * after an invoice is paid, which is enough to validate demand before any
 * self-serve billing gets built.
 */
export async function adminSetPlanAction(
  kind: "org" | "user",
  id: string,
  plan: Plan,
): Promise<ActionResult<{ ok: true }>> {
  if (!(await guardAdmin())) return fail("Admin access required");
  if (kind !== "org" && kind !== "user") return fail("Unknown target");
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return fail("Unknown plan");
  try {
    await setPlan({ kind, id }, parsed.data);
    return ok(
      { ok: true } as const,
      `Moved to the ${PLANS[parsed.data].label} plan`,
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not change that plan");
  }
}

/** Sets the one-off tournament price and which tier it unlocks. */
export async function adminSetOneOffAction(input: {
  enabled: boolean;
  price: number;
  currency: string;
  tier: Plan;
}): Promise<ActionResult<PlatformSettings>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  const currency = currencySchema.safeParse((input.currency || "").toUpperCase());
  const tier = planSchema.safeParse(input.tier);
  if (!currency.success) return fail("Pick a currency");
  if (!tier.success) return fail("Pick a tier");
  if (!Number.isFinite(input.price) || input.price < 0) {
    return fail("Enter a price");
  }
  try {
    const next = await setOneOff(
      {
        enabled: input.enabled,
        priceMinor: Math.round(input.price * 100),
        currency: currency.data,
        tier: tier.data,
      },
      admin.uid,
    );
    return ok(next, "One-off pricing saved");
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not save that");
  }
}

/** Toggle whether a solo host (not just orgs) can create sponsored events. */
export async function adminSetSponsorPolicyAction(
  requiresOrg: boolean,
): Promise<ActionResult<PlatformSettings>> {
  const admin = await guardAdmin();
  if (!admin) return fail("Admin access required");
  try {
    const next = await setSponsorRequiresOrg(requiresOrg, admin.uid);
    return ok(
      next,
      requiresOrg
        ? "Only organizations can create sponsored tournaments"
        : "Anyone can now create sponsored tournaments",
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    console.error(error);
    return fail("Could not save that");
  }
}
