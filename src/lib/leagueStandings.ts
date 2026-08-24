import type { Draw, Player, Teams } from "@/lib/schemas/draw";
import type { PointSystem } from "@/lib/schemas/tournament";

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

/** League table from played fixtures. Sort: points, GD, GF, then name. */
export function computeLeagueStandings(
  teams: Teams[],
  draws: Draw[],
  points: PointSystem = { Win: 3, Draw: 1 },
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

  return [...table.values()].sort((a, b) => {
    if (b.Points !== a.Points) return b.Points - a.Points;
    if (b.GoalDifference !== a.GoalDifference) {
      return b.GoalDifference - a.GoalDifference;
    }
    if (b.GoalsFor !== a.GoalsFor) return b.GoalsFor - a.GoalsFor;
    return a.TeamName.localeCompare(b.TeamName);
  });
}

export function leagueMatchdayLabel(stage: number): string {
  return `MATCHDAY ${stage}`;
}
