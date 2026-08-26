import type { GroupQualifier } from "@/lib/schemas/tournament";
import type { LeagueStanding } from "@/lib/leagueStandings";

export function qualifiersForGroup(
  qualifiers: GroupQualifier[],
  groupName: string,
): GroupQualifier[] {
  return qualifiers
    .filter((q) => q.GroupName === groupName)
    .sort((a, b) => a.Seed - b.Seed);
}

export function qualifierForTeam(
  qualifiers: GroupQualifier[],
  groupName: string,
  teamName: string,
): GroupQualifier | undefined {
  return qualifiers.find(
    (q) => q.GroupName === groupName && q.TeamName === teamName,
  );
}

export function reasonByTeamName(
  qualifiers: GroupQualifier[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of qualifiers) {
    if (q.TeamName && q.Reason) out[q.TeamName] = q.Reason;
  }
  return out;
}

export type GroupTieBreak = {
  groupName: string;
  remainingSlots: number;
  autoQualified: string[];
  candidates: string[];
  points: number;
};

/** Teams level on points that straddle the last qualifying place. */
export function groupTieBreak(
  standings: LeagueStanding[],
  advancePerGroup: number,
  groupName: string,
  disqualified: Set<string> = new Set(),
): GroupTieBreak | null {
  const eligible = standings.filter((row) => !disqualified.has(row.TeamName));
  const n = Math.min(Math.max(0, advancePerGroup), eligible.length);
  if (n === 0) return null;

  let remaining = n;
  const autoQualified: string[] = [];
  let i = 0;
  while (i < eligible.length && remaining > 0) {
    const pts = eligible[i].Points;
    let j = i + 1;
    while (j < eligible.length && eligible[j].Points === pts) j += 1;
    const cluster = eligible.slice(i, j);
    if (cluster.length <= remaining) {
      autoQualified.push(...cluster.map((row) => row.TeamName));
      remaining -= cluster.length;
      i = j;
      continue;
    }
    return {
      groupName,
      remainingSlots: remaining,
      autoQualified,
      candidates: cluster.map((row) => row.TeamName),
      points: pts,
    };
  }
  return null;
}

export function eligibleStandings(
  standings: LeagueStanding[],
  disqualified: Set<string>,
): LeagueStanding[] {
  return standings.filter((row) => !disqualified.has(row.TeamName));
}

/** Who goes through: table order, except organiser picks when a points tie is saved. */
export function resolvedQualifyingNames(
  standings: LeagueStanding[],
  groupName: string,
  advancePerGroup: number,
  picks: GroupQualifier[],
  disqualified: Set<string>,
  manualSelection: boolean,
): string[] {
  const eligible = eligibleStandings(standings, disqualified);
  const n = Math.min(Math.max(0, advancePerGroup), eligible.length);
  if (n === 0) return [];

  if (!manualSelection) {
    return eligible.slice(0, n).map((row) => row.TeamName);
  }

  const tie = groupTieBreak(standings, advancePerGroup, groupName, disqualified);
  if (!tie) {
    return eligible.slice(0, n).map((row) => row.TeamName);
  }

  const chosen = qualifiersForGroup(picks, groupName)
    .map((q) => q.TeamName)
    .filter((name) => tie.candidates.includes(name));
  if (chosen.length !== tie.remainingSlots) {
    return [...tie.autoQualified];
  }
  return [...tie.autoQualified, ...chosen];
}

export function groupQualifiersComplete(
  groups: { name: string; standings: LeagueStanding[] }[],
  picks: GroupQualifier[],
  advancePerGroup: number,
  disqualified: Set<string>,
  manualSelection: boolean,
): boolean {
  if (!manualSelection) return true;
  return groups.every((group) => {
    const tie = groupTieBreak(
      group.standings,
      advancePerGroup,
      group.name,
      disqualified,
    );
    if (!tie) return true;
    const chosen = qualifiersForGroup(picks, group.name);
    if (chosen.length !== tie.remainingSlots) return false;
    const names = new Set(chosen.map((q) => q.TeamName));
    if (names.size !== tie.remainingSlots) return false;
    return chosen.every(
      (q) =>
        tie.candidates.includes(q.TeamName) && q.Reason.trim().length >= 3,
    );
  });
}

export function tiesNeedingPicks(
  groups: { name: string; standings: LeagueStanding[] }[],
  advancePerGroup: number,
  disqualified: Set<string>,
): GroupTieBreak[] {
  return groups
    .map((group) =>
      groupTieBreak(
        group.standings,
        advancePerGroup,
        group.name,
        disqualified,
      ),
    )
    .filter((tie): tie is GroupTieBreak => Boolean(tie));
}

export function asDisqualifiedSet(names: string[] | undefined): Set<string> {
  return new Set((names ?? []).filter(Boolean));
}
