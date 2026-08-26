"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Tournament, GroupQualifier } from "@/lib/schemas/tournament";
import { placeLabel } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { TeamCard } from "./TeamCard";
import { GroupsBoard, type GroupArrangement } from "./GroupsBoard";
import { GroupStandings } from "./GroupStandings";
import { KnockoutBracket } from "./KnockoutBracket";
import {
  SelectQualifiers,
  QualifierList,
} from "./SelectQualifiers";
import { Fixture, roundLabel } from "./Fixture";
import { RegisterTeam } from "./RegisterTeam";
import { LeagueTable } from "./LeagueTable";
import { ShareTournamentButton } from "./ShareTournamentButton";
import { TournamentStageControls } from "./TournamentStageControls";
import { NextStageModal } from "./NextStageModal";
import { WinnerCelebration } from "./WinnerCelebration";
import { computeLeagueStandings } from "@/lib/leagueStandings";
import { setTournamentGroupsAction } from "@/server/actions/tournamentActions";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { tournamentShareDescription } from "@/lib/tournamentShare";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
} from "@/lib/groupQualifiers";
import { isKnockoutBye } from "@/lib/knockoutSeed";
import {
  nextStageAfterScore,
  type NextStagePrompt,
} from "@/lib/nextStagePrompt";

type Tab =
  | "details"
  | "teams"
  | "table"
  | "fixtures"
  | "register"
  | "run";

type TeamsPanel = "teams" | "bracket";

