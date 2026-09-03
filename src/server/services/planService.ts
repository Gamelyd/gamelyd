import "server-only";
import { orgs, tournaments, users } from "@/server/db";
import type { OrgDoc, TournamentDoc } from "@/server/documents";
import { asDocFilter, byUserId, notDeleted } from "@/server/legacy";
import { ServiceError } from "@/server/services/userService";
import { getPlans } from "@/server/services/settingsService";
import { normalizePlan, type Plan, type PlanLimits } from "@/lib/plans";
import {
  checkAddManager,
  checkCreateTournament,
  checkResize,
  type LimitViolation,
} from "@/lib/planPolicy";
import type { TournamentMode } from "@/lib/schemas/common";

/**
 * Orchestration only. Every rule lives in `@/lib/planPolicy` as a pure
 * function; this module's job is to resolve whose plan applies, load the live
 * config, and turn a violation into the error the UI shows.
 */

/**
 * Which plan governs an event. A club's subscription covers whatever its
 * members create under the org name; a solo host is covered by their own.
 */
export async function planForHost(
  uid: string,
  orgId: string | undefined,
): Promise<Plan> {
  if (orgId) {
    const org = await (await orgs()).findOne({ org_id: orgId });
    if (org) return normalizePlan(org.plan);
  }
  const user = await (await users()).findOne({ user_id: uid });
  return normalizePlan(user?.plan);
}

/**
 * Limits always come from the saved config rather than the constants in
 * `@/lib/plans`, so an admin raising a ceiling takes effect without a deploy.
 */
export async function limitsForPlan(plan: Plan): Promise<PlanLimits> {
  return (await getPlans())[plan];
}

export async function limitsForHost(
  uid: string,
  orgId: string | undefined,
): Promise<PlanLimits> {
  return limitsForPlan(await planForHost(uid, orgId));
}

/** Events a host has open or running. Finished ones do not count. */
export async function activeTournamentCount(uid: string): Promise<number> {
  return (await tournaments()).countDocuments(
    asDocFilter<TournamentDoc>({
      $and: [
        byUserId(uid),
        notDeleted(),
        // A tournament with a champion is done and no longer occupies a slot.
        { $or: [{ Winner: { $exists: false } }, { "Winner.TeamName": "" }] },
      ],
    }),
  );
}

function reject(violation: LimitViolation | null): void {
  if (violation) throw new ServiceError(violation.message);
}

/**
 * Gate at creation only. A plan that lapses must never break a competition
 * players are already in the middle of, so nothing here runs retroactively.
 */
export async function assertCanCreateTournament(
  uid: string,
  input: {
    orgId: string;
    teams: number;
    mode: TournamentMode;
    venues: number;
  },
  /** A tier bought with a one-off payment. When set, it replaces the host's plan
   *  and the active-count cap does not apply (they paid for this one event). */
  paidTier?: Plan,
): Promise<void> {
  const plan = paidTier ?? (await planForHost(uid, input.orgId || undefined));
  const limits = await limitsForPlan(plan);
  // Only counted when a cap could actually bite, so the common unlimited case
  // costs no query.
  const activeCount =
    limits.maxActive !== null && !paidTier
      ? await activeTournamentCount(uid)
      : 0;
  reject(
    checkCreateTournament(
      limits,
      { ...input, activeCount },
      { ignoreActiveCap: Boolean(paidTier) },
    ),
  );
}

/** Stops a small event being created and then edited past the tier ceiling. */
export async function assertCanResize(
  doc: TournamentDoc,
  teams: number,
): Promise<void> {
  const limits = await limitsForHost(doc.User_id, doc.OrgId || undefined);
  reject(checkResize(limits, teams, doc.TournamentSize ?? 0));
}

export async function assertCanAddManager(
  doc: TournamentDoc,
  currentCount: number,
): Promise<void> {
  const limits = await limitsForHost(doc.User_id, doc.OrgId || undefined);
  reject(checkAddManager(limits, currentCount));
}

/** Admin: move a host onto another tier. */
export async function setPlan(
  target: { kind: "org" | "user"; id: string },
  plan: Plan,
): Promise<void> {
  const now = new Date().toISOString();
  if (target.kind === "org") {
    const result = await (
      await orgs()
    ).updateOne(
      { org_id: target.id } as Partial<OrgDoc>,
      { $set: { plan, updated_at: now } },
    );
    if (result.matchedCount === 0) {
      throw new ServiceError("Organization not found");
    }
    return;
  }
  const result = await (
    await users()
  ).updateOne({ user_id: target.id }, { $set: { plan, updated_at: now } });
  if (result.matchedCount === 0) throw new ServiceError("User not found");
}
