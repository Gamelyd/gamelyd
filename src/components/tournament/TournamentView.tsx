"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tournament } from "@/lib/schemas/tournament";
import { placeLabel } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Draw, Teams } from "@/lib/schemas/draw";
import type { ActionResult } from "@/lib/result";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Confirm } from "@/components/ui/Confirm";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { TeamCard } from "./TeamCard";
import { GroupsBoard, type GroupArrangement } from "./GroupsBoard";
import { GroupStandings } from "./GroupStandings";
import { KnockoutBracket } from "./KnockoutBracket";
import { Fixture, roundLabel } from "./Fixture";
import { RegisterTeam } from "./RegisterTeam";
import { LeagueTable } from "./LeagueTable";
import { ShareTournamentButton } from "./ShareTournamentButton";
import { computeLeagueStandings } from "@/lib/leagueStandings";
import {
  advanceGroupStageAction,
  drawBrAction,
  drawGroupStageAction,
  drawKnockoutNextAction,
  drawLeagueAction,
  getDrawsAction,
  newDrawAction,
} from "@/server/actions/drawActions";
import {
  addTournamentManagerAction,
  deleteTournamentAction,
  editTournamentSettingsAction,
  groupTournamentAction,
  listAssignableManagersAction,
  listTournamentManagersAction,
  removeTournamentManagerAction,
  setTournamentGroupsAction,
} from "@/server/actions/tournamentActions";
import type { TournamentManager } from "@/lib/schemas/tournament";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { tournamentShareDescription } from "@/lib/tournamentShare";

type Tab =
  | "details"
  | "teams"
  | "table"
  | "fixtures"
  | "bracket"
  | "register"
  | "manage"
  | "settings";

