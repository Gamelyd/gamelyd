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

export function knockoutRulesSummary(opts: {
  format: KnockoutFormat | undefined;
  finalsUseSeries?: boolean;
  thirdPlace?: boolean;
}): string {
  const base = knockoutFormatLabel(opts.format);
  const third = opts.thirdPlace ? " · 3rd place" : "";
  if (!opts.format || opts.format === "SINGLE") return `${base}${third}`;
  const finalBit = opts.finalsUseSeries
    ? "including the final"
    : "final is one match";
  return `${base}, ${finalBit}${third}`;
}

/**
 * Final and 3rd place are one match unless the host opted the final into the
 * same two-leg / best-of format as earlier rounds.
 */
export function knockoutFormatForRound(
  tournamentFormat: KnockoutFormat | undefined,
  options: {
    finalsUseSeries?: boolean;
    isFinal?: boolean;
    isThirdPlace?: boolean;
  } = {},
): KnockoutFormat {
  if (options.isThirdPlace) return "SINGLE";
  if (options.isFinal && !options.finalsUseSeries) return "SINGLE";
  return tournamentFormat || "SINGLE";
}

/** A series with only one fixture is always a single match. */
export function formatForSeriesGames(
  games: Draw[],
  tournamentFormat: KnockoutFormat | undefined,
): KnockoutFormat {
  if (games.length <= 1) return "SINGLE";
  return tournamentFormat || "SINGLE";
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
    list.push(displayDrawForTie(tie, formatForSeriesGames(tie.games, format)));
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
    ties.every((tie) =>
      isKnockoutTieSettled(
        tie.games,
        formatForSeriesGames(tie.games, format),
      ),
    )
  );
}

export function knockoutRoundHasOpenTie(
  draws: Draw[],
  stage: number,
  format: KnockoutFormat | undefined,
): boolean {
  const ties = tiesAtStage(groupKnockoutTies(draws, false), stage);
  return ties.some((tie) => {
    const seriesFormat = formatForSeriesGames(tie.games, format);
    if (!isKnockoutTieSettled(tie.games, seriesFormat)) return false;
    return !knockoutTieWinner(tie.games, seriesFormat);
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

/**
 * Teams still in the knockout: everyone who has played and not been knocked
 * out. One team left, with every tie settled, means the event is decided.
 *
 * Counting survivors rather than looking at the last round is what makes this
 * work on an uneven bracket, where the final round of one half can be settled
 * while the other half is still playing.
 */
export function teamsStillIn(
  ties: KnockoutTie[],
  format: KnockoutFormat | undefined,
): { alive: string[]; allSettled: boolean } {
  const seen = new Set<string>();
  const out = new Set<string>();
  let allSettled = true;
  for (const tie of ties) {
    const seriesFormat = formatForSeriesGames(tie.games, format);
    const settled = isKnockoutTieSettled(tie.games, seriesFormat);
    if (!settled) allSettled = false;
    for (const game of tie.games) {
      for (const team of [game.Team1, game.Team2]) {
        const name = team?.TeamName?.trim();
        if (name) seen.add(name);
      }
    }
    if (!settled) continue;
    const loser = knockoutTieLoser(tie.games, seriesFormat);
    const name = loser?.TeamName?.trim();
    if (name) out.add(name);
  }
  return {
    alive: [...seen].filter((name) => !out.has(name)),
    allSettled,
  };
}

/**
 * How far each tie is from the final, counted along what actually happened:
 * the winner of a tie is followed to the tie they played next. 1 is the final,
 * 2 a semi-final, and so on.
 *
 * Read from the results rather than from the bracket's shape because older
 * events re-paired the winners of a round freely, so their matches do not sit
 * where a bracket would predict. A tie is only measured once the chain from it
 * reaches the match that decided the event; anything still in play is left out
 * for the caller to name another way.
 */
export function tieDepths(
  ties: KnockoutTie[],
  format: KnockoutFormat | undefined,
): Map<string, number> {
  const winnerOf = new Map<string, string>();
  for (const tie of ties) {
    const seriesFormat = formatForSeriesGames(tie.games, format);
    if (!isKnockoutTieSettled(tie.games, seriesFormat)) continue;
    const name = knockoutTieWinner(tie.games, seriesFormat)?.TeamName?.trim();
    if (name) winnerOf.set(tie.seriesId, name.toLowerCase());
  }

  const plays = (tie: KnockoutTie, name: string) =>
    tie.games.some((game) =>
      [game.Team1, game.Team2].some(
        (team) => team?.TeamName?.trim().toLowerCase() === name,
      ),
    );

  /** The tie a winner went on to play: the earliest one after this. */
  const next = new Map<string, KnockoutTie>();
  for (const tie of ties) {
    const name = winnerOf.get(tie.seriesId);
    if (!name) continue;
    const after = ties
      .filter(
        (other) => other.seriesId !== tie.seriesId && other.stage > tie.stage,
      )
      .filter((other) => plays(other, name))
      .sort((a, b) => a.stage - b.stage)[0];
    if (after) next.set(tie.seriesId, after);
  }

  // The chain ends at the match that decided the event. Without one -- the
  // event is still being played -- nothing can be counted back from.
  const { alive, allSettled } = teamsStillIn(ties, format);
  const decided = allSettled && alive.length === 1;
  const depths = new Map<string, number>();
  const depthOf = (tie: KnockoutTie, seen: Set<string>): number | null => {
    const known = depths.get(tie.seriesId);
    if (known) return known;
    if (seen.has(tie.seriesId)) return null;
    seen.add(tie.seriesId);
    const after = next.get(tie.seriesId);
    if (!after) {
      const winner = winnerOf.get(tie.seriesId);
      if (!decided || !winner || winner !== alive[0]?.toLowerCase()) return null;
      depths.set(tie.seriesId, 1);
      return 1;
    }
    const beyond = depthOf(after, seen);
    if (beyond === null) return null;
    const depth = beyond + 1;
    depths.set(tie.seriesId, depth);
    return depth;
  };
  for (const tie of ties) depthOf(tie, new Set());
  return depths;
}
