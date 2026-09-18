"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { GroupQualifier } from "@/lib/schemas/tournament";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { isSoloVerified, VerifiedName } from "@/components/ui/VerifiedName";
import { reasonByTeamName } from "@/lib/groupQualifiers";
import {
  buildBracketModel,
  cardSegments,
  forkSegments,
  teamRoute,
  type RouteStep,
  type TeamRoute,
  type WingLayout,
  type BracketNode as MatchNode,
  type BracketRound as Round,
  type BracketSlot as Slot,
} from "@/lib/bracketModel";

const QualifierReasonContext = createContext<Record<string, string>>({});

/**
 * The team someone tapped, if any. Tapping a team lights up its road to the
 * final and dims everything else; tapping it again, or empty space, clears it.
 */
const SelectContext = createContext<{
  selected: string | null;
  toggle: (name: string) => void;
}>({ selected: null, toggle: () => {} });

/** Highlight for a tapped team's road -- yellow, so it never reads as a result. */
const ROUTE = "border-yellow";

export function KnockoutBracket({
  rounds,
  groupNames = [],
  advancePerGroup = 2,
  teamCount = 0,
  isGroupMode = false,
  knockoutLive = false,
  qualifierReasons = [],
  previewTeams,
}: {
  rounds: Round[];
  groupNames?: string[];
  advancePerGroup?: number;
  teamCount?: number;
  isGroupMode?: boolean;
  knockoutLive?: boolean;
  qualifierReasons?: GroupQualifier[];
  /**
   * Teams to drop into the placeholder slots, keyed by the label they replace
   * ("Group A winner"). Worked out on the page from the current tables.
   *
   * The bracket keeps its full shape either way -- this only fills slots, so a
   * placeholder with nobody in it yet stays a placeholder. A look ahead only:
   * nothing is drawn or saved, and it is ignored once the knockout exists.
   */
  previewTeams?: Map<string, Teams>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const {
    leaves,
    leftCols,
    rightCols,
    leftLabels,
    rightLabels,
    leftLayout,
    rightLayout,
    finalDraw,
    champion,
  } = buildBracketModel({
    rounds,
    groupNames,
    advancePerGroup,
    teamCount,
    isGroupMode,
    knockoutLive,
    previewTeams,
  });

  const leftRoute = selected ? teamRoute(leftCols, selected) : null;
  const rightRoute = selected ? teamRoute(rightCols, selected) : null;
  const selectedStatus = selected
    ? routeStatus({
        name: selected,
        champion,
        finalDraw,
        route: leftRoute ?? rightRoute,
        labels: leftRoute ? leftLabels : rightLabels,
      })
    : null;
  const toggle = (name: string) =>
    setSelected((current) =>
      current?.toLowerCase() === name.toLowerCase() ? null : name,
    );

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
      <SelectContext.Provider value={{ selected, toggle }}>
        <div
          // Tapping empty space clears a highlighted road.
          onClick={() => setSelected(null)}
          className="rounded-2xl border border-primary/25 bg-primary-panel px-2 py-4 shadow-[inset_0_1px_0_0_rgba(11,192,180,0.08)] sm:px-6 sm:py-6"
        >
          <p className="mb-3 text-center text-[11px] text-body sm:mb-4 sm:text-xs">
            {selected ? (
              <>
                Showing <span className="font-semibold text-yellow">{selected}</span>
                &apos;s road to the final. Tap again to clear.
              </>
            ) : (
              <>
                Tap a team to follow its road to the final
                <span className="sm:hidden"> · swipe to see it all</span>
              </>
            )}
          </p>

          <div className="-mx-2 overflow-x-auto overscroll-x-contain px-2 pb-2 sm:-mx-3 sm:px-3">
            {leaves.length === 1 ? (
              <div className="flex min-w-max items-center justify-center">
                <MatchCard onRoute={Boolean(selected)}>
                  <TeamRow slot={leaves[0].team1} side="left" />
                </MatchCard>
                <ForkColumn
                  nodes={leaves}
                  centres={[0.5]}
                  units={1}
                  side="left"
                  stubs={false}
                />
                <Trophy champion={champion} selected={selectedStatus} />
                <ForkColumn
                  nodes={leaves}
                  centres={[0.5]}
                  units={1}
                  side="right"
                  stubs={false}
                />
                <MatchCard onRoute={Boolean(selected)}>
                  <TeamRow slot={leaves[0].team2} side="right" />
                </MatchCard>
              </div>
            ) : (
              <div className="flex min-w-max items-stretch justify-center">
                <Wing
                  columns={leftCols}
                  side="left"
                  labels={leftLabels}
                  layout={leftLayout}
                  route={leftRoute}
                />
                <Trophy champion={champion} selected={selectedStatus} />
                <Wing
                  columns={rightCols}
                  side="right"
                  labels={rightLabels}
                  layout={rightLayout}
                  route={rightRoute}
                />
              </div>
            )}
          </div>
        </div>
      </SelectContext.Provider>
    </QualifierReasonContext.Provider>
  );
}

