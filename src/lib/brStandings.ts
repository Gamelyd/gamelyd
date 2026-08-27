import type { BRTeams, Draw, Player } from "@/lib/schemas/draw";

export const DEFAULT_BR_PLACEMENT = [12, 9, 7, 5, 4, 3, 2, 1];

export type BrScoring = {
  PlacementPoints: number[];
  KillPoints: number;
  FirstBloodPoints: number;
};

export type BrStanding = {
  TeamName: string;
  Players: Player[];
  PlacementPoints: number;
  KillPoints: number;
  FirstBloodPoints: number;
  Kills: number;
  FirstBloods: number;
  Points: number;
  BestPlace: number;
};

function placementPts(place: number, table: number[]): number {
  if (place < 1) return 0;
  return table[place - 1] ?? 0;
}

export function computeBrStandings(
  draws: Draw[],
  scoring: BrScoring,
): BrStanding[] {
  const rows = new Map<string, BrStanding>();

  const ensure = (team: BRTeams): BrStanding => {
    const existing = rows.get(team.TeamName);
    if (existing) return existing;
    const row: BrStanding = {
      TeamName: team.TeamName,
      Players: team.Players,
      PlacementPoints: 0,
      KillPoints: 0,
      FirstBloodPoints: 0,
      Kills: 0,
      FirstBloods: 0,
      Points: 0,
      BestPlace: 0,
    };
    rows.set(team.TeamName, row);
    return row;
  };

  for (const draw of draws) {
    if ((draw.BRTeams?.length ?? 0) === 0) continue;
    for (const team of draw.BRTeams) {
      const row = ensure(team);
      row.Kills += team.Kills || 0;
      row.FirstBloods += team.FirstBloods || 0;
      const place = team.Placement || 0;
      if (place > 0) {
        row.PlacementPoints += placementPts(place, scoring.PlacementPoints);
        if (row.BestPlace === 0 || place < row.BestPlace) row.BestPlace = place;
      }
    }
  }

  for (const row of rows.values()) {
    row.KillPoints = row.Kills * (scoring.KillPoints || 0);
    row.FirstBloodPoints = row.FirstBloods * (scoring.FirstBloodPoints || 0);
    row.Points = row.PlacementPoints + row.KillPoints + row.FirstBloodPoints;
  }

  return [...rows.values()].sort((a, b) => {
    if (b.Points !== a.Points) return b.Points - a.Points;
    if (a.BestPlace !== b.BestPlace) {
      if (a.BestPlace === 0) return 1;
      if (b.BestPlace === 0) return -1;
      return a.BestPlace - b.BestPlace;
    }
    if (b.Kills !== a.Kills) return b.Kills - a.Kills;
    return a.TeamName.localeCompare(b.TeamName);
  });
}

export function brLobbyComplete(draw: Draw): boolean {
  if ((draw.BRTeams?.length ?? 0) === 0) return false;
  if (draw.Played) return true;
  return draw.BRTeams.every((t) => (t.Placement || 0) > 0);
}

export function brChampionFromStandings(
  rows: BrStanding[],
): { TeamName: string; Players: Player[] } | undefined {
  const leader = rows[0];
  if (!leader || leader.Points <= 0 && leader.BestPlace === 0) return undefined;
  return { TeamName: leader.TeamName, Players: leader.Players };
}
