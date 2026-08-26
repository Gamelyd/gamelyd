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
import { isKnockoutMatchSettled } from "@/lib/knockoutSeed";
import { groupTournamentAction } from "@/server/actions/tournamentActions";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
} from "@/lib/groupQualifiers";

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

  const groupDraws = useMemo(
    () => draws.filter((d) => Boolean(d.Group?.trim())),
    [draws],
  );
  const knockoutDraws = useMemo(
    () => draws.filter((d) => !d.Group?.trim() && d.BRTeams.length === 0),
    [draws],
  );
  const groupStageDrawn = groupDraws.length > 0;
  const knockoutDrawn = knockoutDraws.length > 0;
  const allGroupPlayed =
    groupStageDrawn && groupDraws.every((d) => d.Played);
  const maxKnockoutStage = knockoutDrawn
    ? Math.max(...knockoutDraws.map((d) => d.Stage))
    : 0;
  const latestKnockoutRound = knockoutDraws.filter(
    (d) => d.Stage === maxKnockoutStage,
  );
  const knockoutRoundComplete =
    latestKnockoutRound.length > 0 &&
    latestKnockoutRound.every((d) => isKnockoutMatchSettled(d));
  const knockoutDecided =
    knockoutRoundComplete && latestKnockoutRound.length === 1;

  const standingSections = useMemo(
    () =>
      groups.map((group) => ({
        name: group.GroupName,
        standings: computeLeagueStandings(
          group.Teams,
          draws.filter((d) => d.Group === group.GroupName),
          tournament.PointSystem,
        ),
      })),
    [groups, draws, tournament.PointSystem],
  );
  const picksComplete = groupQualifiersComplete(
    standingSections,
    picks,
    advancePerGroup,
    dq,
    manualQualifiers,
  );

  const requestDraw = () => {
    setPending(draws.length === 0 && !started ? "start" : "nextStage");
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
    const remaining = groupDraws.filter((d) => !d.Played).length;
    if (remaining > 0) {
      toast.error(
        `Record ${remaining} more group match${
          remaining === 1 ? "" : "es"
        } before advancing.`,
      );
      return;
    }
    if (manualQualifiers && !picksComplete) {
      toast.error(
        "Teams are level on points. Pick who goes through (and why) on the Groups tab first.",
      );
      return;
    }
    setPending("advance");
  };

  const requestKnockoutNext = () => {
    const remaining = latestKnockoutRound.filter(
      (d) => !isKnockoutMatchSettled(d),
    ).length;
    if (remaining > 0) {
      toast.error(
        `${remaining} match${
          remaining === 1 ? "" : "es"
        } in this round still need a result.`,
      );
      return;
    }
    const ties = latestKnockoutRound.filter(
      (d) =>
        Boolean(d.Team2?.TeamName) &&
        d.Winner === "" &&
        d.Team1Score === d.Team2Score,
    ).length;
    if (ties > 0) {
      toast.error(
        `${ties} tie${
          ties === 1 ? "" : "s"
        } ended level — set a winner before drawing the next round.`,
      );
      return;
    }
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
        "This will generate the next round of fixtures. Existing results will stay as they are.",
      confirmLabel: "Yes, draw",
      onConfirm: handleDraw,
    },
    groups: {
      title: "Create groups?",
      message:
        "Registered teams will be split into groups and registration will close. Nobody else can join.",
      confirmLabel: "Yes, create groups",
      onConfirm: handleGroup,
    },
    groupFixtures: {
      title: "Draw group fixtures?",
      message:
        "Every team plays each other in its group. Teams can no longer be moved between groups after this.",
      confirmLabel: "Yes, draw fixtures",
      onConfirm: handleDrawGroupStage,
    },
    advance: {
      title: "Advance to knockout?",
      message: manualQualifiers
        ? "Qualifiers from the table (and any points-tie decisions) will be seeded into a knockout bracket. Group results are locked in once you advance."
        : `The top ${advancePerGroup} team${
            advancePerGroup === 1 ? "" : "s"
          } from each group will be seeded into a knockout bracket. Group results are locked in once you advance.`,
      confirmLabel: "Yes, advance",
      onConfirm: handleAdvance,
    },
    knockoutNext: {
      title: "Draw next knockout round?",
      message:
        "Winners of the current round will be paired into the next round.",
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
                Split registered teams into groups (min 7 teams). You can
                fine-tune group members before drawing fixtures.
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
                Generate a round-robin inside every group — each team plays all
                others in its group. Teams can no longer be moved between groups
                afterwards.
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
                  ? "This round is complete. Draw the next round from the winners."
                  : "Record the current round's results from the Fixtures tab, then draw the next round."}
              </p>
              <Button loading={busy} onClick={requestKnockoutNext}>
                Draw next knockout round
              </Button>
            </>
          )
        ) : (
          <>
            <h2 className="mb-1 text-lg font-semibold text-white">
              Draw fixtures
            </h2>
            <p className="mb-4 text-sm text-body">
              {draws.length > 0
                ? "Generate the next round of fixtures."
                : `Generate ${tournament.Shuffle.toLowerCase()} fixtures from the registered teams. Starting closes registration.`}
            </p>
            <Button loading={busy} onClick={requestDraw}>
              {draws.length > 0 ? "Draw next stage" : "Start tournament"}
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
