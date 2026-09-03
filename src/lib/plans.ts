import { z } from "zod";
import {
  currencySchema,
  tournamentModeSchema,
  type TournamentMode,
} from "@/lib/schemas/common";

/**
 * Gamelyd does not sell the software. Running and joining a tournament is free
 * at any size a normal organiser will reach, because the tools we are compared
 * against are already free: a price on the bracket is a reason not to start,
 * and someone who never starts is worth nothing to us later.
 *
 * So the free tier is the product. What the paid tier sells is identity --
 * branding, a club page without our name on it -- not capacity. That is the
 * only lever left once capacity is commoditised, and it is the one the market
 * leader actually charges for.
 *
 * These are DEFAULTS. The live values are stored in platform settings and
 * edited from the admin desk (see `getPlans` in settingsService), so tuning a
 * limit does not need a deploy. Everything that reads a limit should read the
 * resolved config, not this constant -- this is only the fallback when nothing
 * has been saved yet.
 */
export const planSchema = z.enum(["FREE", "CLUB"]);
export type Plan = z.infer<typeof planSchema>;

export const PLAN_ORDER: Plan[] = ["FREE", "CLUB"];

/** How often a tier bills. `NONE` is the free tier. */
export const planIntervalSchema = z.enum(["NONE", "MONTH", "YEAR"]);
export type PlanInterval = z.infer<typeof planIntervalSchema>;

/**
 * Everything an admin can tune per tier. `null` means no limit and is
 * JSON-safe, unlike Infinity.
 *
 * `maxTeams` is the one field that is not really pricing: `TournamentSize` has
 * no upper bound in its own schema, so this is the only thing standing between
 * us and a bracket large enough to take the site down. Never set it to null.
 */
export const planLimitsSchema = z.object({
  label: z.string().min(1).max(40),
  blurb: z.string().max(200),
  maxTeams: z.number().int().positive().max(4096),
  modes: z.array(tournamentModeSchema).min(1),
  maxActive: z.number().int().positive().nullable(),
  maxManagers: z.number().int().nonnegative().nullable(),
  maxVenues: z.number().int().positive().max(64),
  canHostAsOrg: z.boolean(),
  /** Custom colours and imagery on the public tournament page. */
  canBrand: z.boolean(),
  /** Whether public pages carry "Powered by Gamelyd". Removing it is the sale. */
  showsAttribution: z.boolean(),
  /** Minor units, so 500 = EUR 5.00. Zero is free. */
  priceMinor: z.number().int().nonnegative(),
  currency: currencySchema,
  interval: planIntervalSchema,
  /** Whether the pricing page offers this tier at all. */
  sold: z.boolean(),
});
export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const planConfigSchema = z.object({
  FREE: planLimitsSchema,
  CLUB: planLimitsSchema,
});
export type PlanConfig = z.infer<typeof planConfigSchema>;

const ALL_MODES: TournamentMode[] = [
  "MULTIPLAYER",
  "GROUPS",
  "LEAGUE",
  "BATTLEROYALE",
];

export const DEFAULT_PLANS: PlanConfig = {
  FREE: {
    label: "Free",
    blurb: "Every format, every tool, as many tournaments as you want.",
    // 256 is what an organiser comparing tools already has as their reference
    // point for "free", and it is 8x what the next competitor allows. Past it
    // an event is rare enough, and heavy enough to run, to be worth a
    // conversation rather than a silent failure.
    maxTeams: 256,
    modes: ALL_MODES,
    maxActive: null,
    // Not zero (that was hostile) and not unlimited: seats are the natural
    // anchor for the paid tier, and a cap added after launch is a takeaway,
    // which costs far more goodwill than one that was always there. Three
    // covers any organiser who is not running a club.
    maxManagers: 3,
    maxVenues: 8,
    canHostAsOrg: true,
    canBrand: false,
    showsAttribution: true,
    priceMinor: 0,
    currency: "EUR",
    interval: "NONE",
    sold: true,
  },
  CLUB: {
    label: "Club",
    blurb: "Your club's name on it, not ours.",
    // The market leader charges to go from 256 to 512; match the shape of that
    // step rather than inventing one.
    maxTeams: 512,
    modes: ALL_MODES,
    maxActive: null,
    maxManagers: null,
    maxVenues: 8,
    canHostAsOrg: true,
    canBrand: true,
    showsAttribution: false,
    // Undercuts Challonge Premier (~EUR 6.50/mo billed yearly, EUR 11 monthly)
    // and sits far below Toornament Community (EUR 19/mo). Low enough that a
    // club treasurer approves it without a meeting.
    priceMinor: 500,
    currency: "EUR",
    interval: "MONTH",
    sold: true,
  },
};

/**
 * Tiers we no longer sell still exist in user and org documents. Map them onto
 * something current rather than silently dropping a paying customer to FREE.
 */
const LEGACY_PLANS: Record<string, Plan> = { LEAGUE: "CLUB", PRO: "CLUB" };

/** Unknown or missing tiers fall back to FREE rather than throwing. */
export function normalizePlan(value: unknown): Plan {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const parsed = planSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return LEGACY_PLANS[raw] ?? "FREE";
}

/**
 * Merges a saved config over the defaults, tier by tier, so a field added to
 * `planLimitsSchema` later still resolves for a row written before it existed.
 *
 * Pure on purpose: a config that no longer validates (a bad hand-edit in Mongo,
 * say) must not take the site down, so this falls back to the defaults instead
 * of throwing on a read that sits in the middle of the create flow. Callers can
 * tell the two apart via `ok`.
 */
export function resolvePlanConfig(raw: unknown): {
  config: PlanConfig;
  ok: boolean;
} {
  if (raw === undefined || raw === null) return { config: DEFAULT_PLANS, ok: true };
  if (typeof raw !== "object") return { config: DEFAULT_PLANS, ok: false };
  const saved = raw as Partial<Record<Plan, unknown>>;
  // One corrupt tier defaults on its own rather than discarding a valid
  // override on the other, but it still reports `ok: false` so the caller can
  // log it. Silently repairing bad data hides it forever.
  let ok = true;
  const merged = Object.fromEntries(
    PLAN_ORDER.map((plan) => {
      const override = saved[plan];
      if (override === undefined || override === null) {
        return [plan, DEFAULT_PLANS[plan]];
      }
      if (typeof override !== "object") {
        ok = false;
        return [plan, DEFAULT_PLANS[plan]];
      }
      return [plan, { ...DEFAULT_PLANS[plan], ...override }];
    }),
  );
  const parsed = planConfigSchema.safeParse(merged);
  return parsed.success
    ? { config: parsed.data, ok }
    : { config: DEFAULT_PLANS, ok: false };
}

export function planLimits(
  config: PlanConfig,
  plan: Plan | undefined,
): PlanLimits {
  return config[plan ?? "FREE"] ?? config.FREE;
}

export function withinLimit(value: number, limit: number | null): boolean {
  return limit === null || value <= limit;
}

export function limitLabel(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}

export const INTERVAL_LABEL: Record<PlanInterval, string> = {
  NONE: "",
  MONTH: "/month",
  YEAR: "/year",
};

export const MODE_LABEL: Record<TournamentMode, string> = {
  MULTIPLAYER: "Knockout",
  GROUPS: "Groups",
  LEAGUE: "League",
  BATTLEROYALE: "Battle royale",
};
