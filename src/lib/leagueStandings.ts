import type { Draw, Player, Teams } from "@/lib/schemas/draw";
import type { PointSystem } from "@/lib/schemas/tournament";
import type { TieBreaker } from "@/lib/schemas/common";

export interface LeagueStanding {
  TeamName: string;
  Icon: string;
  Players: Player[];
  Played: number;
  Won: number;
  Drawn: number;
  Lost: number;
  GoalsFor: number;
  GoalsAgainst: number;
  GoalDifference: number;
  Points: number;
}

export function standingToTeam(row: LeagueStanding): Teams {
  return {
    TeamName: row.TeamName,
    Players: row.Players,
    Icon: row.Icon,
    Points: row.Points,
    GoalsScored: row.GoalsFor,
    GoalsReceived: row.GoalsAgainst,
    GoalsDifference: row.GoalDifference,
  };
}

function emptyRow(team: Teams): LeagueStanding {
  return {
    TeamName: team.TeamName,
    Icon: team.Icon,
    Players: team.Players,
    Played: 0,
    Won: 0,
    Drawn: 0,
    Lost: 0,
    GoalsFor: 0,
    GoalsAgainst: 0,
    GoalDifference: 0,
    Points: 0,
  };
}

function applyResult(
  row: LeagueStanding,
  scored: number,
  conceded: number,
  points: PointSystem,
): void {
  row.Played += 1;
  row.GoalsFor += scored;
  row.GoalsAgainst += conceded;
  row.GoalDifference = row.GoalsFor - row.GoalsAgainst;
  if (scored > conceded) {
    row.Won += 1;
    row.Points += points.Win;
  } else if (scored < conceded) {
    row.Lost += 1;
  } else {
    row.Drawn += 1;
    row.Points += points.Draw;
  }
}

function compareRows(a: LeagueStanding, b: LeagueStanding): number {
  if (b.Points !== a.Points) return b.Points - a.Points;
  if (b.GoalDifference !== a.GoalDifference) {
    return b.GoalDifference - a.GoalDifference;
  }
  if (b.GoalsFor !== a.GoalsFor) return b.GoalsFor - a.GoalsFor;
  return a.TeamName.localeCompare(b.TeamName);
}

function matchesAmong(draws: Draw[], names: Set<string>): Draw[] {
  return draws.filter((draw) => {
    const a = draw.Team1?.TeamName;
    const b = draw.Team2?.TeamName;
    return Boolean(a && b && names.has(a) && names.has(b));
  });
}

/**
 * League table from played fixtures.
 * Default order: points, GD, GF, name.
 * Head-to-head: points, then a mini-table among teams on the same points,
 * then overall GD, GF, name.
 */
export function computeLeagueStandings(
  teams: Teams[],
  draws: Draw[],
  points: PointSystem = { Win: 3, Draw: 1 },
  tieBreaker: TieBreaker = "GOAL_DIFF",
): LeagueStanding[] {
  const table = new Map<string, LeagueStanding>();
  for (const team of teams) {
    if (!team.TeamName) continue;
    table.set(team.TeamName, emptyRow(team));
  }

  for (const draw of draws) {
    if (!draw.Played) continue;
    const team1 = draw.Team1;
    const team2 = draw.Team2;
    if (!team1?.TeamName || !team2?.TeamName) continue;
    if (!table.has(team1.TeamName)) table.set(team1.TeamName, emptyRow(team1));
    if (!table.has(team2.TeamName)) table.set(team2.TeamName, emptyRow(team2));
    applyResult(table.get(team1.TeamName)!, draw.Team1Score, draw.Team2Score, points);
    applyResult(table.get(team2.TeamName)!, draw.Team2Score, draw.Team1Score, points);
  }

  const rows = [...table.values()];
  if (tieBreaker !== "HEAD_TO_HEAD") {
    return rows.sort(compareRows);
  }

  const byPoints = new Map<number, LeagueStanding[]>();
  for (const row of rows) {
    const list = byPoints.get(row.Points) ?? [];
    list.push(row);
    byPoints.set(row.Points, list);
  }

  const ranked: LeagueStanding[] = [];
  for (const pts of [...byPoints.keys()].sort((a, b) => b - a)) {
    const bucket = byPoints.get(pts) ?? [];
    if (bucket.length <= 1) {
      ranked.push(...bucket);
      continue;
    }
    const names = new Set(bucket.map((row) => row.TeamName));
    const mini = computeLeagueStandings(
      bucket.map((row) => ({
        TeamName: row.TeamName,
        Players: row.Players,
        Icon: row.Icon,
        Points: 0,
        GoalsScored: 0,
        GoalsReceived: 0,
        GoalsDifference: 0,
      })),
      matchesAmong(draws, names),
      points,
      "GOAL_DIFF",
    );
    const miniRank = new Map(mini.map((row, index) => [row.TeamName, index]));
    ranked.push(
      ...[...bucket].sort((a, b) => {
        const ia = miniRank.get(a.TeamName) ?? 99;
        const ib = miniRank.get(b.TeamName) ?? 99;
        if (ia !== ib) return ia - ib;
        return compareRows(a, b);
      }),
    );
  }
  return ranked;
}

export function leagueMatchdayLabel(stage: number): string {
  return `MATCHDAY ${stage}`;
}
