"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { GroupQualifier } from "@/lib/schemas/tournament";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { isSoloVerified, VerifiedName } from "@/components/ui/VerifiedName";
import {
  groupPlaceholderPairs,
  isKnockoutBye,
  pairSequential,
  splitHalves,
} from "@/lib/knockoutSeed";
import { reasonByTeamName } from "@/lib/groupQualifiers";

type Round = { stage: number; matches: Draw[] };

type Slot = {
  team?: Teams;
  label?: string;
  score: number;
  played: boolean;
  won: boolean;
};

const QualifierReasonContext = createContext<Record<string, string>>({});

type MatchNode = {
  draw: Draw | null;
  team1: Slot;
  team2: Slot;
  bye?: boolean;
};

function winnerSide(draw: Draw): "Team1" | "Team2" | null {
  if (draw.Winner === "Team1" || draw.Winner === "Team2") return draw.Winner;
  if (!draw.Played) return null;
  if (draw.Team1Score > draw.Team2Score) return "Team1";
  if (draw.Team2Score > draw.Team1Score) return "Team2";
  return null;
}

function emptySlot(label?: string): Slot {
  return { score: 0, played: false, won: false, label };
}

function slotFromDraw(draw: Draw | null, which: "team1" | "team2"): Slot {
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

function winnerOf(match: MatchNode): Slot {
  if (match.draw) {
    const side = winnerSide(match.draw);
    if (side === "Team1") {
      return { ...slotFromDraw(match.draw, "team1"), won: false };
    }
    if (side === "Team2") {
      return { ...slotFromDraw(match.draw, "team2"), won: false };
    }
    if (isKnockoutBye(match.draw) && match.draw.Team1) {
      return { ...slotFromDraw(match.draw, "team1"), won: false };
    }
  }
  if (match.bye) return { ...match.team1, won: false };
  if (match.team1.won) return { ...match.team1, won: false };
  if (match.team2.won) return { ...match.team2, won: false };
  if (match.team1.label && !match.team2.label && !match.team2.team) {
    return { ...match.team1, won: false };
  }
  return emptySlot();
}

function matchFromDraw(draw: Draw): MatchNode {
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
): MatchNode {
  return {
    draw: null,
    team1: emptySlot(a),
    team2: emptySlot(b),
    bye: !b,
  };
}

/** Reduce a half of the bracket column by column. No extra empty outer slots. */
function wingColumns(leaves: MatchNode[]): MatchNode[][] {
  if (leaves.length === 0) return [];
  const columns: MatchNode[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: MatchNode[] = [];
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
  columns: MatchNode[][],
  later: Draw[][],
): MatchNode[][] {
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

export function KnockoutBracket({
  rounds,
  groupNames = [],
  advancePerGroup = 2,
  teamCount = 0,
  isGroupMode = false,
  knockoutLive = false,
  qualifierReasons = [],
}: {
  rounds: Round[];
  groupNames?: string[];
  advancePerGroup?: number;
  teamCount?: number;
  isGroupMode?: boolean;
  knockoutLive?: boolean;
  qualifierReasons?: GroupQualifier[];
}) {
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

  let leaves: MatchNode[] = [];

  if (isGroupMode && !knockoutLive) {
    if (names.length > 0) {
      leaves = groupPlaceholderPairs(names, advancePerGroup).map(([a, b]) =>
        matchFromPair(a, b),
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

  const leftLabels = labelsForWing(leftCols.length);
  const rightLabels = labelsForWing(rightCols.length);

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

  if (leaves.length === 0) {
    return (
      <p className="py-16 text-center text-body">
        The knockout bracket is built from this tournament&apos;s groups and how
        many teams advance from each. It fills in after groups are created.
      </p>
    );
  }

  return (
    <QualifierReasonContext.Provider
      value={reasonByTeamName(qualifierReasons)}
    >
      <div className="rounded-2xl border border-primary/25 bg-primary-panel px-3 py-6 shadow-[inset_0_1px_0_0_rgba(11,192,180,0.08)] sm:px-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <h3 className="text-center font-display text-lg tracking-[0.22em] text-white sm:text-2xl">
            KNOCKOUT STAGE
          </h3>
          <span className="h-0.5 w-16 rounded-full bg-primary" />
        </div>

        <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 pb-2">
          {leaves.length === 1 ? (
            <div className="flex min-w-max items-center justify-center">
              <MatchCard>
                <TeamRow slot={leaves[0].team1} side="left" />
              </MatchCard>
              <ForkColumn nodes={leaves} side="left" />
              <Trophy champion={champion} />
              <ForkColumn nodes={leaves} side="right" />
              <MatchCard>
                <TeamRow slot={leaves[0].team2} side="right" />
              </MatchCard>
            </div>
          ) : (
            <div className="flex min-w-max items-stretch justify-center">
              <Wing columns={leftCols} side="left" labels={leftLabels} />
              <Trophy champion={champion} />
              <Wing columns={rightCols} side="right" labels={rightLabels} />
            </div>
          )}
        </div>
      </div>
    </QualifierReasonContext.Provider>
  );
}

function roundName(matches: number): string {
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

function RoundLabel({ text }: { text?: string }) {
  return (
    <div className="mb-2 flex h-5 items-center justify-center">
      {text ? (
        <span className="inline-block leading-none truncate rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary sm:text-[10px]">
          {text}
        </span>
      ) : null}
    </div>
  );
}

function Wing({
  columns,
  side,
  labels,
}: {
  columns: MatchNode[][];
  side: "left" | "right";
  labels: string[];
}) {
  if (columns.length === 0) return null;
  return (
    <div
      className={`flex items-stretch ${side === "right" ? "flex-row-reverse" : ""}`}
    >
      {columns.map((col, i) => (
        <div key={`${side}-${i}`} className="flex flex-col">
          <RoundLabel text={labels[i]} />
          <div className="flex flex-1 items-stretch">
            <div className="flex flex-1 flex-col justify-around">
              {col.map((node, j) => (
                <MatchBox key={j} node={node} side={side} />
              ))}
            </div>
            <ForkColumn nodes={col} side={side} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-36 overflow-hidden rounded-xl border border-primary/15 bg-surface-2 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)] sm:w-48">
      {children}
    </div>
  );
}

function MatchBox({
  node,
  side,
}: {
  node: MatchNode;
  side: "left" | "right";
}) {
  if (node.bye) {
    return (
      <div className="py-1.5">
        <MatchCard>
          <TeamRow slot={node.team1} side={side} />
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Auto qualified
          </p>
        </MatchCard>
      </div>
    );
  }
  return (
    <div className="py-1.5">
      <MatchCard>
        <TeamRow slot={node.team1} side={side} />
        <div className="h-px bg-primary/10" />
        <TeamRow slot={node.team2} side={side} />
      </MatchCard>
    </div>
  );
}

function ForkColumn({
  nodes,
  side,
}: {
  nodes: MatchNode[];
  side: "left" | "right";
}) {
  const borders =
    side === "left"
      ? "rounded-r-sm border-t-2 border-r-2 border-b-2"
      : "rounded-l-sm border-t-2 border-l-2 border-b-2";

  return (
    <div className="flex w-3 flex-col sm:w-5">
      {nodes.map((node, i) => (
        <div key={i} className="flex flex-1 items-center py-3">
          {node.bye ? (
            <div className="h-0 w-full border-t-2 border-primary/50" />
          ) : (
            <div className={`h-full w-full border-primary/50 ${borders}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function TeamRow({ slot, side }: { slot: Slot; side: "left" | "right" }) {
  const reasons = useContext(QualifierReasonContext);
  const name = slot.team?.TeamName || slot.label || "TBD";
  const filled = Boolean(slot.team?.TeamName);
  const placeholder = Boolean(slot.label) && !filled;
  const reason = filled ? reasons[slot.team?.TeamName ?? ""] : undefined;
  const circle = (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full border sm:h-6 sm:w-6 ${
        slot.won
          ? "border-primary bg-primary/30"
          : "border-primary/25 bg-black/25"
      }`}
    >
      {filled ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveIcon(slot.team?.Icon, FALLBACKS.team)}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
  const label = (
    <span
      className={`min-w-0 flex-1 truncate text-[11px] sm:text-xs ${
        side === "right" ? "text-right" : ""
      } ${
        slot.won
          ? "font-semibold text-white"
          : filled
            ? "text-white/90"
            : placeholder
              ? "text-cyan-soft/80"
              : "text-white/35"
      }`}
    >
      <VerifiedName
        name={name}
        verified={isSoloVerified(slot.team?.Players)}
      />
    </span>
  );
  const score = slot.played ? (
    <span
      className={`grid h-5 min-w-5 shrink-0 place-items-center rounded px-1 text-[11px] font-semibold tabular-nums sm:h-6 sm:min-w-6 sm:text-xs ${
        slot.won ? "bg-primary text-primary-panel" : "bg-black/30 text-white/55"
      }`}
    >
      {slot.score}
    </span>
  ) : null;

  return (
    <div
      title={reason}
      className={`relative flex h-9 items-center gap-2 px-2 transition-colors sm:h-10 ${
        slot.won ? "bg-primary/12" : "hover:bg-white/5"
      } ${side === "right" ? "flex-row-reverse" : ""}`}
    >
      {slot.won ? (
        <span
          className={`absolute inset-y-0 w-0.5 bg-primary ${
            side === "right" ? "right-0" : "left-0"
          }`}
        />
      ) : null}
      {circle}
      {label}
      {score}
    </div>
  );
}

function Trophy({ champion }: { champion?: Teams }) {
  return (
    <div className="mx-1 flex shrink-0 flex-col sm:mx-3">
      <RoundLabel text="Final" />
      <div className="flex w-16 flex-1 flex-col items-center justify-center gap-1.5 sm:w-24">
        <span
          className={`grid h-12 w-12 place-items-center rounded-full border sm:h-16 sm:w-16 ${
            champion
              ? "border-yellow/60 bg-yellow/15 shadow-[0_0_22px_-4px_rgba(253,193,21,0.7)]"
              : "border-white/10 bg-white/5"
          }`}
        >
          <svg
            viewBox="0 0 64 64"
            className={`h-7 w-7 sm:h-9 sm:w-9 ${champion ? "text-yellow" : "text-white/40"}`}
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M18 10h28v6c0 8.3-5.4 15.4-13 17.7V40h8v4H23v-4h8v-6.3C23.4 31.4 18 24.3 18 16V10z"
            />
            <path
              fill="currentColor"
              d="M18 12h-6c0 6 3.6 10.5 8 12.4V16c0-1.4.2-2.7.5-4zM46 12h6c0 6-3.6 10.5-8 12.4V16c0-1.4-.2-2.7-.5-4z"
            />
            <rect fill="currentColor" x="20" y="46" width="24" height="4" rx="1" />
            <rect fill="currentColor" x="16" y="50" width="32" height="5" rx="1.5" />
          </svg>
        </span>
        {champion ? (
          <span className="inline-block leading-none max-w-24 truncate rounded-full bg-yellow/15 px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-yellow sm:text-xs">
            {champion.TeamName}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/35 sm:text-xs">
            TBD
          </span>
        )}
      </div>
    </div>
  );
}
