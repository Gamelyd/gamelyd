import type { Draw, Teams } from "@/lib/schemas/draw";
import type { KnockoutFormat } from "@/lib/schemas/common";
import { isKnockoutBye, isKnockoutMatchSettled } from "@/lib/knockoutSeed";
import { isKnockoutDraw, isThirdPlaceDraw } from "@/lib/drawKind";

export type KnockoutTie = {
  seriesId: string;
  stage: number;
  kind: string;
  games: Draw[];
};

export function knockoutLegCount(format: KnockoutFormat | undefined): number {
  if (format === "TWO_LEG") return 2;
  if (format === "BO3") return 3;
  if (format === "BO5") return 5;
  return 1;
}

export function knockoutWinsNeeded(format: KnockoutFormat | undefined): number {
  if (format === "BO5") return 3;
  if (format === "BO3") return 2;
  return 1;
}

export function knockoutFormatLabel(format: KnockoutFormat | undefined): string {
  if (format === "TWO_LEG") return "Two legs (aggregate)";
  if (format === "BO3") return "Best of 3";
  if (format === "BO5") return "Best of 5";
  return "Single match";
}

export function seriesKey(draw: Draw): string {
  return draw.SeriesId?.trim() || draw.DrawId;
}

function gameWinnerSide(draw: Draw): "Team1" | "Team2" | null {
  if (isKnockoutBye(draw)) return "Team1";
  if (draw.Winner === "Team1" || draw.Winner === "Team2") return draw.Winner;
  if (!draw.Played) return null;
  if (draw.Team1Score > draw.Team2Score) return "Team1";
  if (draw.Team2Score > draw.Team1Score) return "Team2";
  return null;
}

export function groupKnockoutTies(
  draws: Draw[],
  includeThirdPlace = false,
): KnockoutTie[] {
  const relevant = draws.filter((d) =>
    includeThirdPlace
      ? isKnockoutDraw(d) || isThirdPlaceDraw(d)
      : isKnockoutDraw(d),
  );
  const map = new Map<string, KnockoutTie>();
  for (const draw of relevant) {
    const id = seriesKey(draw);
    const existing = map.get(id);
    if (existing) {
      existing.games.push(draw);
      continue;
    }
    map.set(id, {
      seriesId: id,
      stage: draw.Stage,
      kind: draw.Kind || "",
      games: [draw],
    });
  }
  return [...map.values()].map((tie) => ({
    ...tie,
    games: [...tie.games].sort((a, b) => (a.Leg || 1) - (b.Leg || 1)),
  }));
}

export function tiesAtStage(ties: KnockoutTie[], stage: number): KnockoutTie[] {
  return ties.filter((tie) => tie.stage === stage);
}

function seriesWins(games: Draw[]): { team1: number; team2: number } {
  let team1 = 0;
  let team2 = 0;
  for (const game of games) {
    const side = gameWinnerSide(game);
    if (side === "Team1") team1 += 1;
    if (side === "Team2") team2 += 1;
  }
  return { team1, team2 };
}

function seriesAggregate(games: Draw[]): { team1: number; team2: number } {
  return games.reduce(
    (sum, game) => ({
      team1: sum.team1 + (game.Played || isKnockoutBye(game) ? game.Team1Score : 0),
      team2: sum.team2 + (game.Played || isKnockoutBye(game) ? game.Team2Score : 0),
    }),
    { team1: 0, team2: 0 },
  );
}

export function seriesDisplayScore(
  games: Draw[],
  format: KnockoutFormat | undefined,
): { team1: number; team2: number } {
  if (format === "TWO_LEG") return seriesAggregate(games);
  if (format === "BO3" || format === "BO5") return seriesWins(games);
  const game = games[0];
  if (!game) return { team1: 0, team2: 0 };
  return { team1: game.Team1Score, team2: game.Team2Score };
}

export function isKnockoutTieSettled(
  games: Draw[],
  format: KnockoutFormat | undefined,
): boolean {
  if (games.length === 0) return false;
  if (games.some(isKnockoutBye)) return true;
  if (!format || format === "SINGLE") {
    return games.every((g) => isKnockoutMatchSettled(g));
  }
  if (format === "TWO_LEG") {
    if (games.some((g) => !g.Played && !isKnockoutBye(g))) return false;
    const agg = seriesAggregate(games);
    if (agg.team1 !== agg.team2) return true;
    return games.some((g) => g.Winner === "Team1" || g.Winner === "Team2");
  }
  const needed = knockoutWinsNeeded(format);
  const wins = seriesWins(games);
  if (wins.team1 >= needed || wins.team2 >= needed) return true;
  const allPlayed = games.every((g) => g.Played || isKnockoutBye(g));
  if (allPlayed && wins.team1 !== wins.team2) return true;
  if (allPlayed) {
    return games.some((g) => g.Winner === "Team1" || g.Winner === "Team2");
  }
  return false;
}

