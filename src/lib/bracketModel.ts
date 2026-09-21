import type { Draw, Teams } from "@/lib/schemas/draw";
import type { KnockoutFormat } from "@/lib/schemas/common";
import { knockoutRoundsForBracket, seriesKey } from "@/lib/knockoutSeries";
import {
  groupPlaceholderPairs,
  isKnockoutBye,
  pairSequential,
  splitHalves,
} from "@/lib/knockoutSeed";

/**
 * The knockout bracket's shape, as pure data.
 *
 * Both the page (`KnockoutBracket`) and the downloadable image are drawn from
 * this, so the picture someone shares is the bracket they were looking at:
 * the same wings, the same future rounds waiting to be played, the same
 * placeholders and byes. They used to be built separately and drifted apart.
 */

export type BracketRound = { stage: number; matches: Draw[] };

export type BracketSlot = {
  team?: Teams;
  label?: string;
  score: number;
  played: boolean;
  won: boolean;
};

export type BracketNode = {
  draw: Draw | null;
  team1: BracketSlot;
  team2: BracketSlot;
  bye?: boolean;
};

export interface BracketInput {
  rounds: BracketRound[];
  groupNames?: string[];
  advancePerGroup?: number;
  teamCount?: number;
  isGroupMode?: boolean;
  knockoutLive?: boolean;
  /** Teams to drop into placeholder slots, keyed by the label they replace. */
  previewTeams?: Map<string, Teams>;
}

/**
 * Where each card sits vertically in one wing, in "slots" (one first-round
 * match per slot). `centres[column][i]` is card i's centre; `units` is the
 * wing's full height, padded so its last card lines up with the trophy.
 */
export interface WingLayout {
  units: number;
  centres: number[][];
}

export interface BracketModel {
  /** First-round matches; empty when there is nothing to draw yet. */
  leaves: BracketNode[];
  /** Outermost round first on both wings. */
  leftCols: BracketNode[][];
  rightCols: BracketNode[][];
  leftLabels: string[];
  rightLabels: string[];
  leftLayout: WingLayout;
  rightLayout: WingLayout;
  finalDraw: Draw | null;
  champion?: Teams;
}

/** Third-place matches sit outside the bracket, so they never fill a slot. */
function isThirdPlace(draw: Draw): boolean {
  return (draw.Kind ?? "").toUpperCase() === "THIRD_PLACE";
}

export function winnerSide(draw: Draw): "Team1" | "Team2" | null {
  if (draw.Winner === "Team1" || draw.Winner === "Team2") return draw.Winner;
  if (!draw.Played) return null;
  if (draw.Team1Score > draw.Team2Score) return "Team1";
  if (draw.Team2Score > draw.Team1Score) return "Team2";
  return null;
}

function emptySlot(label?: string): BracketSlot {
  return { score: 0, played: false, won: false, label };
}

function slotFromDraw(draw: Draw | null, which: "team1" | "team2"): BracketSlot {
  if (!draw) return emptySlot();
  if (isKnockoutBye(draw)) {
    if (which === "team2") return emptySlot();
    return { team: draw.Team1, score: 0, played: false, won: false };
  }
  const team = which === "team1" ? draw.Team1 : draw.Team2;
  const score = which === "team1" ? draw.Team1Score : draw.Team2Score;
  const side = winnerSide(draw);
  const won =
    (which === "team1" && side === "Team1") ||
    (which === "team2" && side === "Team2");
  return { team, score, played: draw.Played, won };
}

/**
 * A team moving on to the next round. It keeps its identity but none of the
 * previous match's result -- the score belongs to the match just played, not
 * the one it now waits on, so the new slot starts unplayed.
 */
function advance(slot: BracketSlot): BracketSlot {
  return { ...slot, score: 0, played: false, won: false };
}

function winnerOf(match: BracketNode): BracketSlot {
  if (match.draw) {
    const side = winnerSide(match.draw);
    if (side === "Team1") return advance(slotFromDraw(match.draw, "team1"));
    if (side === "Team2") return advance(slotFromDraw(match.draw, "team2"));
    if (isKnockoutBye(match.draw) && match.draw.Team1) {
      return advance(slotFromDraw(match.draw, "team1"));
    }
  }
  if (match.bye) return advance(match.team1);
  if (match.team1.won) return advance(match.team1);
  if (match.team2.won) return advance(match.team2);
  if (match.team1.label && !match.team2.label && !match.team2.team) {
    return advance(match.team1);
  }
  return emptySlot();
}

