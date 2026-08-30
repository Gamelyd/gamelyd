import { z } from "zod";
import type { TournamentMode } from "@/lib/schemas/common";

/**
 * What an organiser pays for. Players never pay a plan: the fee is for running
 * competitions, not for entering them.
 *
 * Limits are data, so changing a tier is one edit here rather than a hunt
 * through the services that enforce it.
 */
export const planSchema = z.enum(["FREE", "CLUB", "LEAGUE"]);
export type Plan = z.infer<typeof planSchema>;

/** `null` means no limit. JSON-safe, unlike Infinity. */
export interface PlanLimits {
  label: string;
  blurb: string;
  /** Teams allowed in one tournament. */
  maxTeams: number | null;
  /** Formats this plan may create. */
  modes: TournamentMode[];
  /** Tournaments that can be open or running at the same time. */
  maxActive: number | null;
  /** Co-managers beyond the creator. */
  maxManagers: number | null;
  /** Venues attachable to one event. */
  maxVenues: number;
  /** Whether events can be published under an organization's name. */
  canHostAsOrg: boolean;
}

const ALL_MODES: TournamentMode[] = [
  "MULTIPLAYER",
  "GROUPS",
  "LEAGUE",
  "BATTLEROYALE",
];

export const PLANS: Record<Plan, PlanLimits> = {
  FREE: {
    label: "Free",
    blurb: "Run a knockout for your friends. No limits on the basics.",
    maxTeams: 8,
    // Knockout only: it is what a casual organiser actually needs, and it keeps
    // the free tier genuinely useful rather than a crippled demo.
    modes: ["MULTIPLAYER"],
    maxActive: 1,
    maxManagers: 0,
    maxVenues: 1,
    canHostAsOrg: false,
  },
  CLUB: {
    label: "Club",
    blurb: "For clubs and venues running real competitions.",
    maxTeams: null,
    modes: ALL_MODES,
    maxActive: 5,
    maxManagers: 3,
    maxVenues: 8,
    canHostAsOrg: true,
  },
  LEAGUE: {
    label: "League",
    blurb: "For running competitions as a business.",
    maxTeams: null,
    modes: ALL_MODES,
    maxActive: null,
    maxManagers: null,
    maxVenues: 8,
    canHostAsOrg: true,
  },
};

export function planLimits(plan: Plan | undefined): PlanLimits {
  return PLANS[plan ?? "FREE"] ?? PLANS.FREE;
}

export function withinLimit(value: number, limit: number | null): boolean {
  return limit === null || value <= limit;
}

export function limitLabel(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}

export const MODE_LABEL: Record<TournamentMode, string> = {
  MULTIPLAYER: "Knockout",
  GROUPS: "Groups",
  LEAGUE: "League",
  BATTLEROYALE: "Battle royale",
};