/**
 * What the trophy says about a tapped team: champion, in the final, where it
 * went out, or -- still going -- that this is its road.
 */
function routeStatus({
  name,
  champion,
  finalDraw,
  route,
  labels,
}: {
  name: string;
  champion?: Teams;
  finalDraw: Draw | null;
  route: TeamRoute | null;
  labels: string[];
}): { name: string; status: string } {
  const is = (team?: Teams) =>
    team?.TeamName?.trim().toLowerCase() === name.trim().toLowerCase();
  if (is(champion)) return { name, status: "Champion" };
  if (finalDraw && (is(finalDraw.Team1) || is(finalDraw.Team2))) {
    return {
      name,
      status: champion?.TeamName ? "Runner-up" : "In the final",
    };
  }
  if (route && route.outAt !== null) {
    const round = labels[route.outAt] ?? "the knockout";
    return { name, status: `Out in the ${round.toLowerCase()}` };
  }
  return { name, status: "Road to the final" };
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
  layout,
  route,
}: {
  columns: MatchNode[][];
  side: "left" | "right";
  labels: string[];
  /** Where each card sits, so connectors meet them even in uneven wings. */
  layout: WingLayout;
  /** A tapped team's road through this wing, if it has one here. */
  route: TeamRoute | null;
}) {
  if (columns.length === 0) return null;
  return (
    <div
      // One match-card slot per layout unit, so padding a short wing to line
      // up with the trophy spreads the cards out instead of squashing them.
      style={{ minHeight: `calc(var(--slot) * ${layout.units} + 1.75rem)` }}
      className={`flex items-stretch [--slot:5.75rem] sm:[--slot:6.75rem] ${
        side === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {columns.map((col, i) => (
        <div key={`${side}-${i}`} className="flex flex-col">
          <RoundLabel text={labels[i]} />
          {/* Mirrored on the right so the connectors sit between rounds,
              facing the trophy, rather than on the outside edge. */}
          <div
            className={`flex flex-1 items-stretch ${
              side === "right" ? "flex-row-reverse" : ""
            }`}
          >
            <div className="flex flex-1 flex-col">
              {cardSegments(layout.centres[i] ?? [], layout.units).map(
                (seg, j) =>
                  seg.kind === "gap" ? (
                    <div key={j} style={{ flexGrow: seg.grow }} className="basis-0" />
                  ) : (
                    <div
                      key={j}
                      style={{ flexGrow: seg.grow }}
                      className="flex basis-0 flex-col justify-center"
                    >
                      <MatchBox
                        node={col[seg.index]}
                        side={side}
                        onRoute={route?.steps[i]?.index === seg.index}
                      />
                    </div>
                  ),
              )}
            </div>
            <ForkColumn
              nodes={col}
              centres={layout.centres[i] ?? []}
              units={layout.units}
              side={side}
              step={route?.steps[i]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const cardClass =
  "block w-36 overflow-hidden rounded-xl border border-primary/15 bg-surface-2 text-left shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)] sm:w-48";

/** A match card. Dims when another team's road is highlighted. */
function MatchCard({
  children,
  onRoute = false,
}: {
  children: ReactNode;
  /** On the tapped team's road: outlined in the route colour. */
  onRoute?: boolean;
}) {
  const { selected } = useContext(SelectContext);
  return (
    <div
      className={`${cardClass} transition-opacity ${
        onRoute ? "border-yellow/70 ring-1 ring-yellow/40" : ""
      } ${selected && !onRoute ? "opacity-35" : ""}`}
    >
      {children}
    </div>
  );
}

function MatchBox({
  node,
  side,
  onRoute,
}: {
  node: MatchNode;
  side: "left" | "right";
  onRoute: boolean;
}) {
  if (node.bye) {
    return (
      <div className="py-1.5">
        <MatchCard onRoute={onRoute}>
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
      <MatchCard onRoute={onRoute}>
        <TeamRow slot={node.team1} side={side} lost={node.team2.won} />
        <div className="h-px bg-primary/10" />
        <TeamRow slot={node.team2} side={side} lost={node.team1.won} />
      </MatchCard>
    </div>
  );
}

/**
 * A match whose winner is known, so its line into the next round lights up. A
 * bye only counts once the team getting it is known: a predicted bye waiting
 * on a TBD winner stays dim.
 */
function decided(node: MatchNode): boolean {
  if (node.bye) return Boolean(node.team1.team?.TeamName);
  return node.team1.won || node.team2.won;
}

const LIT = "border-primary";
const DIM = "border-primary/35";
/** The losing team's line: nearly gone, so the winner's reads at a glance. */
const LOST = "border-primary/10";

function teamTone(won: boolean, otherWon: boolean): string {
  if (won) return LIT;
  if (otherWon) return LOST;
  return DIM;
}

/**
 * The two short lines out of each card, one per team row, joining at the
 * card's centre where the line to the next round starts. Only the winner's
 * lights up, so you can see who went through without reading the scores.
 *
 * The height is the distance between the two team rows' centres: each row is
 * h-9 (h-10 from sm) with a 1px divider between them.
 */
function TeamStubs({
  nodes,
  centres,
  units,
  side,
  step,
}: {
  nodes: MatchNode[];
  centres: number[];
  units: number;
  side: "left" | "right";
  step?: RouteStep;
}) {
  const inward = side === "left" ? "border-r-2" : "border-l-2";
  return (
    <div className="flex w-2.5 shrink-0 flex-col sm:w-3">
      {cardSegments(centres, units).map((seg, i) => {
        if (seg.kind === "gap") {
          return <div key={i} style={{ flexGrow: seg.grow }} className="basis-0" />;
        }
        const node = nodes[seg.index];
        // The tapped team's line out of this card, if its road carries on.
        const routeRow =
          step && step.index === seg.index && step.continues ? step.row : null;
        return (
          <div key={i} style={{ flexGrow: seg.grow }} className="relative basis-0">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
              {!node || node.bye ? (
                <div
                  className={`h-0 border-t-2 ${
                    routeRow ? ROUTE : node && decided(node) ? LIT : DIM
                  }`}
                />
              ) : (
                <div className="flex h-[37px] flex-col sm:h-[41px]">
                  <div
                    className={`flex-1 border-t-2 ${inward} ${
                      side === "left" ? "rounded-tr-sm" : "rounded-tl-sm"
                    } ${
                      routeRow === "team1"
                        ? ROUTE
                        : teamTone(node.team1.won, node.team2.won)
                    }`}
                  />
                  <div
                    className={`flex-1 border-b-2 ${inward} ${
                      side === "left" ? "rounded-br-sm" : "rounded-bl-sm"
                    } ${
                      routeRow === "team2"
                        ? ROUTE
                        : teamTone(node.team2.won, node.team1.won)
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The connectors between one round and the next.
 *
 * Each pair of matches gets a "]" from the centre of one card to the centre of
 * the other, then a single arrow from its midpoint into the match they feed.
 * Pieces are placed from the wing layout rather than spaced evenly, so they
 * still meet the cards when a side has an odd number of matches. A match's arm
 * lights up once it has a winner; the arrow once every feeding match does.
 */
function ForkColumn({
  nodes,
  centres,
  units,
  side,
  stubs = true,
  step,
}: {
  nodes: MatchNode[];
  centres: number[];
  units: number;
  side: "left" | "right";
  /** Per-team lines out of each card. Off where a card shows one team. */
  stubs?: boolean;
  /** A tapped team's card in this round: its lines onward turn yellow. */
  step?: RouteStep;
}) {
  const onward = step?.continues ? step.index : -1;
  const inward = side === "left" ? "border-r-2" : "border-l-2";
  return (
    <div
      className={`flex shrink-0 items-stretch ${
        side === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {stubs ? (
        <TeamStubs
          nodes={nodes}
          centres={centres}
          units={units}
          side={side}
          step={step}
        />
      ) : null}
    <div className="flex w-6 shrink-0 flex-col sm:w-10">
      {forkSegments(centres, units).map((seg, i) => {
        if (seg.kind === "gap") {
          return <div key={i} style={{ flexGrow: seg.grow }} className="basis-0" />;
        }
        if (seg.kind === "arm") {
          const lit = nodes[seg.match] ? decided(nodes[seg.match]) : false;
          const route = seg.match === onward;
          const edge =
            seg.corner === "top"
              ? `border-t-2 ${side === "left" ? "rounded-tr-sm" : "rounded-tl-sm"}`
              : `border-b-2 ${side === "left" ? "rounded-br-sm" : "rounded-bl-sm"}`;
          return (
            <div
              key={i}
              style={{ flexGrow: seg.grow }}
              className={`flex basis-0 ${side === "right" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-1/2 ${edge} ${inward} ${
                  route ? ROUTE : lit ? LIT : DIM
                }`}
              />
            </div>
          );
        }
        const lit = seg.matches.every((m) => nodes[m] && decided(nodes[m]));
        const route = seg.matches.includes(onward);
        const paired = seg.matches.length === 2;
        return (
          // Zero height, so it sits exactly on the midpoint between the arms.
          <div key={i} className="relative h-0">
            <div
              className={`absolute inset-x-0 top-0 flex -translate-y-1/2 items-center ${
                side === "right" ? "flex-row-reverse" : ""
              } ${route ? "text-yellow" : lit ? "text-primary" : "text-primary/35"}`}
            >
              {paired ? <div className="w-1/2 shrink-0" /> : null}
              <div
                className={`h-0 flex-1 border-t-2 ${
                  route ? ROUTE : lit ? LIT : DIM
                }`}
              />
              <svg
                viewBox="0 0 6 8"
                className={`h-2 w-1.5 shrink-0 ${side === "right" ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path d="M0 0 L6 4 L0 8 Z" fill="currentColor" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

function TeamRow({
  slot,
  side,
  lost = false,
}: {
  slot: Slot;
  side: "left" | "right";
  /** The other side won: fade this one so the winner stands out. */
  lost?: boolean;
}) {
  const reasons = useContext(QualifierReasonContext);
  const { selected, toggle } = useContext(SelectContext);
  const name = slot.team?.TeamName || slot.label || "TBD";
  const isSelected =
    Boolean(selected) &&
    slot.team?.TeamName?.trim().toLowerCase() === selected?.trim().toLowerCase();
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
        isSelected
          ? "font-semibold text-yellow"
          : slot.won
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

  const className = `relative flex h-9 w-full items-center gap-2 px-2 text-left transition-colors sm:h-10 ${
    isSelected
      ? "bg-yellow/15"
      : slot.won
        ? "bg-primary/12"
        : filled
          ? "hover:bg-white/5"
          : ""
  } ${lost && !isSelected ? "opacity-40" : ""} ${
    side === "right" ? "flex-row-reverse" : ""
  }`;
  const inner = (
    <>
      {slot.won || isSelected ? (
        <span
          className={`absolute inset-y-0 w-0.5 ${
            isSelected ? "bg-yellow" : "bg-primary"
          } ${side === "right" ? "right-0" : "left-0"}`}
        />
      ) : null}
      {circle}
      {label}
      {score}
    </>
  );

  // A real team can be tapped to follow its road; placeholders cannot.
  if (!filled) {
    return (
      <div title={reason} className={className}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      title={reason}
      aria-pressed={isSelected}
      onClick={(event) => {
        event.stopPropagation();
        toggle(slot.team?.TeamName ?? "");
      }}
      className={`${className} cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-yellow/60`}
    >
      {inner}
    </button>
  );
}

function Trophy({
  champion,
  selected,
}: {
  champion?: Teams;
  /** The tapped team: its name sits at the final, with where it stands. */
  selected: { name: string; status: string } | null;
}) {
  const { toggle } = useContext(SelectContext);
  const gold = Boolean(champion) && !selected;
  return (
    <div className="mx-1 flex shrink-0 flex-col sm:mx-3">
      <RoundLabel text="Final" />
      <div className="flex w-20 flex-1 flex-col items-center justify-center gap-1.5 sm:w-28">
        <span
          className={`grid h-12 w-12 place-items-center rounded-full border sm:h-16 sm:w-16 ${
            selected
              ? "border-yellow/60 bg-yellow/10"
              : gold
                ? "border-yellow/60 bg-yellow/15 shadow-[0_0_22px_-4px_rgba(253,193,21,0.7)]"
                : "border-white/10 bg-white/5"
          }`}
        >
          <svg
            viewBox="0 0 64 64"
            className={`h-7 w-7 sm:h-9 sm:w-9 ${
              selected || gold ? "text-yellow" : "text-white/40"
            }`}
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
        {selected ? (
          <>
            <button
              type="button"
              title="Clear"
              onClick={(event) => {
                event.stopPropagation();
                toggle(selected.name);
              }}
              className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full bg-yellow/15 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-yellow sm:text-xs"
            >
              <span className="truncate">{selected.name}</span>
              <span aria-hidden>×</span>
            </button>
            <span className="text-center text-[9px] uppercase leading-tight tracking-wider text-white/60 sm:text-[10px]">
              {selected.status}
            </span>
          </>
        ) : champion ? (
          <span className="inline-block max-w-full truncate rounded-full bg-yellow/15 px-2 py-0.5 text-center text-[10px] font-semibold uppercase leading-none tracking-wide text-yellow sm:text-xs">
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