function matchFromDraw(draw: Draw): BracketNode {
  return {
    draw,
    team1: slotFromDraw(draw, "team1"),
    team2: slotFromDraw(draw, "team2"),
    bye: isKnockoutBye(draw),
  };
}

function matchFromPair(
  a: string | undefined,
  b: string | undefined,
  teams?: Map<string, Teams>,
): BracketNode {
  return {
    draw: null,
    team1: slotForLabel(a, teams),
    team2: slotForLabel(b, teams),
    bye: !b,
  };
}

/**
 * A placeholder slot, filled in with the team currently holding that place if
 * one is known. Carrying the whole team rather than its name is what puts the
 * crest on the row -- the row reads the image off `slot.team`, so a slot with
 * only a label renders without one.
 */
function slotForLabel(label?: string, teams?: Map<string, Teams>): BracketSlot {
  const team = label ? teams?.get(label) : undefined;
  if (!team) return emptySlot(label);
  return { team, label, score: 0, played: false, won: false };
}

/** The next round as the bracket predicts it, from the round before. */
function nextColumn(current: BracketNode[]): BracketNode[] {
  const next: BracketNode[] = [];
  for (let i = 0; i < current.length; i += 2) {
    if (i + 1 < current.length) {
      next.push({
        draw: null,
        team1: winnerOf(current[i]),
        team2: winnerOf(current[i + 1]),
      });
    } else {
      next.push({
        draw: null,
        bye: true,
        team1: winnerOf(current[i]),
        team2: emptySlot(),
      });
    }
  }
  return next;
}

/**
 * Reduce a half of the bracket column by column. No extra empty outer slots.
 *
 * Rounds that have been drawn replace the prediction as we go, so the round
 * after one reads the real result. Overlaying them afterwards left every later
 * round showing TBD: a semi-final would still be waiting on a quarter-final
 * the bracket had already predicted but never saw the winner of.
 */
function wingColumns(leaves: BracketNode[], pool: DrawPool): BracketNode[][] {
  if (leaves.length === 0) return [];
  const columns: BracketNode[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const predicted = nextColumn(current);
    // Two passes so a tie with both teams known claims its place before one
    // matched on a single team takes it.
    const next = predicted.map((node) => pool.take(node, true) ?? node);
    const filled = next.map((node) =>
      node.draw ? node : (pool.take(node, false) ?? node),
    );
    columns.push(filled);
    current = filled;
  }
  return columns;
}

const nameOf = (team?: { TeamName?: string }) =>
  team?.TeamName?.trim().toLowerCase() ?? "";

/**
 * The rounds already drawn, claimed by the slot they belong in.
 *
 * Matched on the teams in them rather than on their position in the round.
 * Matches are drawn one at a time as the ties feeding them are settled, so a
 * round is often half full, and counting positions put a match on the wrong
 * side of the bracket.
 */
class DrawPool {
  private readonly used = new Set<Draw>();
  constructor(private readonly draws: Draw[]) {}

  /** The drawn tie for this slot, if one of them is it. */
  take(node: BracketNode, bothKnown: boolean): BracketNode | null {
    const want = [nameOf(node.team1.team), nameOf(node.team2.team)].filter(
      Boolean,
    );
    if (want.length === 0 || (bothKnown && want.length < 2 && !node.bye)) {
      return null;
    }
    for (const draw of this.draws) {
      if (this.used.has(draw)) continue;
      const have = [nameOf(draw.Team1), nameOf(draw.Team2)].filter(Boolean);
      const hit = isKnockoutBye(draw)
        ? have[0] === want[0]
        : bothKnown
          ? want.length === 2 &&
            have.length === 2 &&
            want.every((name) => have.includes(name))
          : want.some((name) => have.includes(name));
      if (!hit) continue;
      this.used.add(draw);
      return matchFromDraw(draw);
    }
    return null;
  }

