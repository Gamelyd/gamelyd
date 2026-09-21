"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Tournament,
  TournamentGroup,
  GroupQualifier,
} from "@/lib/schemas/tournament";
import type { Draw } from "@/lib/schemas/draw";
import type { ActionResult } from "@/lib/result";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import {
  advanceGroupStageAction,
  drawBrAction,
  drawGroupStageAction,
  drawKnockoutNextAction,
  drawLeagueAction,
  newDrawAction,
} from "@/server/actions/drawActions";
import { computeLeagueStandings } from "@/lib/leagueStandings";
import { groupTournamentAction } from "@/server/actions/tournamentActions";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
} from "@/lib/groupQualifiers";
import { isGroupDraw, isKnockoutDraw } from "@/lib/drawKind";
import {
  formatForSeriesGames,
  teamsStillIn,
  groupKnockoutTies,
  isKnockoutTieSettled,
  knockoutRulesSummary,
  tiesAtStage,
} from "@/lib/knockoutSeries";

type Pending =
  | "start"
  | "nextStage"
  | "groups"
  | "groupFixtures"
  | "advance"
  | "knockoutNext"
  | null;

export function TournamentStageControls({
  tournament,
  initialDraws,
  qualifiers,
  disqualifiedTeams,
  onDrawsChange,
  onGroupsChange,
  onStarted,
  onAfterAction,
}: {
  tournament: Tournament;
  initialDraws: Draw[];
  qualifiers?: GroupQualifier[];
  disqualifiedTeams?: string[];
  onDrawsChange?: (draws: Draw[]) => void;
  onGroupsChange?: (groups: TournamentGroup[]) => void;
  onStarted?: () => void;
  onAfterAction?: (
    kind: "start" | "groups" | "groupFixtures" | "advance" | "knockoutNext",
  ) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draws, setDraws] = useState(initialDraws);
  const [groups, setGroups] = useState(tournament.Groups ?? []);
  const [started, setStarted] = useState(tournament.Start);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const advancePerGroup = tournament.AdvancePerGroup || 2;
  const picks = qualifiers ?? tournament.Qualifiers ?? [];
  const manualQualifiers = tournament.OwnerCanSelectQualifiers;
  const dq = asDisqualifiedSet(
    disqualifiedTeams ?? tournament.DisqualifiedTeams,
  );

  const groupsCreated = groups.length > 0;
  const leagueStarted =
    tournament.TournamentMode === "LEAGUE" &&
    (started || tournament.IsDrawn || draws.length > 0);

  const groupDraws = useMemo(() => draws.filter(isGroupDraw), [draws]);
  const knockoutDraws = useMemo(() => draws.filter(isKnockoutDraw), [draws]);
  const format = tournament.KnockoutFormat;
  const groupStageDrawn = groupDraws.length > 0;
  const knockoutDrawn = knockoutDraws.length > 0;
  const allGroupPlayed =
    groupStageDrawn && groupDraws.every((d) => d.Played);
  const knockoutTies = useMemo(
    () => groupKnockoutTies(knockoutDraws, false),
    [knockoutDraws],
  );
  const maxKnockoutStage = knockoutDrawn
    ? Math.max(...knockoutTies.map((tie) => tie.stage))
    : 0;
  const latestKnockoutTies = tiesAtStage(knockoutTies, maxKnockoutStage);
  const knockoutRoundComplete =
    latestKnockoutTies.length > 0 &&
    latestKnockoutTies.every((tie) =>
      isKnockoutTieSettled(
        tie.games,
        formatForSeriesGames(tie.games, format),
      ),
    );
  // Decided when one team is left standing, not when the latest round holds a
  // single tie: an uneven bracket can have one half finish a round early.
  const knockoutSurvivors = teamsStillIn(knockoutTies, format);
  const knockoutDecided =
    knockoutSurvivors.allSettled && knockoutSurvivors.alive.length === 1;
  /**
   * The matches holding this round up. Naming them saves a host hunting
   * through the fixtures for the one result that has not been recorded.
   */
  const openMatches = latestKnockoutTies
    .filter(
      (tie) =>
        !isKnockoutTieSettled(tie.games, formatForSeriesGames(tie.games, format)),
    )
    .map((tie) => {
      const game = tie.games[0];
      return `${game?.Team1?.TeamName || "TBD"} v ${game?.Team2?.TeamName || "TBD"}`;
    });
  const waitingOn =
    openMatches.length > 0
      ? `Matches are drawn as results come in. Still to play: ${openMatches.join(
          ", ",
        )}.`
      : "Matches are drawn as results come in. Record the latest results from the Fixtures tab.";

  const standingSections = useMemo(
    () =>
      groups.map((group) => ({
        name: group.GroupName,
        standings: computeLeagueStandings(
          group.Teams,
          draws.filter((d) => d.Group === group.GroupName),
          tournament.PointSystem,
          tournament.TieBreaker,
        ),
      })),
    [groups, draws, tournament.PointSystem, tournament.TieBreaker],
  );
  const picksComplete = groupQualifiersComplete(
    standingSections,
    picks,
    advancePerGroup,
    dq,
    manualQualifiers,
  );

  const requestDraw = () => {
    setPending("start");
  };

  const handleDraw = async () => {
    setBusy(true);
    const action =
      tournament.TournamentMode === "BATTLEROYALE"
        ? drawBrAction
        : tournament.TournamentMode === "LEAGUE"
          ? drawLeagueAction
          : newDrawAction;
    const result = await action({ TournamentId: tournament.TournamentId });
    setBusy(false);
    setPending(null);
    if (result.ok) {
      setStarted(true);
      onStarted?.();
      toast.success(
        tournament.TournamentMode === "LEAGUE"
          ? "League started"
          : "Draw created",
      );
      const next = Array.isArray(result.data)
        ? result.data
        : [...draws, result.data];
      setDraws(next);
      onDrawsChange?.(next);
      router.refresh();
      onAfterAction?.("start");
    } else {
      toast.error(result.error);
    }
  };

  const handleGroup = async () => {
    setBusy(true);
    const result = await groupTournamentAction(tournament.TournamentId);
    setBusy(false);
    setPending(null);
    if (result.ok) {
      setGroups(result.data);
      onGroupsChange?.(result.data);
      setStarted(true);
      onStarted?.();
      toast.success("Groups created");
      router.refresh();
      onAfterAction?.("groups");
    } else {
      toast.error(result.error);
    }
  };

  const runDrawAction = async (
    action: () => Promise<ActionResult<Draw[]>>,
    successMessage: string,
    kind: "groupFixtures" | "advance" | "knockoutNext",
  ) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setPending(null);
    if (result.ok) {
      setStarted(true);
      onStarted?.();
      toast.success(successMessage);
      setDraws(result.data);
      onDrawsChange?.(result.data);
      router.refresh();
      onAfterAction?.(kind);
    } else {
      toast.error(result.error);
    }
  };

  const handleDrawGroupStage = () =>
    runDrawAction(
      () => drawGroupStageAction({ TournamentId: tournament.TournamentId }),
      "Group fixtures drawn",
      "groupFixtures",
    );

  const handleAdvance = () =>
    runDrawAction(
      () =>
        advanceGroupStageAction(tournament.TournamentId, {
          AdvancePerGroup: advancePerGroup,
        }),
      "Knockout stage drawn",
      "advance",
    );

  const handleKnockoutNext = () =>
    runDrawAction(
      () => drawKnockoutNextAction({ TournamentId: tournament.TournamentId }),
      "Next knockout round drawn",
      "knockoutNext",
    );

  const requestAdvance = () => {
    setPending("advance");
  };

  const requestKnockoutNext = () => {
    setPending("knockoutNext");
  };

  const confirmCopy = {
    start: {
      title: "Start this tournament?",
      message:
        "If you start this tournament, nobody else can join. Fixtures will be generated from the teams already registered.",
      confirmLabel: "Yes, start",
      onConfirm: handleDraw,
    },
    nextStage: {
      title: "Draw next stage?",
      message:
        "Are you sure all scores have been recorded? This cannot be undone. Winners of this round will be paired into the next fixtures.",
      confirmLabel: "Yes, draw",
      onConfirm: handleDraw,
    },
    groups: {
      title: "Create groups?",
      message: `Registered teams will be split into ${
        tournament.GroupCount > 0
          ? `${tournament.GroupCount} groups`
          : "groups"
      } and registration will close. Nobody else can join.`,
      confirmLabel: "Yes, create groups",
      onConfirm: handleGroup,
    },
    groupFixtures: {
      title: "Draw group fixtures?",
      message: tournament.ReturnLeg
        ? "Every pairing in a group is played twice (home and away). Teams can no longer be moved between groups after this."
        : "Every team plays each other in its group once. Teams can no longer be moved between groups after this.",
      confirmLabel: "Yes, draw fixtures",
      onConfirm: handleDrawGroupStage,
    },
    advance: {
      title: "Advance to knockout?",
      message: manualQualifiers
        ? "Are you sure all scores have been recorded? This cannot be undone. Qualifiers from the table (and any points-tie decisions) will be seeded into a knockout bracket."
        : `Are you sure all scores have been recorded? This cannot be undone. The top ${advancePerGroup} team${
            advancePerGroup === 1 ? "" : "s"
          } from each group will be seeded into a knockout bracket.`,
      confirmLabel: "Yes, advance",
      onConfirm: handleAdvance,
    },
    knockoutNext: {
      title: "Draw next knockout round?",
      message:
        "Are you sure all scores have been recorded? This cannot be undone. Winners of the current round will be paired into the next round.",
      confirmLabel: "Yes, draw",
      onConfirm: handleKnockoutNext,
    },
  };

  return (
    <>
      <div className="rounded-2xl border border-surface-2 bg-surface p-5">
        {tournament.TournamentMode === "LEAGUE" ? (
          !leagueStarted && draws.length === 0 ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Start league
              </h2>
              <p className="mb-4 text-sm text-body">
                {tournament.Shuffle === "AUTOMATIC"
                  ? "Randomize team order, then generate every matchday."
                  : "Keep registration order. First place is decided by points."}
                {tournament.ReturnLeg
                  ? " Return-leg fixtures are included."
                  : ""}
                {tournament.TieBreaker === "HEAD_TO_HEAD"
                  ? " Equal points are broken by head-to-head."
                  : ""}
              </p>
              <Button loading={busy} onClick={requestDraw}>
                Start league
              </Button>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                League started
              </h2>
              <p className="text-sm text-body">
                All matchdays are generated. Record scores from the fixtures
                tab. New teams can no longer join.
              </p>
            </>
          )
        ) : tournament.TournamentMode === "GROUPS" ? (
          !groupsCreated ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Create groups
              </h2>
              <p className="mb-4 text-sm text-body">
                Split registered teams into{" "}
                {tournament.GroupCount > 0
                  ? `${tournament.GroupCount} groups`
                  : "groups (auto, about four teams each)"}
                {tournament.Shuffle === "MANUAL"
                  ? " in registration order"
                  : " at random"}
                . Minimum 7 teams. You can move teams before drawing fixtures.
              </p>
              <Button loading={busy} onClick={() => setPending("groups")}>
                Create groups
              </Button>
            </>
          ) : !groupStageDrawn ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Draw group fixtures
              </h2>
              <p className="mb-4 text-sm text-body">
                Generate a round-robin inside every group
                {tournament.ReturnLeg
                  ? ": each pairing once, then again with sides swapped"
                  : ": each team plays the others in its group once"}
                . Teams can no longer be moved between groups afterwards.
              </p>
              <Button
                loading={busy}
                onClick={() => setPending("groupFixtures")}
              >
                Draw group fixtures
              </Button>
            </>
          ) : !knockoutDrawn ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Advance to knockout
              </h2>
              <p className="mb-4 text-sm text-body">
                {allGroupPlayed
                  ? manualQualifiers
                    ? picksComplete
                      ? "All group matches are in. Seed the qualifiers into the knockout bracket."
                      : "Teams finished level on points. Break the tie on the Groups tab, then come back to advance."
                    : `All group matches are in. The top ${advancePerGroup} from each group will be seeded into the knockout bracket.`
                  : "Record every group result from the Fixtures tab to unlock the knockout stage."}
              </p>
              <Button loading={busy} onClick={requestAdvance}>
                Advance to knockout
              </Button>
            </>
          ) : knockoutDecided ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Knockout complete
              </h2>
              <p className="text-sm text-body">
                The final has been played. Record the final score from the
                Fixtures tab if you haven&apos;t already.
              </p>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Knockout stage
              </h2>
              <p className="mb-4 text-sm text-body">
                {knockoutRoundComplete
                  ? "This round is complete. The next matches are drawn from the winners."
                  : waitingOn}
              </p>
              <Button loading={busy} onClick={requestKnockoutNext}>
                Draw any matches that are ready
              </Button>
            </>
          )
        ) : tournament.TournamentMode === "BATTLEROYALE" ? (
          draws.length > 0 ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Lobbies drawn
              </h2>
              <p className="text-sm text-body">
                Record lobby results from the Fixtures tab. You can&apos;t draw
                again until this stage is complete, and this event has a single
                lobby stage.
              </p>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Draw fixtures
              </h2>
              <p className="mb-4 text-sm text-body">
                {`Create ${tournament.BrLobbyCount || 1} lobby${
                  (tournament.BrLobbyCount || 1) === 1 ? "" : "s"
                }. Placement and kill points decide the table. Starting closes registration.`}
              </p>
              <Button loading={busy} onClick={requestDraw}>
                Start tournament
              </Button>
            </>
          )
        ) : knockoutDecided ? (
          <>
            <h2 className="mb-1 text-lg font-semibold text-white">
              Knockout complete
            </h2>
            <p className="text-sm text-body">
              The final has been played. Record the final score from the
              Fixtures tab if you haven&apos;t already.
            </p>
          </>
        ) : draws.length > 0 ? (
          <>
            <h2 className="mb-1 text-lg font-semibold text-white">
              Knockout stage
            </h2>
            <p className="mb-4 text-sm text-body">
              {knockoutRoundComplete
                ? "This round is complete. The next matches are drawn from the winners."
                : waitingOn}
            </p>
            <Button loading={busy} onClick={requestKnockoutNext}>
              Draw any matches that are ready
            </Button>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-semibold text-white">
              Draw fixtures
            </h2>
            <p className="mb-4 text-sm text-body">
              {`Generate ${tournament.Shuffle.toLowerCase()} fixtures (${knockoutRulesSummary(
                {
                  format: tournament.KnockoutFormat,
                  finalsUseSeries: tournament.KnockoutFinalsSeries,
                  thirdPlace: tournament.ThirdPlace,
                },
              )}). Starting closes registration.`}
            </p>
            <Button loading={busy} onClick={requestDraw}>
              Start tournament
            </Button>
          </>
        )}
      </div>

      <Confirm
        open={pending !== null}
        title={pending ? confirmCopy[pending].title : undefined}
        message={pending ? confirmCopy[pending].message : ""}
        confirmLabel={pending ? confirmCopy[pending].confirmLabel : "Confirm"}
        confirmVariant="default"
        loading={busy}
        onConfirm={() => {
          if (pending) void confirmCopy[pending].onConfirm();
        }}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
    </>
  );
}
