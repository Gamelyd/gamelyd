import type { Draw, Teams } from "@/lib/schemas/draw";
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

/** Reduce a half of the bracket column by column. No extra empty outer slots. */
function wingColumns(leaves: BracketNode[]): BracketNode[][] {
  if (leaves.length === 0) return [];
  const columns: BracketNode[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
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
    columns.push(next);
    current = next;
  }
  return columns;
}

function overlayDrawnRounds(
  columns: BracketNode[][],
  later: Draw[][],
): BracketNode[][] {
  return columns.map((col, index) => {
    if (index === 0) return col;
    const drawn = later[index - 1];
    if (!drawn || drawn.length === 0) return col;
    return col.map((node, i) => {
      const draw = drawn[i];
      return draw ? matchFromDraw(draw) : node;
    });
  });
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
  const last = ordered[ordered.length - 1];
  const hasFinal =
    Boolean(last) && last.matches.length === 1 && ordered.length > 1;
  const earlyRounds = hasFinal ? ordered.slice(0, -1) : ordered;
  const firstRound = earlyRounds[0]?.matches ?? [];
  const laterByRound = earlyRounds.slice(1).map((r) => r.matches);

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
  const leftCols = overlayDrawnRounds(
    wingColumns(leftLeaves),
    laterByRound.map((matches) => splitHalves(matches)[0]),
  );
  const rightCols = overlayDrawnRounds(
    wingColumns(rightLeaves),
    laterByRound.map((matches) => splitHalves(matches)[1]),
  );

  const finalDraw = hasFinal
    ? last.matches[0]
    : leaves.length === 1
      ? firstRound[0] ?? null
      : null;
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
