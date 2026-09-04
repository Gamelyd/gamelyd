import type { LeagueStanding } from "@/lib/leagueStandings";

/**
 * Filling an incomplete knockout with the best teams that did not qualify.
 *
 * A group stage rarely produces a power of two. Twenty teams in four groups
 * with the top two through gives eight qualifiers, which is fine -- but three
 * through gives twelve, and a twelve-team bracket is lopsided: a third of the
 * field gets a bye while the rest play an extra round.
 *
 * When the host turns this on, the places left over are filled by the best
 * teams that missed out, ranked the way the World Cup ranks its best
 * third-placed teams: like against like first, so every third-placed side is
 * compared with the other third-placed sides before anyone's fourth is
 * considered.
 */

export interface LoserCandidate {
  group: string;
  teamName: string;
  /** Where they finished in their own group. 3 = third, and so on. */
  position: number;
  points: number;
  goalDifference: number;
  goalsFor: number;
}

/** The next power of two at or above `count`. */
export function nextPowerOfTwo(count: number): number {
  if (count <= 1) return 1;
  let size = 1;
  while (size < count) size *= 2;
  return size;
}

/**
 * How many places are missing before the bracket is a clean power of two.
 * Zero when it already is, or when there is nothing to build.
 */
export function slotsToFill(qualified: number): number {
  if (qualified < 2) return 0;
  return nextPowerOfTwo(qualified) - qualified;
}

/**
 * The teams that missed out, best first.
 *
 * Position leads the comparison: a third-placed team is ahead of every
 * fourth-placed one whatever its points, which is what makes this "best
 * third-placed teams" rather than "best remaining teams". Team name breaks a
 * complete tie so the same table always produces the same bracket.
 */
export function rankLosers(candidates: LoserCandidate[]): LoserCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      a.position - b.position ||
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
}

export function bestLosers(
  candidates: LoserCandidate[],
  slots: number,
): LoserCandidate[] {
  if (slots <= 0) return [];
  return rankLosers(candidates).slice(0, slots);
}

/**
 * Everyone in a group who did not go through, with the place they finished in.
 * `qualified` is the set of names already through, so a team picked by the host
 * on a points tie is never offered again as a loser.
 */
export function losersFromGroup(
  groupName: string,
  standings: LeagueStanding[],
  qualified: Set<string>,
): LoserCandidate[] {
  const out: LoserCandidate[] = [];
  standings.forEach((row, index) => {
    if (qualified.has(row.TeamName)) return;
    out.push({
      group: groupName,
      teamName: row.TeamName,
      position: index + 1,
      points: row.Points,
      goalDifference: row.GoalDifference,
      goalsFor: row.GoalsFor,
    });
  });
  return out;
}