  /** Whatever is left: a final, or a round drawn before this slot existed. */
  remaining(): Draw[] {
    return this.draws.filter((draw) => !this.used.has(draw));
  }
}

/**
 * Place cards by the tree rather than spacing them evenly. Even spacing only
 * lines up when every round halves cleanly; with an odd count (3 matches on a
 * side, then 2 with a bye) the connectors stop meeting the cards. Here a card
 * sits halfway between the two matches feeding it, and a bye level with the
 * match it comes from, so the arrows always land.
 */
export function layoutWing(cols: { length: number }[]): WingLayout {
  if (cols.length === 0 || cols[0].length === 0) return { units: 0, centres: [] };
  const leaves = cols[0].length;
  const centres: number[][] = [
    Array.from({ length: leaves }, (_, i) => i + 0.5),
  ];
  for (let k = 1; k < cols.length; k++) {
    const prev = centres[k - 1];
    const count = cols[k].length;
    centres.push(
      Array.from({ length: count }, (_, j) => {
        const a = prev[2 * j];
        const b = prev[2 * j + 1];
        // A drawn round that does not follow the predicted shape: fall back
        // to even spacing rather than lose the card.
        if (a === undefined) return ((j + 0.5) / count) * leaves;
        return b === undefined ? a : (a + b) / 2;
      }),
    );
  }
  const last = centres[centres.length - 1];
  const mid = last.length === 1 ? last[0] : leaves / 2;
  // Pad whichever end is short so the last card sits at the wing's middle,
  // level with the trophy.
  const top = Math.max(0, leaves - 2 * mid);
  const bottom = Math.max(0, 2 * mid - leaves);
  return {
    units: leaves + top + bottom,
    centres: centres.map((col) => col.map((c) => c + top)),
  };
}

/** The team that goes through from a node: a winner, or a bye's lone team. */
export function nodeWinner(node: BracketNode): BracketSlot {
  return winnerOf(node);
}

export function roundName(matches: number): string {
  if (matches <= 1) return "Final";
  if (matches === 2) return "Semi-finals";
  if (matches === 4) return "Quarter-finals";
  return `Round of ${matches * 2}`;
}

function labelsForWing(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) =>
    roundName(2 ** (columnCount - i)),
  );
}

export function buildBracketModel({
  rounds,
  groupNames = [],
  advancePerGroup = 2,
  teamCount = 0,
  isGroupMode = false,
  knockoutLive = false,
  previewTeams,
}: BracketInput): BracketModel {
  // Always build from the first knockout round, even if the caller
  // passes stages newest-first (fixtures do that).
  const ordered = [...rounds].sort((a, b) => a.stage - b.stage);
  const firstRound = ordered[0]?.matches ?? [];
  const pool = new DrawPool(ordered.slice(1).flatMap((round) => round.matches));

  const names = groupNames.map((name) => name.trim()).filter(Boolean);

  let leaves: BracketNode[] = [];

  if (isGroupMode && !knockoutLive) {
    if (names.length > 0) {
      leaves = groupPlaceholderPairs(names, advancePerGroup).map(([a, b]) =>
        matchFromPair(a, b, previewTeams),
      );
    }
  } else if (knockoutLive || rounds.length > 0) {
    leaves = firstRound.map(matchFromDraw);
  } else if (teamCount > 1) {
    const labels = Array.from({ length: teamCount }, () => undefined);
    leaves = pairSequential(labels).map(([a, b]) => matchFromPair(a, b));
  }

  const [leftLeaves, rightLeaves] = splitHalves(leaves);
  const leftCols = wingColumns(leftLeaves, pool);
  const rightCols = wingColumns(rightLeaves, pool);

  // The final is whatever is left once both halves have claimed their rounds:
  // the match between the two finalists.
  const finalists = [
    leftCols[leftCols.length - 1]?.[0],
    rightCols[rightCols.length - 1]?.[0],
  ].map((node) => (node ? nameOf(winnerOf(node).team) : ""));
  const leftovers = pool.remaining();
  const finalDraw =
    leaves.length === 1
      ? (firstRound[0] ?? null)
      : (leftovers.find((draw) => {
          const have = [nameOf(draw.Team1), nameOf(draw.Team2)];
          return finalists.every((name) => name && have.includes(name));
        }) ??
        leftovers.find((draw) => !isThirdPlace(draw)) ??
        null);
  const finalWinner = finalDraw ? winnerSide(finalDraw) : null;
  const champion =
    finalWinner === "Team1"
      ? finalDraw?.Team1
      : finalWinner === "Team2"
        ? finalDraw?.Team2
        : undefined;

  return {
    leaves,
    leftCols,
    rightCols,
    leftLabels: labelsForWing(leftCols.length),
    rightLabels: labelsForWing(rightCols.length),
    leftLayout: layoutWing(leftCols),
    rightLayout: layoutWing(rightCols),
    finalDraw,
    champion,
  };
}

