import "server-only";
import { orgs, tournaments, users } from "@/server/db";
import type { OrgDoc, TournamentDoc } from "@/server/documents";
import { asDocFilter, byUserId, notDeleted } from "@/server/legacy";
import { ServiceError } from "@/server/services/userService";
import {
  MODE_LABEL,
  PLANS,
  planLimits,
  planSchema,
  withinLimit,
  type Plan,
  type PlanLimits,
} from "@/lib/plans";
import type { TournamentMode } from "@/lib/schemas/common";

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
    if (org) return normalize(org.plan);
  }
  const user = await (await users()).findOne({ user_id: uid });
  return normalize(user?.plan);
}

function normalize(value: unknown): Plan {
  const parsed = planSchema.safeParse(
    typeof value === "string" ? value.toUpperCase() : "",
  );
  return parsed.success ? parsed.data : "FREE";
}

export async function limitsForHost(
  uid: string,
  orgId: string | undefined,
): Promise<PlanLimits> {
  return planLimits(await planForHost(uid, orgId));
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

function upgradeHint(current: Plan): string {
  return current === "LEAGUE"
    ? ""
    : " Upgrade your plan to lift this limit.";
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
  const limits = PLANS[plan];
  const hint = upgradeHint(plan);

  if (input.orgId && !limits.canHostAsOrg) {
    throw new ServiceError(
      `The ${limits.label} plan cannot publish events under an organization's name.${hint}`,
    );
  }
  if (!limits.modes.includes(input.mode)) {
    const allowed = limits.modes.map((m) => MODE_LABEL[m]).join(", ");
    throw new ServiceError(
      `The ${limits.label} plan covers ${allowed}. ${MODE_LABEL[input.mode]} needs a higher plan.${hint}`,
    );
  }
  if (!withinLimit(input.teams, limits.maxTeams)) {
    throw new ServiceError(
      `The ${limits.label} plan allows up to ${limits.maxTeams} teams per tournament.${hint}`,
    );
  }
  if (input.venues > limits.maxVenues) {
    throw new ServiceError(
      `The ${limits.label} plan allows ${limits.maxVenues} venue${limits.maxVenues === 1 ? "" : "s"} per event.${hint}`,
    );
  }
  if (limits.maxActive !== null && !paidTier) {
    const active = await activeTournamentCount(uid);
    if (active >= limits.maxActive) {
      throw new ServiceError(
        `The ${limits.label} plan allows ${limits.maxActive} tournament${limits.maxActive === 1 ? "" : "s"} running at a time. Finish one first, or upgrade.`,
      );
    }
  }
}

/** Stops a small event being created and then edited past the tier ceiling. */
export async function assertCanResize(
  doc: TournamentDoc,
  teams: number,
): Promise<void> {
  const plan = await planForHost(doc.User_id, doc.OrgId || undefined);
  const limits = PLANS[plan];
  if (withinLimit(teams, limits.maxTeams)) return;
  // A one-off (or otherwise larger) event keeps the size it was created at as
  // its own ceiling, so a paid event stays editable even on a free plan. This
  // never lets a host grow past what they already paid for.
  if (teams <= (doc.TournamentSize ?? 0)) return;
  throw new ServiceError(
    `The ${limits.label} plan allows up to ${limits.maxTeams} teams.${upgradeHint(plan)}`,
  );
}

export async function assertCanAddManager(
  doc: TournamentDoc,
  currentCount: number,
): Promise<void> {
  const plan = await planForHost(doc.User_id, doc.OrgId || undefined);
  const limits = PLANS[plan];
  if (limits.maxManagers === 0) {
    throw new ServiceError(
      `The ${limits.label} plan does not include co-managers.${upgradeHint(plan)}`,
    );
  }
  if (!withinLimit(currentCount + 1, limits.maxManagers)) {
    throw new ServiceError(
      `The ${limits.label} plan allows ${limits.maxManagers} co-managers.${upgradeHint(plan)}`,
    );
  }
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