export function TournamentView({
  tournament,
  initialParticipants,
  initialDraws,
}: {
  tournament: Tournament;
  initialParticipants: RegisterTournament[];
  initialDraws: Draw[];
}) {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>(
    tournament.Start ? "details" : "teams",
  );
  const [participants, setParticipants] =
    useState<RegisterTournament[]>(initialParticipants);
  const [draws, setDraws] = useState<Draw[]>(initialDraws);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(tournament.Start);
  const [groups, setGroups] = useState(tournament.Groups ?? []);
  const [advanceCount, setAdvanceCount] = useState(
    String(tournament.AdvancePerGroup || 2),
  );
  const [pending, setPending] = useState<
    | "start"
    | "nextStage"
    | "groups"
    | "groupFixtures"
    | "advance"
    | "knockoutNext"
    | "delete"
    | null
  >(null);

  const isOwner = Boolean(user?.user_id && user.user_id === tournament.User_id);
  const isAdmin = user?.user_type === "ADMIN";
  const isManager = Boolean(
    user?.user_id && (tournament.Managers ?? []).includes(user.user_id),
  );
  const canManage = isOwner || isAdmin || isManager;
  const canAdminister = isOwner || isAdmin;
  const groupsCreated = groups.length > 0;
  const leagueStarted =
    tournament.TournamentMode === "LEAGUE" &&
    (started || tournament.IsDrawn || draws.length > 0);

  useEffect(() => {
    if (tab === "manage" && !canManage) setTab("details");
    if (tab === "settings" && !canAdminister) setTab("details");
  }, [tab, canManage, canAdminister]);

  const isGroups = tournament.TournamentMode === "GROUPS";
  const endsInKnockout =
    tournament.TournamentMode === "GROUPS" ||
    tournament.TournamentMode === "MULTIPLAYER";

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "details", label: "Details", show: true },
    {
      id: "teams",
      label: isGroups
        ? `Groups (${groups.length})`
        : `Teams (${participants.length})`,
      show: true,
    },
    {
      id: "table",
      label: "Table",
      show: tournament.TournamentMode === "LEAGUE",
    },
    { id: "fixtures", label: "Fixtures", show: true },
    { id: "bracket", label: "Bracket", show: endsInKnockout },
    { id: "register", label: "Register", show: true },
    { id: "manage", label: "Manage", show: canManage },
    { id: "settings", label: "Settings", show: canAdminister },
  ];

  const teamIcons = useMemo(
    () => iconMapFromTeams(participants),
    [participants],
  );

  const drawsByStage = useMemo(() => {
    const map = new Map<number, Draw[]>();
    for (const d of draws) {
      const list = map.get(d.Stage) ?? [];
      list.push(hydrateDrawIcons(d, teamIcons));
      map.set(d.Stage, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [draws, teamIcons]);

  const standings = useMemo(() => {
    if (tournament.TournamentMode !== "LEAGUE") return [];
    const teams: Teams[] = participants.map((p) => ({
      TeamName: p.TeamName,
      Players: p.Players,
      Icon: p.Icon,
      Points: 0,
      GoalsScored: 0,
      GoalsReceived: 0,
      GoalsDifference: 0,
    }));
    return computeLeagueStandings(teams, draws, tournament.PointSystem);
  }, [draws, participants, tournament.PointSystem, tournament.TournamentMode]);

  const hydratedDraws = useMemo(
    () => draws.map((d) => hydrateDrawIcons(d, teamIcons)),
    [draws, teamIcons],
  );

  const groupFixtureSections = useMemo(() => {
    const map = new Map<string, Draw[]>();
    for (const d of hydratedDraws) {
      if (!d.Group) continue;
      const list = map.get(d.Group) ?? [];
      list.push(d);
      map.set(d.Group, list);
    }
    return [...map.entries()].map(
      ([name, list]) =>
        [name, [...list].sort((a, b) => a.Stage - b.Stage)] as const,
    );
  }, [hydratedDraws]);

  const knockoutStages = useMemo(() => {
    const map = new Map<number, Draw[]>();
    for (const d of hydratedDraws) {
      if (d.Group?.trim() || d.BRTeams.length > 0) continue;
      const list = map.get(d.Stage) ?? [];
      list.push(d);
      map.set(d.Stage, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [hydratedDraws]);

  const groupStandings = useMemo(() => {
    if (!isGroups) return [];
    return groups.map((group) => ({
      name: group.GroupName,
      standings: computeLeagueStandings(
        group.Teams,
        draws.filter((d) => d.Group === group.GroupName),
        tournament.PointSystem,
      ),
    }));
  }, [isGroups, groups, draws, tournament.PointSystem]);

  const groupDraws = useMemo(
    () => draws.filter((d) => Boolean(d.Group?.trim())),
    [draws],
  );
  const knockoutDraws = useMemo(
    () =>
      draws.filter((d) => !d.Group?.trim() && d.BRTeams.length === 0),
    [draws],
  );
  const bracketGroupNames = useMemo(() => {
    const fromDoc = groups
      .map((g) => g.GroupName)
      .filter((name): name is string => Boolean(name && name.trim()));
    if (fromDoc.length > 0) return fromDoc;
    const seen = new Set<string>();
    const fromDraws: string[] = [];
    for (const draw of draws) {
      const name = draw.Group?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        fromDraws.push(name);
      }
    }
    return fromDraws;
  }, [groups, draws]);
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
    latestKnockoutRound.every((d) => d.Played);
  const knockoutDecided =
    knockoutRoundComplete && latestKnockoutRound.length === 1;

  const refreshDraws = async () => {
    const result = await getDrawsAction(tournament.TournamentId);
    if (result.ok) setDraws(result.data);
  };

  const updateDraw = (updated: Draw) =>
    setDraws((prev) =>
      prev.map((x) => (x.DrawId === updated.DrawId ? updated : x)),
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
      toast.success(
        tournament.TournamentMode === "LEAGUE"
          ? "League started"
          : "Draw created",
      );
      await refreshDraws();
      router.refresh();
      setTab(tournament.TournamentMode === "LEAGUE" ? "table" : "fixtures");
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
      setStarted(true);
      toast.success("Groups created");
      router.refresh();
      setTab("teams");
    } else {
      toast.error(result.error);
    }
  };

  const runDrawAction = async (
    action: () => Promise<ActionResult<Draw[]>>,
    successMessage: string,
    targetTab: Tab,
  ) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setPending(null);
    if (result.ok) {
      setStarted(true);
      toast.success(successMessage);
      await refreshDraws();
      router.refresh();
      setTab(targetTab);
    } else {
      toast.error(result.error);
    }
  };

  const handleDrawGroupStage = () =>
    runDrawAction(
      () => drawGroupStageAction({ TournamentId: tournament.TournamentId }),
      "Group fixtures drawn",
      "fixtures",
    );

  const handleAdvance = () =>
    runDrawAction(
      () =>
        advanceGroupStageAction(tournament.TournamentId, {
          AdvancePerGroup: Number(advanceCount) || 2,
        }),
      "Knockout stage drawn",
      "bracket",
    );

  const handleKnockoutNext = () =>
    runDrawAction(
      () => drawKnockoutNextAction({ TournamentId: tournament.TournamentId }),
      "Next knockout round drawn",
      "bracket",
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
    setPending("advance");
  };

  const requestKnockoutNext = () => {
    const remaining = latestKnockoutRound.filter((d) => !d.Played).length;
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

  const saveGroups = async (
    arrangement: GroupArrangement[],
  ): Promise<boolean> => {
    const result = await setTournamentGroupsAction(
      tournament.TournamentId,
      { Groups: arrangement },
    );
    if (result.ok) {
      setGroups(result.data);
      return true;
    }
    toast.error(result.error);
    return false;
  };

  const handleDelete = async () => {
    setBusy(true);
    const result = await deleteTournamentAction(tournament.TournamentId);
    setBusy(false);
    setPending(null);
    if (result.ok) {
      toast.success("Tournament updated");
      router.push("/");
    } else {
      toast.error(result.error);
    }
  };

  const confirmCopy = {
    start: {
      title: "Start this tournament?",
      message:
        "If you start this tournament, nobody else can join. Fixtures will be generated from the teams already registered.",
      confirmLabel: "Yes, start",
      confirmVariant: "default" as const,
      onConfirm: handleDraw,
    },
    nextStage: {
      title: "Draw next stage?",
      message:
        "This will generate the next round of fixtures. Existing results will stay as they are.",
      confirmLabel: "Yes, draw",
      confirmVariant: "default" as const,
      onConfirm: handleDraw,
    },
    groups: {
      title: "Create groups?",
      message:
        "Registered teams will be split into groups and registration will close. Nobody else can join.",
      confirmLabel: "Yes, create groups",
      confirmVariant: "default" as const,
      onConfirm: handleGroup,
    },
    groupFixtures: {
      title: "Draw group fixtures?",
      message:
        "Every team plays each other in its group. Teams can no longer be moved between groups after this.",
      confirmLabel: "Yes, draw fixtures",
      confirmVariant: "default" as const,
      onConfirm: handleDrawGroupStage,
    },
    advance: {
      title: "Advance to knockout?",
      message: `The top ${
        Number(advanceCount) || 2
      } team${
        (Number(advanceCount) || 2) === 1 ? "" : "s"
      } from each group will be seeded into a knockout bracket. Group results are locked in once you advance.`,
      confirmLabel: "Yes, advance",
      confirmVariant: "default" as const,
      onConfirm: handleAdvance,
    },
    knockoutNext: {
      title: "Draw next knockout round?",
      message:
        "Winners of the current round will be paired into the next round.",
      confirmLabel: "Yes, draw",
      confirmVariant: "default" as const,
      onConfirm: handleKnockoutNext,
    },
    delete: {
      title: "Delete tournament?",
      message: "Are you sure you want to delete this tournament?",
      confirmLabel: "Delete",
      confirmVariant: "danger" as const,
      onConfirm: handleDelete,
    },
  };

  return (
    <div>
      <section className="border-b border-surface-2 bg-bg">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-surface-4 sm:h-40 sm:w-32">
              <Image
                src={resolveIcon(tournament.icon, FALLBACKS.tournament)}
                alt=""
                fill
                sizes="128px"
                quality={90}
                className="object-contain p-1"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Tag payment={tournament.Payment} className="rounded-md" />
                <span className="rounded-full border border-white/15 bg-surface-2 px-3 py-1 text-xs text-white">
                  {tournament.TournamentMode}
                </span>
              </div>
              <h1 className="mt-3 font-display text-3xl text-white md:text-4xl">
                {tournament.Name}
              </h1>
              <p className="mt-2 text-body">
                {tournament.GameName} · {tournament.Date}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ShareTournamentButton
                  name={tournament.Name}
                  description={tournamentShareDescription(tournament)}
                  urlPath={`/tournament/${tournament.TournamentId}`}
                />
                <button
                  type="button"
                  onClick={() => setTab("teams")}
                  className="inline-flex h-9 items-center rounded-full border border-white/15 bg-surface-2 px-3 text-sm text-white hover:border-primary/50"
                >
                  {participants.length} of {tournament.TournamentSize} teams
                  registered
                </button>
                {tournament.OrgId && tournament.OrgName && (
                  <Link
                    href={`/org/${tournament.OrgId}`}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-surface-2 px-3 text-sm text-white hover:border-primary/50"
                  >
                    {tournament.OrgIcon ? (
                      <Image
                        src={tournament.OrgIcon}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                    ) : null}
                    Hosted by {tournament.OrgName}
                  </Link>
                )}
              </div>
              {!user && (
                <p className="mt-4 max-w-xl text-sm text-body">
                  Log in or create an account to register for this tournament.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-surface-2 bg-nav">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`cursor-pointer whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-body hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-10">
        {tab === "details" && <Details tournament={tournament} />}

        {tab === "table" && tournament.TournamentMode === "LEAGUE" && (
          <LeagueTable standings={standings} />
        )}

        {tab === "teams" && (
          groupsCreated ? (
            groupStageDrawn ? (
              <GroupStandings
                sections={groupStandings}
                advancePerGroup={tournament.AdvancePerGroup || 2}
              />
            ) : (
              <GroupsBoard
                groups={groups}
                participants={participants}
                editable={canManage}
                onSave={saveGroups}
              />
            )
          ) : (
            <div className="flex flex-wrap justify-center gap-5 py-2">
              {participants.length === 0 ? (
                <p className="w-full py-16 text-center text-body">
                  No registered teams yet
                </p>
              ) : (
                participants.map((p) => (
                  <TeamCard key={p.RegisterTournamentId || p._id} team={p} />
                ))
              )}
            </div>
          )
        )}

        {tab === "fixtures" &&
          (isGroups ? (
            <div className="space-y-12">
              {groupFixtureSections.length === 0 &&
              knockoutStages.length === 0 ? (
                <FixturesEmpty
                  started={started}
                  participantCount={participants.length}
                  onViewTeams={() => setTab("teams")}
                />
              ) : (
                <>
                  {groupFixtureSections.map(([name, sectionDraws]) => (
                    <div key={name}>
                      <div className="mb-8 bg-primary-panel px-4 py-5 text-center font-display text-[23px] leading-none tracking-wide text-white">
                        {name}
                      </div>
                      <div className="flex flex-col items-center gap-8">
                        {sectionDraws.map((d) => (
                          <Fixture
                            key={d.DrawId || d._id}
                            draw={d}
                            canManage={canManage}
                            onUpdated={updateDraw}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {knockoutStages.map(([stage, stageDraws]) => (
                    <div key={`ko-${stage}`}>
                      <div className="mb-8 bg-primary-panel px-4 py-5 text-center font-display text-[23px] leading-none tracking-wide text-white">
                        {roundLabel(stageDraws.length, stage)}
                      </div>
                      <div className="flex flex-col items-center gap-8">
                        {stageDraws.map((d) => (
                          <Fixture
                            key={d.DrawId || d._id}
                            draw={d}
                            canManage={canManage}
                            onUpdated={updateDraw}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {drawsByStage.length === 0 ? (
                <FixturesEmpty
                  started={started}
                  participantCount={participants.length}
                  onViewTeams={() => setTab("teams")}
                />
              ) : (
                drawsByStage.map(([stage, stageDraws]) => (
                  <div key={stage}>
                    <div className="mb-8 bg-primary-panel px-4 py-5 text-center font-display text-[23px] leading-none tracking-wide text-white">
                      {roundLabel(
                        stageDraws.length,
                        stage,
                        tournament.TournamentMode,
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-8">
                      {stageDraws.map((d) => (
                        <Fixture
                          key={d.DrawId || d._id}
                          draw={d}
                          canManage={canManage}
                          onUpdated={updateDraw}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}

        {tab === "bracket" && (
          <KnockoutBracket
            rounds={knockoutStages.map(([stage, matches]) => ({
              stage,
              matches,
            }))}
            groupNames={bracketGroupNames}
            advancePerGroup={
              Number(advanceCount) || tournament.AdvancePerGroup || 2
            }
            teamCount={isGroups ? 0 : participants.length}
            isGroupMode={isGroups}
            knockoutLive={knockoutDraws.length > 0}
          />
        )}

        {tab === "register" &&
          (started ? (
            <div className="mx-auto max-w-lg rounded-xl border border-surface-2 bg-surface p-8 text-center">
              <h3 className="text-xl font-semibold text-white">
                Registration closed
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-body">
                This tournament has already started, so new teams cannot join.
              </p>
            </div>
          ) : user ? (
            <RegisterTeam
              tournamentId={tournament.TournamentId}
              teamSize={tournament.Team}
              onRegistered={(reg) => {
                setParticipants((prev) => [...prev, reg]);
                toast.success("Team registered");
                setTab("teams");
              }}
            />
          ) : (
            <GuestRegisterPrompt tournamentId={tournament.TournamentId} />
          ))}

        {tab === "manage" && canManage && (
          <div className="flex max-w-md flex-col gap-4">
            {tournament.TournamentMode === "LEAGUE" ? (
              !leagueStarted && draws.length === 0 ? (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">Start league</h3>
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
                </div>
              ) : (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">League started</h3>
                  <p className="text-sm text-body">
                    All matchdays are generated. Record scores from the fixtures
                    tab. New teams can no longer join.
                    {isAdmin
                      ? " If this was started by mistake, reset it from Admin → Tournaments → Manage."
                      : ""}
                  </p>
                </div>
              )
            ) : tournament.TournamentMode === "GROUPS" ? (
              !groupsCreated ? (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">
                    Create groups
                  </h3>
                  <p className="mb-4 text-sm text-body">
                    Split registered teams into groups (min 7 teams). You can
                    fine-tune group members before drawing fixtures.
                  </p>
                  <Button loading={busy} onClick={() => setPending("groups")}>
                    Create groups
                  </Button>
                </div>
              ) : !groupStageDrawn ? (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">
                    Draw group fixtures
                  </h3>
                  <p className="mb-4 text-sm text-body">
                    Generate a round-robin inside every group — each team plays
                    all others in its group. Teams can no longer be moved
                    between groups afterwards.
                  </p>
                  <Button loading={busy} onClick={() => setPending("groupFixtures")}>
                    Draw group fixtures
                  </Button>
                </div>
              ) : !knockoutDrawn ? (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">
                    Advance to knockout
                  </h3>
                  <p className="mb-4 text-sm text-body">
                    {allGroupPlayed
                      ? "All group matches are in. Choose how many teams advance from each group, then seed the knockout bracket."
                      : "Record every group result from the Fixtures tab to unlock the knockout stage."}
                  </p>
                  <div className="mb-4 max-w-55">
                    <Input
                      label="Teams advancing per group"
                      type="number"
                      min={1}
                      max={8}
                      value={advanceCount}
                      onChange={(e) => setAdvanceCount(e.target.value)}
                    />
                  </div>
                  <Button loading={busy} onClick={requestAdvance}>
                    Advance to knockout
                  </Button>
                  {isAdmin ? (
                    <p className="mt-3 text-xs text-body">
                      If this was started by mistake, reset it from Admin →
                      Tournaments → Manage.
                    </p>
                  ) : null}
                </div>
              ) : knockoutDecided ? (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">
                    Knockout complete
                  </h3>
                  <p className="text-sm text-body">
                    The final has been played. Record the final score from the
                    Fixtures tab if you haven&apos;t already.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-surface-2 bg-surface p-5">
                  <h3 className="mb-1 font-semibold text-white">
                    Knockout stage
                  </h3>
                  <p className="mb-4 text-sm text-body">
                    {knockoutRoundComplete
                      ? "This round is complete. Draw the next round from the winners."
                      : "Record the current round's results from the Fixtures tab, then draw the next round."}
                  </p>
                  <Button loading={busy} onClick={requestKnockoutNext}>
                    Draw next knockout round
                  </Button>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-surface-2 bg-surface p-5">
                <h3 className="mb-1 font-semibold text-white">Draw fixtures</h3>
                <p className="mb-4 text-sm text-body">
                  {draws.length > 0
                    ? "Generate the next round of fixtures."
                    : `Generate ${tournament.Shuffle.toLowerCase()} fixtures from the registered teams. Starting closes registration.`}
                </p>
                <Button loading={busy} onClick={requestDraw}>
                  {draws.length > 0 ? "Draw next stage" : "Start tournament"}
                </Button>
                {started && isAdmin ? (
                  <p className="mt-3 text-xs text-body">
                    If this was started by mistake, reset it from Admin →
                    Tournaments → Manage.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && canAdminister && (
          <div className="flex max-w-xl flex-col gap-4">
            <EditTournamentSettings
              tournament={tournament}
              started={started}
              registeredCount={participants.length}
              onSaved={() => router.refresh()}
            />

            <ManagerSettings
              tournamentId={tournament.TournamentId}
              hasOrg={Boolean(tournament.OrgId)}
              orgName={tournament.OrgName}
            />

            <div className="rounded-xl border border-lose/30 bg-surface p-5">
              <h3 className="mb-1 font-semibold text-white">Danger zone</h3>
              <p className="mb-4 text-sm text-body">
                Delete this tournament. This can be toggled.
              </p>
              <Button variant="danger" onClick={() => setPending("delete")}>
                Delete tournament
              </Button>
            </div>
          </div>
        )}
      </section>

      <Confirm
        open={pending !== null}
        title={pending ? confirmCopy[pending].title : undefined}
        message={pending ? confirmCopy[pending].message : ""}
        confirmLabel={pending ? confirmCopy[pending].confirmLabel : "Confirm"}
        confirmVariant={
          pending ? confirmCopy[pending].confirmVariant : "danger"
        }
        loading={busy}
        onConfirm={() => {
          if (pending) void confirmCopy[pending].onConfirm();
        }}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
    </div>
  );
}

function EditTournamentSettings({
  tournament,
  started,
  registeredCount,
  onSaved,
}: {
  tournament: Tournament;
  started: boolean;
  registeredCount: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busyField, setBusyField] = useState<"" | "shuffle" | "type" | "size">(
    "",
  );
  const [shuffle, setShuffle] = useState(tournament.Shuffle);
  const [type, setType] = useState(tournament.TournamentType);
  const [size, setSize] = useState(String(tournament.TournamentSize));
  const [confirmVisibility, setConfirmVisibility] = useState(false);

  if (started) {
    return (
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="mb-1 font-semibold text-white">Tournament settings</h3>
        <p className="text-sm text-body">
          The tournament has started, so its settings are locked. You can still
          record results from the Manage and Fixtures tabs.
        </p>
      </div>
    );
  }

  const save = async (
    field: "shuffle" | "type" | "size",
    patch: Record<string, unknown>,
  ) => {
    setBusyField(field);
    const result = await editTournamentSettingsAction(
      tournament.TournamentId,
      patch,
    );
    setBusyField("");
    if (result.ok) {
      toast.success(result.message ?? "Settings saved");
      onSaved();
    } else {
      toast.error(result.error);
    }
    return result.ok;
  };

  const changeShuffle = (next: Tournament["Shuffle"]) => {
    if (next === tournament.Shuffle || busyField) return;
    setShuffle(next);
    void save("shuffle", { Shuffle: next }).then((ok) => {
      if (!ok) setShuffle(tournament.Shuffle);
    });
  };

  const changeType = (next: Tournament["TournamentType"]) => {
    if (next === tournament.TournamentType || busyField) return;
    setType(next);
    setConfirmVisibility(true);
  };

  const saveSize = () => {
    if (busyField) return;
    if (size === String(tournament.TournamentSize)) return;
    const value = Number(size);
    if (!Number.isFinite(value) || value < 1) {
      toast.error("Enter a valid tournament size");
      setSize(String(tournament.TournamentSize));
      return;
    }
    if (value < registeredCount) {
      toast.error(
        `Size can't be less than the ${registeredCount} team${
          registeredCount === 1 ? "" : "s"
        } already registered`,
      );
      setSize(String(tournament.TournamentSize));
      return;
    }
    void save("size", { TournamentSize: value }).then((ok) => {
      if (!ok) setSize(String(tournament.TournamentSize));
    });
  };

  const saveVisibility = async () => {
    setConfirmVisibility(false);
    const ok = await save("type", { TournamentType: type });
    if (!ok) setType(tournament.TournamentType);
  };

  const cancelVisibility = () => {
    if (busyField === "type") return;
    setConfirmVisibility(false);
    setType(tournament.TournamentType);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-surface-2 bg-surface p-5">
      <div>
        <h3 className="mb-1 font-semibold text-white">Tournament settings</h3>
        <p className="text-sm text-body">
          Editable while registration is open. Changes save automatically.
        </p>
      </div>

      <Select
        label={busyField === "shuffle" ? "Draw order — saving…" : "Draw order"}
        value={shuffle}
        disabled={Boolean(busyField)}
        onChange={(e) => changeShuffle(e.target.value as Tournament["Shuffle"])}
        options={[
          { label: "Automatic", value: "AUTOMATIC" },
          { label: "Manual", value: "MANUAL" },
        ]}
      />

      <Select
        label={busyField === "type" ? "Visibility — saving…" : "Visibility"}
        value={type}
        disabled={Boolean(busyField)}
        onChange={(e) =>
          changeType(e.target.value as Tournament["TournamentType"])
        }
        options={[
          { label: "Public", value: "PUBLIC" },
          { label: "Private", value: "PRIVATE" },
        ]}
      />

      <Input
        label={
          busyField === "size" ? "Tournament size — saving…" : "Tournament size"
        }
        type="number"
        min={Math.max(registeredCount, 1)}
        value={size}
        disabled={Boolean(busyField)}
        onChange={(e) => setSize(e.target.value)}
        onBlur={saveSize}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveSize();
          }
        }}
      />

      <Confirm
        open={confirmVisibility}
        title="Change visibility?"
        message={
          type === "PRIVATE"
            ? "Making this tournament private will hide it from public listings and search. Only people with the link can find it."
            : "Making this tournament public will list it in browse and search so anyone can find and join it."
        }
        confirmLabel="Yes, change"
        confirmVariant="default"
        loading={busyField === "type"}
        onConfirm={() => void saveVisibility()}
        onCancel={cancelVisibility}
      />
    </div>
  );
}

function FixturesEmpty({
  started,
  participantCount,
  onViewTeams,
}: {
  started: boolean;
  participantCount: number;
  onViewTeams: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <p className="text-body">
        {started
          ? "No draws available, come back later"
          : "Fixtures appear after the tournament starts."}
      </p>
      {!started && participantCount > 0 && (
        <button
          type="button"
          onClick={onViewTeams}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          View {participantCount} registered teams
        </button>
      )}
    </div>
  );
}

function managerName(m: TournamentManager): string {
  const full = `${m.first_name} ${m.last_name}`.trim();
  return full || m.user_name || m.email || "Member";
}

function ManagerSettings({
  tournamentId,
  hasOrg,
  orgName,
}: {
  tournamentId: string;
  hasOrg: boolean;
  orgName: string;
}) {
  const toast = useToast();
  const [managers, setManagers] = useState<TournamentManager[]>([]);
  const [candidates, setCandidates] = useState<TournamentManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      listTournamentManagersAction(tournamentId),
      listAssignableManagersAction(tournamentId),
    ]).then(([managersResult, candidatesResult]) => {
      if (!active) return;
      if (managersResult.ok) setManagers(managersResult.data);
      else toast.error(managersResult.error);
      if (candidatesResult.ok) setCandidates(candidatesResult.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tournamentId, toast]);

  const add = async (userId: string) => {
    setBusyId(userId);
    const result = await addTournamentManagerAction(tournamentId, userId);
    setBusyId("");
    if (result.ok) {
      setManagers(result.data);
      setCandidates((prev) => prev.filter((c) => c.user_id !== userId));
      toast.success(result.message ?? "Manager added");
    } else {
      toast.error(result.error);
    }
  };

  const remove = async (member: TournamentManager) => {
    setBusyId(member.user_id);
    const result = await removeTournamentManagerAction(
      tournamentId,
      member.user_id,
    );
    setBusyId("");
    if (result.ok) {
      setManagers(result.data);
      setCandidates((prev) =>
        prev.some((c) => c.user_id === member.user_id)
          ? prev
          : [...prev, member],
      );
      toast.success(result.message ?? "Manager removed");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5">
      <h3 className="mb-1 font-semibold text-white">Tournament managers</h3>
      <p className="mb-4 text-sm text-body">
        Add people from your organization who can help run this tournament —
        draw fixtures, record scores and create groups. Only you and platform
        admins can manage this list.
      </p>

      {!hasOrg ? (
        <p className="rounded-lg border border-surface-2 bg-surface-2/40 p-4 text-sm text-body">
          Host this tournament under an organization to add managers.
        </p>
      ) : loading ? (
        <p className="text-sm text-body">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-body">
              Current managers
            </h4>
            {managers.length === 0 ? (
              <p className="text-sm text-body">
                No managers yet. Add someone from {orgName || "your organization"}
                below.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {managers.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-2 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {managerName(m)}
                      </span>
                      {m.user_name ? (
                        <span className="block truncate text-xs text-body">
                          @{m.user_name}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      variant="danger"
                      loading={busyId === m.user_id}
                      onClick={() => remove(m)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-body">
              Add from {orgName || "your organization"}
            </h4>
            {candidates.length === 0 ? (
              <p className="text-sm text-body">
                No other organization members to add.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <li
                    key={c.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-2 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {managerName(c)}
                      </span>
                      {c.user_name ? (
                        <span className="block truncate text-xs text-body">
                          @{c.user_name}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      loading={busyId === c.user_id}
                      onClick={() => add(c.user_id)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GuestRegisterPrompt({ tournamentId }: { tournamentId: string }) {
  const redirect = `/signup?redirect=${encodeURIComponent(`/tournament/${tournamentId}`)}`;

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-surface-2 bg-surface p-8 text-center">
      <h3 className="text-xl font-semibold text-white">
        Sign in to register
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-body">
        You need an account before you can view the registration form and join
        this tournament. Log in if you already have one, or create a free
        account.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={redirect}>
          <Button>Log in</Button>
        </Link>
        <Link href={redirect}>
          <Button variant="outline">Create account</Button>
        </Link>
      </div>
    </div>
  );
}

function Details({ tournament }: { tournament: Tournament }) {
  const rows: { label: string; value: string }[] = [
    { label: "Game", value: tournament.GameName },
    { label: "Mode", value: tournament.TournamentMode },
    ...(tournament.TournamentMode === "LEAGUE"
      ? [
          {
            label: "Return leg",
            value: tournament.ReturnLeg ? "Yes" : "No",
          },
        ]
      : []),
    { label: "Team size", value: tournament.Team },
    { label: "Visibility", value: tournament.TournamentType },
    { label: "Payment", value: tournament.Payment },
    { label: "Draw", value: tournament.Shuffle },
    { label: "Size", value: `${tournament.TournamentSize} teams` },
    { label: "Date", value: tournament.Date },
    { label: "Platform", value: tournament.Platform || "—" },
    ...(tournament.Payment === "PAID"
      ? [
          {
            label: "Registration fee",
            value: `₦${tournament.RegistrationAmount.toLocaleString()}`,
          },
        ]
      : []),
    {
      label: "Prize pool",
      value: tournament.Amount ? `₦${tournament.Amount.toLocaleString()}` : "—",
    },
    ...(tournament.Prizes ?? []).map((prize) => ({
      label: `${placeLabel(prize.Position)} prize`,
      value: `₦${prize.Amount.toLocaleString()}`,
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white">
          About
        </h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-body">
          {tournament.Note || "No description yet."}
        </p>
      </div>
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">
          Details
        </h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs text-body">{r.label}</dt>
              <dd className="mt-0.5 font-medium text-white">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