export function knockoutTieWinner(
  games: Draw[],
  format: KnockoutFormat | undefined,
): Teams | null {
  if (!isKnockoutTieSettled(games, format)) return null;
  const first = games[0];
  if (!first) return null;
  if (games.some(isKnockoutBye)) return first.Team1 ?? null;

  if (format === "TWO_LEG") {
    const agg = seriesAggregate(games);
    if (agg.team1 > agg.team2) return first.Team1 ?? null;
    if (agg.team2 > agg.team1) return first.Team2 ?? null;
  } else if (format === "BO3" || format === "BO5") {
    const wins = seriesWins(games);
    if (wins.team1 > wins.team2) return first.Team1 ?? null;
    if (wins.team2 > wins.team1) return first.Team2 ?? null;
  }

  for (const game of [...games].reverse()) {
    const side = gameWinnerSide(game);
    if (side === "Team1") return first.Team1 ?? null;
    if (side === "Team2") return first.Team2 ?? null;
  }
  return null;
}

export function knockoutTieLoser(
  games: Draw[],
  format: KnockoutFormat | undefined,
): Teams | null {
  const winner = knockoutTieWinner(games, format);
  const first = games[0];
  if (!winner || !first) return null;
  if (winner.TeamName === first.Team1?.TeamName) return first.Team2 ?? null;
  return first.Team1 ?? null;
}

/** One display draw per series so the bracket stays one node per pairing. */
export function displayDrawForTie(
  tie: KnockoutTie,
  format: KnockoutFormat | undefined,
): Draw {
  const first = tie.games[0];
  const score = seriesDisplayScore(tie.games, format);
  const winner = knockoutTieWinner(tie.games, format);
  const settled = isKnockoutTieSettled(tie.games, format);
  let side: "" | "Team1" | "Team2" = "";
  if (winner && winner.TeamName === first.Team1?.TeamName) side = "Team1";
  if (winner && winner.TeamName === first.Team2?.TeamName) side = "Team2";
  return {
    ...first,
    Team1Score: score.team1,
    Team2Score: score.team2,
    Played: settled,
    Winner: side,
  };
}

export function knockoutRoundsForBracket(
  draws: Draw[],
  format: KnockoutFormat | undefined,
): { stage: number; matches: Draw[] }[] {
  const ties = groupKnockoutTies(draws, false);
  const byStage = new Map<number, Draw[]>();
  for (const tie of ties) {
    const list = byStage.get(tie.stage) ?? [];
    list.push(displayDrawForTie(tie, format));
    byStage.set(tie.stage, list);
  }
  return [...byStage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([stage, matches]) => ({ stage, matches }));
}

export function knockoutRoundComplete(
  draws: Draw[],
  stage: number,
  format: KnockoutFormat | undefined,
): boolean {
  const ties = tiesAtStage(groupKnockoutTies(draws, false), stage);
  return (
    ties.length > 0 &&
    ties.every((tie) => isKnockoutTieSettled(tie.games, format))
  );
}

export function knockoutRoundHasOpenTie(
  draws: Draw[],
  stage: number,
  format: KnockoutFormat | undefined,
): boolean {
  const ties = tiesAtStage(groupKnockoutTies(draws, false), stage);
  return ties.some((tie) => {
    if (!isKnockoutTieSettled(tie.games, format)) return false;
    return !knockoutTieWinner(tie.games, format);
  });
}

/**
 * True when the host must pick a winner because the series is level
 * (drawn single match, two-leg aggregate, or a best-of that ended even).
 */
export function tieNeedsHostPick(
  games: Draw[],
  format: KnockoutFormat | undefined,
): boolean {
  if (games.length === 0 || games.some(isKnockoutBye)) return false;
  const alreadyPicked = games.some(
    (g) => g.Winner === "Team1" || g.Winner === "Team2",
  );
  if (alreadyPicked) return false;

  if (!format || format === "SINGLE") {
    const game = games[0];
    if (!game?.Played || !game.Team2?.TeamName) return false;
    return game.Team1Score === game.Team2Score;
  }

  if (format === "TWO_LEG") {
    if (games.some((g) => !g.Played && !isKnockoutBye(g))) return false;
    const agg = seriesAggregate(games);
    return agg.team1 === agg.team2;
  }

  const wins = seriesWins(games);
  const needed = knockoutWinsNeeded(format);
  if (wins.team1 >= needed || wins.team2 >= needed) return false;
  const allPlayed = games.every((g) => g.Played || isKnockoutBye(g));
  return allPlayed && wins.team1 === wins.team2;
}

export function lastPlayedInTie(games: Draw[]): Draw | undefined {
  const played = [...games]
    .filter((g) => g.Played || isKnockoutBye(g))
    .sort((a, b) => (a.Leg || 1) - (b.Leg || 1));
  return played[played.length - 1];
}

export function legCaption(
  draw: Draw,
  format: KnockoutFormat | undefined,
): string {
  const total = knockoutLegCount(format);
  if (total <= 1 || isKnockoutBye(draw)) return "";
  const leg = draw.Leg || 1;
  if (format === "TWO_LEG") {
    return leg === 1 ? "First leg" : "Return leg";
  }
  return `Game ${leg} of ${total}`;
}