export function TournamentView({
  tournament,
  initialParticipants,
  initialDraws,
  initialTab,
}: {
  tournament: Tournament;
  initialParticipants: RegisterTournament[];
  initialDraws: Draw[];
  initialTab?: Tab;
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab === "register" && !tournament.Start) return "register";
    return tournament.Start ? "details" : "teams";
  });
  const [participants, setParticipants] =
    useState<RegisterTournament[]>(initialParticipants);
  const [draws, setDraws] = useState<Draw[]>(initialDraws);
  const [groups, setGroups] = useState(tournament.Groups ?? []);
  const [qualifiers, setQualifiers] = useState<GroupQualifier[]>(
    tournament.Qualifiers ?? [],
  );
  const disqualifiedTeams = tournament.DisqualifiedTeams ?? [];
  const [started, setStarted] = useState(tournament.Start);
  const isKnockout = tournament.TournamentMode === "MULTIPLAYER";
  const [teamsPanel, setTeamsPanel] = useState<TeamsPanel>("bracket");
  const [stagePrompt, setStagePrompt] = useState<NextStagePrompt | null>(null);
  const champion = useMemo(
    () => resolveChampion(tournament, draws, participants),
    [tournament, draws, participants],
  );
  const championName = champion?.TeamName?.trim() ?? "";
  const [celebrate, setCelebrate] = useState(() => Boolean(championName));

  useEffect(() => {
    if (championName) setCelebrate(true);
  }, [championName]);

  const isOwner = Boolean(user?.user_id && user.user_id === tournament.User_id);
  const isAdmin = user?.user_type === "ADMIN";
  const isManager = Boolean(
    user?.user_id && (tournament.Managers ?? []).includes(user.user_id),
  );
  const canManage = isOwner || isAdmin || isManager;
  const canAdminister = isOwner || isAdmin;
  const canReshuffle =
    isAdmin || (canManage && tournament.OwnerCanReshuffleGroups);
  const isRegistered = Boolean(
    user?.user_id &&
      participants.some((p) =>
        (p.Players ?? []).some((pl) => pl.User_id === user.user_id),
      ),
  );
  const canRegister = !started && !isRegistered;
  const groupsCreated = groups.length > 0;

  const isGroups = tournament.TournamentMode === "GROUPS";

  useEffect(() => {
    if (tab === "run" && !canManage) setTab("details");
  }, [tab, canManage]);

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
    { id: "register", label: "Register", show: canRegister },
    { id: "run", label: "Run", show: canManage },
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
    const stages = [...map.entries()];
    if (tournament.TournamentMode === "LEAGUE") {
      const unplayed = stages
        .filter(([, list]) => list.some((d) => !d.Played))
        .map(([stage]) => stage);
      const current =
        unplayed.length > 0
          ? Math.min(...unplayed)
          : Math.max(0, ...stages.map(([stage]) => stage));
      return stages.sort((a, b) => {
        const rank = (stage: number) => {
          if (stage === current) return 0;
          if (stage > current) return stage - current;
          return 1000 + (current - stage);
        };
        return rank(a[0]) - rank(b[0]);
      });
    }
    return stages.sort((a, b) => b[0] - a[0]);
  }, [draws, teamIcons, tournament.TournamentMode]);

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
        [name, [...list].sort((a, b) => b.Stage - a.Stage)] as const,
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
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [hydratedDraws]);

  const [openFixtureGroups, setOpenFixtureGroups] = useState<
    string[] | "default"
  >("default");

  const fixtureGroupIsOpen = (name: string, index: number) => {
    if (openFixtureGroups === "default") {
      return !knockoutDrawn && index === 0;
    }
    return openFixtureGroups.includes(name);
  };

  const toggleFixtureGroup = (name: string) => {
    const current =
      openFixtureGroups === "default"
        ? !knockoutDrawn && groupFixtureSections[0]?.[0]
          ? [groupFixtureSections[0][0]]
          : []
        : openFixtureGroups;
    setOpenFixtureGroups(
      current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name],
    );
  };

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
  const allGroupPlayed =
    groupStageDrawn && groupDraws.every((d) => d.Played);
  const knockoutDrawn = knockoutDraws.length > 0;
  const canSelectQualifiers =
    isGroups && tournament.OwnerCanSelectQualifiers;

  const handleDrawUpdated = (updated: Draw) => {
    const previous = draws.find((d) => d.DrawId === updated.DrawId);
    const next = draws.map((d) =>
      d.DrawId === updated.DrawId ? updated : d,
    );
    setDraws(next);
    if (!canManage) return;

    const sections = groups.map((group) => ({
      name: group.GroupName,
      standings: computeLeagueStandings(
        group.Teams,
        next.filter((d) => d.Group === group.GroupName),
        tournament.PointSystem,
      ),
    }));
    const picksComplete = groupQualifiersComplete(
      sections,
      qualifiers,
      tournament.AdvancePerGroup || 2,
      asDisqualifiedSet(disqualifiedTeams),
      Boolean(canSelectQualifiers),
    );
    const prompt = nextStageAfterScore({
      mode: tournament.TournamentMode,
      draws: next,
      scored: updated,
      wasAlreadyPlayed: Boolean(previous?.Played),
      canSelectQualifiers: Boolean(canSelectQualifiers),
      picksComplete,
    });
    if (prompt) setStagePrompt(prompt);
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

  return (
    <div>
      {celebrate && champion?.TeamName?.trim() ? (
        <WinnerCelebration
          team={champion}
          tournamentName={tournament.Name}
          gameName={tournament.GameName}
          onClose={() => setCelebrate(false)}
        />
      ) : null}
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
                {champion?.TeamName?.trim() ? (
                  <button
                    type="button"
                    onClick={() => setCelebrate(true)}
                    className="rounded-full border border-yellow/40 bg-yellow/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow hover:bg-yellow/25"
                  >
                    Champion · {champion.TeamName}
                  </button>
                ) : null}
              </div>
              <h1 className="mt-3 font-display text-3xl text-white md:text-4xl">
                {tournament.Name}
              </h1>
              <p className="mt-2 text-body">
                {tournament.GameName} · {tournament.Date}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {canRegister ? (
                  <Button onClick={() => setTab("register")}>Register</Button>
                ) : null}
                {isRegistered ? (
                  <span className="inline-flex h-9 items-center rounded-full border border-primary/40 bg-primary/15 px-3 text-sm text-primary">
                    You&apos;re registered
                  </span>
                ) : null}
                <ShareTournamentButton
                  name={tournament.Name}
                  description={tournamentShareDescription(tournament)}
                  urlPath={`/tournament/${tournament.TournamentId}`}
                />
                {canAdminister ? (
                  <Link href={`/tournament/${tournament.TournamentId}/manage`}>
                    <Button variant="outline">Manage tournament</Button>
                  </Link>
                ) : null}
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
        {tab === "details" && (
          <Details tournament={tournament} champion={champion} />
        )}

        {tab === "table" && tournament.TournamentMode === "LEAGUE" && (
          <LeagueTable standings={standings} />
        )}

        {tab === "teams" &&
          (() => {
            const teamsContent = groupsCreated ? (
              groupStageDrawn ? (
                <div className="space-y-5">
                  {canSelectQualifiers ? (
                    <SelectQualifiers
                      tournamentId={tournament.TournamentId}
                      groups={groups}
                      sections={groupStandings}
                      advancePerGroup={tournament.AdvancePerGroup || 2}
                      initialQualifiers={qualifiers}
                      disqualifiedTeams={disqualifiedTeams}
                      canEdit={canAdminister}
                      allGroupPlayed={allGroupPlayed}
                      knockoutDrawn={knockoutDrawn}
                      onSaved={setQualifiers}
                    />
                  ) : null}
                  <GroupStandings
                    sections={groupStandings}
                    advancePerGroup={tournament.AdvancePerGroup || 2}
                    qualifiers={qualifiers}
                    manualSelection={canSelectQualifiers}
                    disqualifiedTeams={disqualifiedTeams}
                  />
                </div>
              ) : (
                <div>
                  <GroupsBoard
                    groups={groups}
                    participants={participants}
                    editable={canReshuffle}
                    onSave={saveGroups}
                  />
                  {canManage && !canReshuffle ? (
                    <p className="mt-4 text-center text-sm text-body">
                      Group reshuffle is locked to admins for this tournament.
                    </p>
                  ) : null}
                </div>
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
            );

            const bracketContent = (
              <div className="space-y-5">
                {canSelectQualifiers && qualifiers.length > 0 ? (
                  <QualifierList groups={groups} qualifiers={qualifiers} />
                ) : null}
                <KnockoutBracket
                  rounds={knockoutStages.map(([stage, matches]) => ({
                    stage,
                    matches,
                  }))}
                  groupNames={bracketGroupNames}
                  advancePerGroup={tournament.AdvancePerGroup || 2}
                  teamCount={isGroups ? 0 : participants.length}
                  isGroupMode={isGroups}
                  knockoutLive={knockoutDraws.length > 0}
                  qualifierReasons={qualifiers}
                />
              </div>
            );

            if (!(isKnockout || isGroups)) return teamsContent;

            return (
              <div className="flex flex-col gap-6">
                <SubTabs
                  options={[
                    {
                      id: "teams",
                      label: isGroups ? "Groups" : "Teams",
                    },
                    { id: "bracket", label: "Bracket" },
                  ]}
                  value={teamsPanel}
                  onChange={setTeamsPanel}
                />
                {teamsPanel === "teams" ? teamsContent : bracketContent}
              </div>
            );
          })()}

        {tab === "fixtures" &&
          (isGroups ? (
            <div className="space-y-4">
              {groupFixtureSections.length === 0 &&
              knockoutStages.length === 0 ? (
                <FixturesEmpty
                  started={started}
                  participantCount={participants.length}
                  onViewTeams={() => setTab("teams")}
                />
              ) : (
                <>
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
                            onUpdated={handleDrawUpdated}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupFixtureSections.map(([name, sectionDraws], index) => (
                    <FixtureGroupPanel
                      key={name}
                      title={name}
                      open={fixtureGroupIsOpen(name, index)}
                      onToggle={() => toggleFixtureGroup(name)}
                    >
                      {sectionDraws.map((d) => (
                        <Fixture
                          key={d.DrawId || d._id}
                          draw={d}
                          canManage={canManage}
                          onUpdated={handleDrawUpdated}
                        />
                      ))}
                    </FixtureGroupPanel>
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
                          onUpdated={handleDrawUpdated}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}

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

        {tab === "run" && canManage && (
          <div className="max-w-md">
            <TournamentStageControls
              tournament={tournament}
              initialDraws={draws}
              qualifiers={qualifiers}
              disqualifiedTeams={disqualifiedTeams}
              onDrawsChange={setDraws}
              onGroupsChange={setGroups}
              onStarted={() => setStarted(true)}
              onAfterAction={(kind) => {
                if (kind === "groups") setTab("teams");
                if (kind === "groupFixtures" || kind === "start") {
                  setTab(
                    tournament.TournamentMode === "LEAGUE"
                      ? "table"
                      : "fixtures",
                  );
                }
                if (kind === "advance" || kind === "knockoutNext") {
                  setTab("teams");
                  setTeamsPanel("bracket");
                }
              }}
            />
          </div>
        )}
      </section>
      {canManage ? (
        <NextStageModal
          prompt={stagePrompt}
          tournamentId={tournament.TournamentId}
          advancePerGroup={tournament.AdvancePerGroup || 2}
          onClose={() => setStagePrompt(null)}
          onDrawn={(nextDraws, kind) => {
            setDraws(nextDraws);
            setStarted(true);
            if (kind === "advance" || kind === "knockoutNext" || kind === "nextStage") {
              setTab("teams");
              setTeamsPanel("bracket");
            }
          }}
          onGoToGroups={() => {
            setTab("teams");
            setTeamsPanel("teams");
          }}
        />
      ) : null}
    </div>
  );
}

function FixtureGroupPanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between bg-primary-panel px-4 py-5 text-left"
      >
        <span className="font-display text-[23px] leading-none tracking-wide text-white">
          {title}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`h-5 w-5 shrink-0 text-white transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="flex flex-col items-center gap-8 px-2 py-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SubTabs({
  options,
  value,
  onChange,
}: {
  options: { id: TeamsPanel; label: string }[];
  value: TeamsPanel;
  onChange: (id: TeamsPanel) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Teams or bracket"
      className="mx-auto flex w-full max-w-sm rounded-full bg-surface-2 p-1"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`flex-1 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary text-[#04201e]"
                : "text-body hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
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

function GuestRegisterPrompt({ tournamentId }: { tournamentId: string }) {
  const redirect = `/signup?redirect=${encodeURIComponent(`/tournament/${tournamentId}?tab=register`)}`;

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

function resolveChampion(
  tournament: Tournament,
  draws: Draw[],
  participants: RegisterTournament[],
): Teams | undefined {
  const named = tournament.Winner;
  const raw = named?.TeamName?.trim()
    ? named
    : championFromDraws(tournament.TournamentMode, draws);
  if (!raw?.TeamName?.trim()) return undefined;
  if (raw.Icon) return raw;
  const match = participants.find((p) => p.TeamName === raw.TeamName);
  return match ? { ...raw, Icon: match.Icon, Players: match.Players } : raw;
}

function championFromDraws(
  mode: Tournament["TournamentMode"],
  draws: Draw[],
): Teams | undefined {
  if (mode === "BATTLEROYALE") {
    const br = [...draws]
      .filter((d) => d.BRTeams.length > 0 && d.Played && d.BRWinner)
      .sort((a, b) => b.Stage - a.Stage)[0];
    const team = br?.BRTeams.find((t) => t.TeamName === br.BRWinner);
    if (!team) return undefined;
    return {
      TeamName: team.TeamName,
      Players: team.Players,
      Icon: "",
      Points: 0,
      GoalsScored: 0,
      GoalsReceived: 0,
      GoalsDifference: 0,
    };
  }

  const knockout = draws.filter(
    (d) => !d.Group?.trim() && d.BRTeams.length === 0,
  );
  if (knockout.length === 0) return undefined;
  const maxStage = Math.max(...knockout.map((d) => d.Stage));
  const last = knockout.filter((d) => d.Stage === maxStage);
  if (last.length !== 1) return undefined;
  const final = last[0];
  if (!final.Played && !isKnockoutBye(final)) return undefined;
  if (final.Winner === "Team2") return final.Team2;
  if (final.Winner === "Team1" || isKnockoutBye(final)) return final.Team1;
  if (final.Team1Score > final.Team2Score) return final.Team1;
  if (final.Team2Score > final.Team1Score) return final.Team2;
  return undefined;
}

function Details({
  tournament,
  champion,
}: {
  tournament: Tournament;
  champion?: Teams;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Game", value: tournament.GameName },
    ...(champion?.TeamName
      ? [{ label: "Champion", value: champion.TeamName }]
      : []),
    { label: "Mode", value: tournament.TournamentMode },
    ...(tournament.TournamentMode === "LEAGUE"
      ? [
          {
            label: "Return leg",
            value: tournament.ReturnLeg ? "Yes" : "No",
          },
        ]
      : []),
    ...(tournament.TournamentMode === "GROUPS"
      ? [
          {
            label: "Advance per group",
            value: `${tournament.AdvancePerGroup || 2}`,
          },
          {
            label: "Qualification",
            value: tournament.OwnerCanSelectQualifiers
              ? "Table, with organiser pick if level on points"
              : "Top of each group table",
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
