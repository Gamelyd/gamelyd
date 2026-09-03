import { leagueMatchdayLabel } from "@/lib/leagueStandings";

/**
 * What a round is called. Derived from how many matches it holds rather than
 * its number, so a bracket that starts at any size still names its last rounds
 * correctly.
 *
 * Lives here rather than beside the fixture component because the downloadable
 * images render on the server and cannot import client components.
 */
export function roundLabel(
  matchCount: number,
  stage: number,
  mode?: string,
): string {
  if (mode === "BATTLEROYALE") return `LOBBY ${stage}`;
  if (mode === "LEAGUE") return leagueMatchdayLabel(stage);
  if (matchCount < 2) return "FINALS";
  if (matchCount < 3) return "SEMI FINALS";
  if (matchCount < 5) return "QUARTER FINALS";
  if (matchCount < 9) return "ROUND OF SIXTEEN";
  return `ROUND ${stage}`;
}
