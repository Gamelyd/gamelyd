import { MODE_LABEL, withinLimit, type PlanLimits } from "@/lib/plans";
import type { TournamentMode } from "@/lib/schemas/common";

/**
 * Every "is this allowed" decision, as pure functions over a resolved
 * `PlanLimits`. Nothing here reads the database, the session, or settings, so
 * the rules can be exercised directly in tests and the services above stay
 * thin: fetch the config, call a check, translate a violation into an error.
 *
 * Each check returns `null` when the request is fine, or a violation carrying a
 * stable `code`. The code is what callers should branch on -- the message is
 * for humans and may be reworded freely.
 */

export type LimitCode =
  | "ORG_HOSTING"
  | "MODE"
  | "TEAMS"
  | "VENUES"
  | "ACTIVE"
  | "MANAGERS";

export interface LimitViolation {
  code: LimitCode;
  message: string;
}

/** Appended to every violation: the free tier is the product, so a limit is
 *  never "pay to remove". */
export const LIMIT_HINT = "Contact us if you need more.";

function violation(code: LimitCode, message: string): LimitViolation {
  return { code, message: `${message} ${LIMIT_HINT}` };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export interface CreateTournamentRequest {
  /** Empty when the host is publishing under their own name. */
  orgId: string;
  teams: number;
  mode: TournamentMode;
  venues: number;
  /** Tournaments the host already has open or running. */
  activeCount: number;
}

/**
 * Gate at creation only. A plan that lapses must never break a competition
 * players are already in the middle of, so this is never applied retroactively.
 *
 * `ignoreActiveCap` is for an event bought outright: they paid for this one
 * tournament, so how many others they have running is not our concern.
 */
export function checkCreateTournament(
  limits: PlanLimits,
  request: CreateTournamentRequest,
  options: { ignoreActiveCap?: boolean } = {},
): LimitViolation | null {
  if (request.orgId && !limits.canHostAsOrg) {
    return violation(
      "ORG_HOSTING",
      `The ${limits.label} plan cannot publish events under an organization's name.`,
    );
  }
  if (!limits.modes.includes(request.mode)) {
    const allowed = limits.modes.map((mode) => MODE_LABEL[mode]).join(", ");
    return violation(
      "MODE",
      `The ${limits.label} plan covers ${allowed}. ${MODE_LABEL[request.mode]} is not included.`,
    );
  }
  if (!withinLimit(request.teams, limits.maxTeams)) {
    return violation(
      "TEAMS",
      `A tournament can hold up to ${plural(limits.maxTeams, "team")}.`,
    );
  }
  if (request.venues > limits.maxVenues) {
    return violation(
      "VENUES",
      `An event can list up to ${plural(limits.maxVenues, "venue")}.`,
    );
  }
  if (
    !options.ignoreActiveCap &&
    limits.maxActive !== null &&
    request.activeCount >= limits.maxActive
  ) {
    return violation(
      "ACTIVE",
      `You can run ${plural(limits.maxActive, "tournament")} at a time. Finish one first.`,
    );
  }
  return null;
}

/**
 * Stops a small event being created and then edited past the ceiling.
 *
 * `createdSize` is the size the event already holds: an event that was bought,
 * or created while a higher tier applied, keeps that as its own ceiling so it
 * stays editable after the tier changes. This can never grow an event beyond
 * what it already was.
 */
export function checkResize(
  limits: PlanLimits,
  teams: number,
  createdSize: number,
): LimitViolation | null {
  if (withinLimit(teams, limits.maxTeams)) return null;
  if (teams <= createdSize) return null;
  return violation(
    "TEAMS",
    `A tournament can hold up to ${plural(limits.maxTeams, "team")}.`,
  );
}

/** `currentCount` is co-managers already on the event, excluding the creator. */
export function checkAddManager(
  limits: PlanLimits,
  currentCount: number,
): LimitViolation | null {
  if (limits.maxManagers === 0) {
    return violation(
      "MANAGERS",
      `The ${limits.label} plan does not include co-managers.`,
    );
  }
  if (withinLimit(currentCount + 1, limits.maxManagers)) return null;
  return violation(
    "MANAGERS",
    `The ${limits.label} plan allows ${plural(limits.maxManagers ?? 0, "co-manager")}.`,
  );
}
