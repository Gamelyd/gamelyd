import type { Draw, Teams } from "@/lib/schemas/draw";
import type { TournamentGroup } from "@/lib/schemas/tournament";

/**
 * Swapping one team for another after a tournament has started.
 *
 * A host cannot simply remove a team once the draw exists -- the fixtures point
 * at it, and deleting them would tear a hole in the bracket. So a substitution
 * keeps every fixture exactly where it is and rewrites who is standing in the
 * slot.
 *
 * Matches that have already been played are left alone. A result is a record of
 * what happened, and the team that played it is part of that record; rewriting
 * it would show a team winning a match it never played. The replacement picks
 * up from the next fixture onwards.
 */

export interface DrawSwap {
  drawId: string;
  side: "Team1" | "Team2";
}

export interface SubstitutionPlan {
  /** Fixtures the replacement takes over. */
  swaps: DrawSwap[];
  /** Played fixtures left as they are, so the record still reads true. */
  playedLeftAlone: number;
}

function sideOf(draw: Draw, name: string): "Team1" | "Team2" | null {
  const target = name.trim().toLowerCase();
  if (draw.Team1?.TeamName?.trim().toLowerCase() === target) return "Team1";
  if (draw.Team2?.TeamName?.trim().toLowerCase() === target) return "Team2";
  return null;
}

export function planSubstitution(
  draws: Draw[],
  outTeamName: string,
): SubstitutionPlan {
  const swaps: DrawSwap[] = [];
  let playedLeftAlone = 0;

  for (const draw of draws) {
    const side = sideOf(draw, outTeamName);
    if (!side) continue;
    if (draw.Played) {
      playedLeftAlone += 1;
      continue;
    }
    swaps.push({ drawId: draw.DrawId, side });
  }
  return { swaps, playedLeftAlone };
}

/**
 * The replacement inherits the slot, not the history: no score, and no claim to
 * have won anything the outgoing team won.
 */
export function substitutedDraw(
  draw: Draw,
  side: "Team1" | "Team2",
  inTeam: Teams,
): Partial<Draw> {
  const patch: Partial<Draw> = { [side]: inTeam } as Partial<Draw>;
  // A winner recorded against a slot the outgoing team never finished would
  // hand the replacement a result they had no part in.
  if (draw.Winner === side) patch.Winner = "";
  return patch;
}

/** Groups list the same team, so the tables follow the substitution too. */
export function substituteInGroups(
  groups: TournamentGroup[],
  outTeamName: string,
  inTeam: Teams,
): TournamentGroup[] {
  const target = outTeamName.trim().toLowerCase();
  return groups.map((group) => ({
    ...group,
    Teams: (group.Teams ?? []).map((team) =>
      team.TeamName?.trim().toLowerCase() === target ? inTeam : team,
    ),
  }));
}

/** True when the team still has something left to play. */
export function hasUnplayedFixtures(draws: Draw[], teamName: string): boolean {
  return planSubstitution(draws, teamName).swaps.length > 0;
}