/**
 * A column laid out as stacked pieces whose `grow` values are in slots, so a
 * flex column of them puts every card's centre exactly where `layoutWing`
 * said. Built from flex-grow alone because the image renderer (Satori) has no
 * reliable absolute positioning.
 */
export type CardSegment =
  | { kind: "gap"; grow: number }
  | { kind: "card"; index: number; grow: number };

export function cardSegments(centres: number[], units: number): CardSegment[] {
  const out: CardSegment[] = [];
  let at = 0;
  centres.forEach((c, index) => {
    out.push({ kind: "gap", grow: Math.max(0, c - 0.5 - at) });
    out.push({ kind: "card", index, grow: 1 });
    at = c + 0.5;
  });
  out.push({ kind: "gap", grow: Math.max(0, units - at) });
  return out;
}

/**
 * The connector column beside a round: for each pair, a top arm from the first
 * card's centre down to the midpoint and a bottom arm on to the second card's
 * centre, with the arrow at the midpoint (a zero-height row). A lone card -- a
 * bye, or the last round -- gets just the arrow, level with its centre.
 */
export type ForkSegment =
  | { kind: "gap"; grow: number }
  | { kind: "arm"; corner: "top" | "bottom"; match: number; grow: number }
  | { kind: "arrow"; matches: number[] };

export function forkSegments(centres: number[], units: number): ForkSegment[] {
  const out: ForkSegment[] = [];
  let at = 0;
  for (let i = 0; i < centres.length; i += 2) {
    const a = centres[i];
    const b = centres[i + 1];
    out.push({ kind: "gap", grow: Math.max(0, a - at) });
    if (b === undefined) {
      out.push({ kind: "arrow", matches: [i] });
      at = a;
      continue;
    }
    const half = (b - a) / 2;
    out.push({ kind: "arm", corner: "top", match: i, grow: half });
    out.push({ kind: "arrow", matches: [i, i + 1] });
    out.push({ kind: "arm", corner: "bottom", match: i + 1, grow: half });
    at = b;
  }
  out.push({ kind: "gap", grow: Math.max(0, units - at) });
  return out;
}

/** One round of a team's road to the final: which card, and which row of it. */
export interface RouteStep {
  index: number;
  row: "team1" | "team2" | "single";
  /** The team goes on from here: false where it was knocked out. */
  continues: boolean;
}

export interface TeamRoute {
  /** By column; undefined for rounds before the team entered this wing. */
  steps: (RouteStep | undefined)[];
  /** The column the team was knocked out in, or null if still going. */
  outAt: number | null;
}

function sameTeam(slot: BracketSlot, name: string): boolean {
  return slot.team?.TeamName?.trim().toLowerCase() === name;
}

/**
 * A team's road through one wing, from its first match to the trophy -- or to
 * the match it lost. Future rounds are followed by the bracket's shape (a card
 * feeds card `floor(i / 2)` in the next round), so a team still in it shows
 * the slots it would have to win through to reach the final.
 */
