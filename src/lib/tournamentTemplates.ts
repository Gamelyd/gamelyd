import { z } from "zod";
import {
  knockoutFormatSchema,
  tournamentModeSchema,
  type TournamentMode,
} from "@/lib/schemas/common";

/**
 * Ready-made tournament setups.
 *
 * Time-to-first-tournament is the number that governs everything else, and the
 * create wizard asks a lot of a host who has never run an event: format, size,
 * group counts, points, tie-breaks. A template answers all of it, leaving only
 * the parts that are genuinely theirs -- the name, the game, the date.
 *
 * Deliberately few. One or two per format is a shortcut; a wall of them is just
 * the original decision wearing a different hat.
 *
 * These are DEFAULTS. The live list is stored in platform settings and edited
 * from the admin desk, so adding or retiring one does not need a deploy.
 */
export const tournamentTemplateSchema = z.object({
  /** Stable key. Kept when a template is renamed so analytics still line up. */
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  blurb: z.string().max(140).default(""),
  mode: tournamentModeSchema,
  size: z.number().int().min(2).max(4096),
  /** Players per registered team. 1 is a solo event. */
  rosterCount: z.number().int().min(1).max(50).default(1),
  returnLeg: z.boolean().default(false),
  /** Groups stage only; 0 elsewhere. */
  groupCount: z.number().int().min(0).max(32).default(0),
  advancePerGroup: z.number().int().min(1).max(16).default(2),
  knockoutFormat: knockoutFormatSchema.default("SINGLE"),
  thirdPlace: z.boolean().default(false),
  pointsWin: z.number().int().min(0).max(10).default(3),
  pointsDraw: z.number().int().min(0).max(10).default(1),
  /** Off keeps a template out of the picker without deleting its history. */
  enabled: z.boolean().default(true),
});
export type TournamentTemplate = z.infer<typeof tournamentTemplateSchema>;

export const templateListSchema = z.array(tournamentTemplateSchema).max(24);

export const DEFAULT_TEMPLATES: TournamentTemplate[] = [
  {
    id: "knockout-8",
    name: "8-team knockout",
    blurb: "Straight to the bracket. The quickest event to set up.",
    mode: "MULTIPLAYER",
    size: 8,
    rosterCount: 1,
    returnLeg: false,
    groupCount: 0,
    advancePerGroup: 2,
    knockoutFormat: "SINGLE",
    thirdPlace: true,
    pointsWin: 3,
    pointsDraw: 1,
    enabled: true,
  },
  {
    id: "knockout-16",
    name: "16-team knockout",
    blurb: "Four rounds to a winner. Good for an afternoon.",
    mode: "MULTIPLAYER",
    size: 16,
    rosterCount: 1,
    returnLeg: false,
    groupCount: 0,
    advancePerGroup: 2,
    knockoutFormat: "SINGLE",
    thirdPlace: true,
    pointsWin: 3,
    pointsDraw: 1,
    enabled: true,
  },
  {
    id: "groups-16",
    name: "16 teams, groups then knockout",
    blurb: "Four groups of four, top two go through. The classic cup format.",
    mode: "GROUPS",
    size: 16,
    rosterCount: 1,
    returnLeg: false,
    groupCount: 4,
    advancePerGroup: 2,
    knockoutFormat: "SINGLE",
    thirdPlace: true,
    pointsWin: 3,
    pointsDraw: 1,
    enabled: true,
  },
  {
    id: "league-10",
    name: "10-team league",
    blurb: "Everyone plays everyone once. Table decides it.",
    mode: "LEAGUE",
    size: 10,
    rosterCount: 1,
    returnLeg: false,
    groupCount: 0,
    advancePerGroup: 2,
    knockoutFormat: "SINGLE",
    thirdPlace: false,
    pointsWin: 3,
    pointsDraw: 1,
    enabled: true,
  },
  {
    id: "battle-royale-12",
    name: "12-squad battle royale",
    blurb: "Placement and kill points across lobbies.",
    mode: "BATTLEROYALE",
    size: 12,
    rosterCount: 4,
    returnLeg: false,
    groupCount: 0,
    advancePerGroup: 2,
    knockoutFormat: "SINGLE",
    thirdPlace: false,
    pointsWin: 3,
    pointsDraw: 1,
    enabled: true,
  },
];

/**
 * Consistency rules a template must satisfy to be usable. These are not schema
 * constraints because they span fields: a groups template with no groups, or
 * one whose teams do not divide evenly, produces a draw nobody can run.
 *
 * Returns a list of human-readable problems; empty means the template is fine.
 */
export function validateTemplate(template: TournamentTemplate): string[] {
  const issues: string[] = [];

  if (template.mode === "GROUPS") {
    if (template.groupCount < 2) {
      issues.push("A groups template needs at least 2 groups.");
    } else if (template.size % template.groupCount !== 0) {
      issues.push(
        `${template.size} teams do not divide evenly into ${template.groupCount} groups.`,
      );
    } else if (template.advancePerGroup >= template.size / template.groupCount) {
      issues.push(
        "Advancing that many from each group would qualify the whole group.",
      );
    }
  } else if (template.groupCount > 0) {
    issues.push("Only a groups template can set a group count.");
  }

  // A knockout bracket has to halve cleanly the whole way down.
  if (template.mode === "MULTIPLAYER" && !isPowerOfTwo(template.size)) {
    issues.push("A knockout needs a power of two: 4, 8, 16, 32, and so on.");
  }

  return issues;
}

function isPowerOfTwo(value: number): boolean {
  return value >= 2 && (value & (value - 1)) === 0;
}

/** The picker only ever shows templates a host can actually use right now. */
export function usableTemplates(
  templates: TournamentTemplate[],
  limits: { maxTeams: number; modes: TournamentMode[] },
): TournamentTemplate[] {
  return templates.filter(
    (template) =>
      template.enabled &&
      template.size <= limits.maxTeams &&
      limits.modes.includes(template.mode) &&
      validateTemplate(template).length === 0,
  );
}

/**
 * Merges a saved list over the shipped defaults. A list that no longer
 * validates falls back rather than throwing, so a bad row cannot break the
 * create page.
 */
export function resolveTemplates(raw: unknown): {
  templates: TournamentTemplate[];
  ok: boolean;
} {
  if (raw === undefined || raw === null) {
    return { templates: DEFAULT_TEMPLATES, ok: true };
  }
  const parsed = templateListSchema.safeParse(raw);
  if (!parsed.success) return { templates: DEFAULT_TEMPLATES, ok: false };
  return { templates: parsed.data, ok: true };
}
