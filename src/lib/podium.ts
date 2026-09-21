import type { Draw, Teams } from "@/lib/schemas/draw";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import { computeLeagueStandings, standingToTeam } from "@/lib/leagueStandings";
import { computeBrStandings } from "@/lib/brStandings";
import { isThirdPlaceDraw } from "@/lib/drawKind";
import {
  formatForSeriesGames,
  groupKnockoutTies,
  knockoutTieLoser,
  knockoutTieWinner,
  teamsStillIn,
} from "@/lib/knockoutSeries";

export type Podium = {
  first: Teams;
  second?: Teams;
  third?: Teams;
};

function hydrate(
  team: Teams | null | undefined,
  participants: RegisterTournament[],
): Teams | undefined {
  const name = team?.TeamName?.trim();
  if (!team || !name) return undefined;
  const match = participants.find((p) => p.TeamName === name);
  if (!match) return team;
  return {
    ...team,
    Icon: team.Icon || match.Icon,
    Players: team.Players?.length ? team.Players : match.Players,
  };
}

function fromRows(
  rows: Teams[],
  participants: RegisterTournament[],
): Podium | null {
  const first = hydrate(rows[0], participants);
  if (!first) return null;
  return {
    first,
    second: hydrate(rows[1], participants),
    third: hydrate(rows[2], participants),
  };
}

function leagueComplete(tournament: Tournament, draws: Draw[]): boolean {
  if (tournament.Winner?.TeamName?.trim()) return true;
  const fixtures = draws.filter((d) => !d.BRTeams?.length);
  return fixtures.length > 0 && fixtures.every((d) => d.Played);
}

function knockoutPodium(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
): Podium | null {
  const ties = groupKnockoutTies(draws, false);
  let first: Teams | undefined;
  let second: Teams | undefined;
  if (ties.length > 0) {
    // Decided when one team is left standing and nothing is outstanding.
    // Reading the last round instead called a semi-final a final: on an
    // uneven bracket one half can play its last match a round early, and the
    // match that decides the event may not have been drawn yet.
    const { alive, allSettled } = teamsStillIn(ties, tournament.KnockoutFormat);
    if (allSettled && alive.length === 1) {
      const decider = ties
        .filter((tie) =>
          tie.games.some((game) =>
            [game.Team1, game.Team2].some(
              (team) => team?.TeamName?.trim() === alive[0],
            ),
          ),
        )
        .sort((a, b) => b.stage - a.stage)[0];
      if (decider) {
        const format = formatForSeriesGames(
          decider.games,
          tournament.KnockoutFormat,
        );
        first = knockoutTieWinner(decider.games, format) ?? undefined;
        second = knockoutTieLoser(decider.games, format) ?? undefined;
      }
    }
  }
  if (!first?.TeamName?.trim()) {
    first = tournament.Winner;
  }

  const hydratedFirst = hydrate(first, participants);
  if (!hydratedFirst) return null;

  let third: Teams | undefined;
  const thirdTies = groupKnockoutTies(draws, true).filter(
    (tie) =>
      tie.kind === "THIRD_PLACE" ||
      tie.games.some((game) => isThirdPlaceDraw(game)),
  );
  if (thirdTies.length === 1) {
    const format = formatForSeriesGames(
      thirdTies[0].games,
      tournament.KnockoutFormat,
    );
    third = knockoutTieWinner(thirdTies[0].games, format) ?? undefined;
  }

  return {
    first: hydratedFirst,
    second: hydrate(second, participants),
    third: hydrate(third, participants),
  };
}

export function resolvePodium(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
): Podium | null {
  if (tournament.TournamentMode === "LEAGUE") {
    if (!leagueComplete(tournament, draws)) {
      const only = hydrate(tournament.Winner, participants);
      return only ? { first: only } : null;
    }
    const teams: Teams[] = participants.map((p) => ({
      TeamName: p.TeamName,
      Players: p.Players,
      Icon: p.Icon,
      Points: 0,
      GoalsScored: 0,
      GoalsReceived: 0,
      GoalsDifference: 0,
    }));
    const table = computeLeagueStandings(
      teams,
      draws,
      tournament.PointSystem,
      tournament.TieBreaker,
    ).map(standingToTeam);
    return fromRows(table, participants);
  }

  if (tournament.TournamentMode === "BATTLEROYALE") {
    const table = computeBrStandings(draws, {
      PlacementPoints: tournament.BrPlacementPoints,
      KillPoints: tournament.BrKillPoints,
      FirstBloodPoints: tournament.BrFirstBloodPoints,
    }).filter((row) => row.Points > 0 || row.BestPlace > 0);
    return fromRows(
      table.map((row) => ({
        TeamName: row.TeamName,
        Players: row.Players,
        Icon: "",
        Points: row.Points,
        GoalsScored: 0,
        GoalsReceived: 0,
        GoalsDifference: 0,
      })),
      participants,
    );
  }

  return knockoutPodium(tournament, draws, participants);
}