export function teamRoute(
  cols: BracketNode[][],
  teamName: string,
): TeamRoute | null {
  const name = teamName.trim().toLowerCase();
  if (!name) return null;
  const holds = (node: BracketNode | undefined) =>
    Boolean(node && (sameTeam(node.team1, name) || sameTeam(node.team2, name)));

  let start = -1;
  let index = -1;
  for (let k = 0; k < cols.length && start < 0; k++) {
    const found = cols[k].findIndex(holds);
    if (found >= 0) {
      start = k;
      index = found;
    }
  }
  if (start < 0) return null;

  const steps: (RouteStep | undefined)[] = [];
  let from = -1;
  for (let k = start; k < cols.length; k++) {
    // Trust where the team actually is when a drawn round has it; otherwise
    // follow the bracket's shape.
    const found = cols[k].findIndex(holds);
    if (found >= 0) index = found;
    const node = cols[k][index];
    if (!node) break;

    const row: RouteStep["row"] = node.bye
      ? "single"
      : sameTeam(node.team2, name)
        ? "team2"
        : sameTeam(node.team1, name)
          ? "team1"
          : from % 2 === 1
            ? "team2"
            : "team1";
    const lost =
      (sameTeam(node.team1, name) && node.team2.won) ||
      (sameTeam(node.team2, name) && node.team1.won);
    steps[k] = { index, row, continues: !lost };
    if (lost) return { steps, outAt: k };
    from = index;
    index = Math.floor(index / 2);
  }
  return { steps, outAt: null };
}

/**
 * What each knockout tie is called, keyed by series.
 *
 * Named by how far the tie is from the final rather than by how many matches
 * share its stage. An uneven bracket can hold a semi-final and a quarter-final
 * in the same round -- one half having had a shorter route -- and labelling the
 * whole stage by its match count called that semi-final a quarter-final.
 */
export function knockoutRoundLabels(
  draws: Draw[],
  format?: KnockoutFormat,
): Map<string, string> {
  const model = buildBracketModel({
    rounds: knockoutRoundsForBracket(draws, format),
    knockoutLive: true,
  });
  const labels = new Map<string, string>();
  const walk = (cols: BracketNode[][], names: string[]) => {
    cols.forEach((col, index) => {
      for (const node of col) {
        if (node.draw) labels.set(seriesKey(node.draw), names[index] ?? "");
      }
    });
  };
  walk(model.leftCols, model.leftLabels);
  walk(model.rightCols, model.rightLabels);
  if (model.finalDraw) labels.set(seriesKey(model.finalDraw), roundName(1));
  return labels;
}

/** Rounds left to the final, so sections read widest-first. */
export function roundRank(label: string): number {
  const name = label.trim().toLowerCase();
  if (name.startsWith("final")) return 1;
  if (name.startsWith("semi")) return 2;
  if (name.startsWith("quarter")) return 4;
  const of = /round of (\d+)/.exec(name);
  return of ? Number(of[1]) / 2 : 99;
}

/** A match the bracket says can be drawn now, and what it is drawn from. */
export interface ReadyMatch {
  team1: Teams;
  /** Absent for a bye: one side had nobody to play. */
  team2?: Teams;
  stage: number;
  /** Stable identity, from the ties feeding it, so it is only drawn once. */
  seed: string;
  kind: "" | "FINAL" | "THIRD_PLACE";
}

/**
 * Every match whose two feeding ties are settled but which has not been drawn.
 *
 * A match depends only on the two ties that feed it, never on the rest of its
 * round. Waiting for a whole round stalls an uneven bracket, where one half is
 * a round ahead and its next match would wait on ties it has nothing to do
 * with.
 */
export function readyMatches(
  model: BracketModel,
  options: { excluded?: Set<string>; thirdPlace?: boolean } = {},
): ReadyMatch[] {
  const out: ReadyMatch[] = [];
  const stages = new Map<BracketNode, number>();
  for (const node of [...model.leftCols, ...model.rightCols].flat()) {
    if (node.draw) stages.set(node, node.draw.Stage);
  }
  const live = (team?: Teams) => {
    const name = team?.TeamName?.trim();
    return name && !options.excluded?.has(name) ? team : undefined;
  };
  const seedOf = (feeders: (BracketNode | undefined)[]) =>
    feeders.map((f) => (f?.draw ? seriesKey(f.draw) : "bye")).join("|");

  const walk = (columns: BracketNode[][]) => {
    columns.forEach((column, index) => {
      if (index === 0) return;
      const previous = columns[index - 1];
      column.forEach((node, position) => {
        if (node.draw) return;
        const feeders = [previous[position * 2], previous[position * 2 + 1]];
        const stage =
          Math.max(...feeders.map((f) => (f && stages.get(f)) || 0)) + 1;
        if (stage <= 1) return;
        const team1 = live(feeders[0] && nodeWinner(feeders[0]).team);
        const team2 = feeders[1]
          ? live(nodeWinner(feeders[1]).team)
          : undefined;
        if (!team1) return;
        // Both feeders have to be settled, unless this is a bye with one.
        if (feeders[1] && !team2) return;
        out.push({ team1, team2, stage, seed: seedOf(feeders), kind: "" });
        stages.set(node, stage);
      });
    });
  };
  walk(model.leftCols);
  walk(model.rightCols);

  if (model.finalDraw || model.leaves.length <= 1) return out;
  const finalists = [
    model.leftCols[model.leftCols.length - 1]?.[0],
    model.rightCols[model.rightCols.length - 1]?.[0],
  ];
  const teams = finalists.map((node) => live(node && nodeWinner(node).team));
  const stage =
    Math.max(...finalists.map((node) => (node && stages.get(node)) || 0)) + 1;
  if (!teams[0] || !teams[1] || stage <= 1) return out;
  const seed = seedOf(finalists);
  out.push({ team1: teams[0], team2: teams[1], stage, seed: `final:${seed}`, kind: "FINAL" });
  if (options.thirdPlace) {
    const losers = finalists
      .map((node) => {
        if (!node?.draw) return undefined;
        const side = winnerSide(node.draw);
        const beaten =
          side === "Team1" ? node.draw.Team2 : side === "Team2" ? node.draw.Team1 : undefined;
        return live(beaten);
      })
      .filter((team): team is Teams => Boolean(team));
    if (losers.length === 2) {
      out.push({
        team1: losers[0],
        team2: losers[1],
        stage,
        seed: `third:${seed}`,
        kind: "THIRD_PLACE",
      });
    }
  }
  return out;
}

/**
 * Drawn matches that no longer follow from the ties feeding them: a result was
 * corrected and somebody else goes through now.
 *
 * Only the match directly below a change is reported. Once it is removed, the
 * round after it becomes stale in turn, so callers repeat until nothing is
 * left to clear.
 */
export function staleSeries(model: BracketModel): Set<string> {
  const stale = new Set<string>();
  const check = (columns: BracketNode[][]) => {
    columns.forEach((column, index) => {
      if (index === 0) return;
      const previous = columns[index - 1];
      column.forEach((node, position) => {
        if (!node.draw) return;
        const feeders = [previous[position * 2], previous[position * 2 + 1]];
        // Nothing to compare against until a feeder has been drawn at all.
        if (!feeders.some((feeder) => feeder?.draw)) return;
        const expected = feeders
          .map((feeder) => (feeder ? nameOf(nodeWinner(feeder).team) : ""))
          .filter(Boolean)
          .sort();
        if (expected.length === 0) return;
        const actual = [nameOf(node.draw.Team1), nameOf(node.draw.Team2)]
          .filter(Boolean)
          .sort();
        const same =
          expected.length === actual.length &&
          expected.every((name, i) => name === actual[i]);
        if (!same) stale.add(seriesKey(node.draw));
      });
    });
  };
  check(model.leftCols);
  check(model.rightCols);

  if (model.finalDraw) {
    const finalists = [
      model.leftCols[model.leftCols.length - 1]?.[0],
      model.rightCols[model.rightCols.length - 1]?.[0],
    ]
      .map((node) => (node ? nameOf(nodeWinner(node).team) : ""))
      .filter(Boolean)
      .sort();
    const actual = [nameOf(model.finalDraw.Team1), nameOf(model.finalDraw.Team2)]
      .filter(Boolean)
      .sort();
    const same =
      finalists.length === actual.length &&
      finalists.every((name, i) => name === actual[i]);
    if (finalists.length > 0 && !same) stale.add(seriesKey(model.finalDraw));
  }
  return stale;
}
