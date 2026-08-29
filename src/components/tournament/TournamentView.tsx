"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useRouter } from "next/navigation";
import type { Tournament, GroupQualifier } from "@/lib/schemas/tournament";
import { placeLabel } from "@/lib/schemas/tournament";
import { formatMoney } from "@/lib/currency";
import { feePercent, splitEntry, sponsorDeposit } from "@/lib/fees";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { VerifiedName } from "@/components/ui/VerifiedName";
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
import { AlertCaptain } from "./AlertCaptain";
import { InviteSearch } from "./InviteSearch";
import { HostInvitePanel } from "./HostInvitePanel";
import { startSponsorCheckoutAction, listTournamentPayoutsAction } from "@/server/actions/paymentActions";
import type { PayoutRecord } from "@/lib/schemas/payment";
import { LeagueTable } from "./LeagueTable";
import { BrTable } from "./BrTable";
import { ShareTournamentButton } from "./ShareTournamentButton";
import {
  LatestAnnouncementBanner,
  TournamentAnnouncements,
} from "./TournamentAnnouncements";
import { TournamentStageControls } from "./TournamentStageControls";
import { NextStageModal } from "./NextStageModal";
import { SettingChangePanel } from "./SettingChangePanel";
import { WinnerCelebration } from "./WinnerCelebration";
import { resolvePodium } from "@/lib/podium";
import { usesLegacyShares } from "@/lib/prizeBoard";
import { isCaptain as isTeamCaptain } from "@/lib/captain";
import { runsOrg } from "@/lib/orgRoles";
import { computeLeagueStandings } from "@/lib/leagueStandings";
import { setTournamentGroupsAction } from "@/server/actions/tournamentActions";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { tournamentShareDescription } from "@/lib/tournamentShare";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
} from "@/lib/groupQualifiers";
import { isGroupDraw, isKnockoutDraw, isThirdPlaceDraw } from "@/lib/drawKind";
import {
  groupKnockoutTies,
  knockoutRoundsForBracket,
  knockoutRulesSummary,
  seriesKey,
} from "@/lib/knockoutSeries";
import { computeBrStandings } from "@/lib/brStandings";
import {
  checkInWindowOpen,
  registrationOpen,
} from "@/lib/tournamentWindow";
import { checkInForTournamentAction } from "@/server/actions/tournamentActions";
import {
  canJoinTournamentAction,
  listPendingTeamInvitesAction,
} from "@/server/actions/inviteActions";
import type { InviteTournament } from "@/lib/schemas/misc";
import { rosterSize } from "@/lib/schemas/common";
import {
  catalogSubtitle,
  GAMES_KIND,
  kindPublicLabel,
  kindUses,
  scoreColumnLabels,
} from "@/lib/catalog";
import {
  eventCity,
  formatVenueRow,
  locationLabel,
  mapPinsOf,
  venueLabel,
  venueMapsUrl,
  venuesOf,
} from "@/lib/venue";
import { VenueMap } from "./VenueMap";
import { ReportTournament } from "./ReportTournament";
import {
  nextStageAfterScore,
  type NextStagePrompt,
} from "@/lib/nextStagePrompt";
import { PageTour } from "@/components/help/PageTour";
import { TOURNAMENT_TOUR } from "@/components/help/tours";
import { useHelp } from "@/context/HelpContext";
import { helpTarget } from "@/lib/help";

type Tab =
  | "details"
  | "announcements"
  | "invite"
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
  checkout,
}: {
  tournament: Tournament;
  initialParticipants: RegisterTournament[];
  initialDraws: Draw[];
  initialTab?: Tab;
  checkout?: string;
}) {
  const { user, orgs } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { setPaused } = useHelp();

  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab === "register" && !tournament.Start) return "register";
    if (initialTab === "invite") return "invite";
    if (
      tournament.Start &&
      (tournament.TournamentMode === "MULTIPLAYER" ||
        tournament.TournamentMode === "GROUPS")
    ) {
      return "teams";
    }
    return tournament.Start ? "details" : "teams";
  });
  const [participants, setParticipants] =
    useState<RegisterTournament[]>(initialParticipants);
  const [draws, setDraws] = useState<Draw[]>(initialDraws);
  const [groups, setGroups] = useState(tournament.Groups ?? []);
  const [qualifiers, setQualifiers] = useState<GroupQualifier[]>(
    tournament.Qualifiers ?? [],
  );
  const [announcements, setAnnouncements] = useState(
    tournament.Announcements ?? [],
  );
  const disqualifiedTeams = tournament.DisqualifiedTeams ?? [];
  const [started, setStarted] = useState(tournament.Start);
  const [pendingChange, setPendingChange] = useState(
    tournament.PendingSettingChange,
  );
  const isKnockout = tournament.TournamentMode === "MULTIPLAYER";
  // Offered as one-tap picks when a host sets the location of a single match.
  const eventVenues = useMemo(() => venuesOf(tournament), [tournament]);
  const [teamsPanel, setTeamsPanel] = useState<TeamsPanel>(() => {
    if (tournament.TournamentMode === "MULTIPLAYER" && tournament.Start) {
      return "bracket";
    }
    if (tournament.TournamentMode === "GROUPS") {
      const groupDraws = initialDraws.filter(isGroupDraw);
      const groupStageComplete =
        groupDraws.length > 0 && groupDraws.every((d) => d.Played);
      const knockoutDrawn = initialDraws.some(isKnockoutDraw);
      return groupStageComplete && knockoutDrawn ? "bracket" : "teams";
    }
    return "teams";
  });
  const [stagePrompt, setStagePrompt] = useState<NextStagePrompt | null>(null);
  const podium = useMemo(
    () => resolvePodium(tournament, draws, participants),
    [tournament, draws, participants],
  );
  const champion = podium?.first;
  const championName = champion?.TeamName?.trim() ?? "";
  const [celebrate, setCelebrate] = useState(() => Boolean(championName));

  useEffect(() => {
    if (championName) setCelebrate(true);
  }, [championName]);

  useEffect(() => {
    setPaused(celebrate);
    return () => setPaused(false);
  }, [celebrate, setPaused]);

  useEffect(() => {
    setPendingChange(tournament.PendingSettingChange);
  }, [tournament.PendingSettingChange]);

  const isOwner = Boolean(user?.user_id && user.user_id === tournament.User_id);
  const isAdmin = user?.user_type === "ADMIN";
  const isManager = Boolean(
    user?.user_id && (tournament.Managers ?? []).includes(user.user_id),
  );
  // Whoever runs the host org runs its events; the server enforces the same rule.
  const runsHostOrg = runsOrg(orgs, tournament.OrgId);
  const canManage = isOwner || isAdmin || isManager || runsHostOrg;

  // Announce the checkout result exactly once, then strip the query param so a
  // refresh or a back-navigation does not replay it.
  const checkoutAnnounced = useRef(false);
  useEffect(() => {
    if (checkoutAnnounced.current) return;
    if (checkout !== "success" && checkout !== "cancel") return;
    checkoutAnnounced.current = true;
    if (checkout === "success") toast.success("Payment received");
    else toast.error("Payment cancelled");
    router.replace(`/tournament/${tournament.TournamentId}`, { scroll: false });
  }, [checkout, toast, router, tournament.TournamentId]);
  const canAdminister = isOwner || isAdmin || runsHostOrg;
  const canReshuffle =
    isAdmin || (canManage && tournament.OwnerCanReshuffleGroups);
  const isRegistered = Boolean(
    user?.user_id &&
      participants.some((p) =>
        (p.Players ?? []).some((pl) => pl.User_id === user.user_id),
      ),
  );
  const myTeam = participants.find((p) =>
    (p.Players ?? []).some((pl) => pl.User_id === user?.user_id),
  );
  const canCheckIn =
    Boolean(myTeam) &&
    tournament.CheckInRequired &&
    !myTeam?.CheckedIn &&
    checkInWindowOpen(tournament);
  const [checkingIn, setCheckingIn] = useState(false);
  const [canJoin, setCanJoin] = useState(
    tournament.TournamentType !== "PRIVATE",
  );
  const [pendingTeamInvites, setPendingTeamInvites] = useState<
    InviteTournament[]
  >([]);
  const canRegister = registrationOpen(tournament) && !isRegistered;
  const groupsCreated = groups.length > 0;
  const needed = rosterSize(tournament.Team, tournament.RosterCount);
  const catalogKindFlags = kindUses([], tournament.CatalogKind);
  const isCaptain = isTeamCaptain(myTeam, user?.user_id);
  const rosterSpotsLeft = myTeam
    ? Math.max(needed - (myTeam.Players ?? []).length, 0)
    : 0;
  /** Captain has registered but the team still has empty seats to fill. */
  const rosterIncomplete =
    isCaptain &&
    rosterSpotsLeft > 0 &&
    registrationOpen(tournament) &&
    !tournament.Start;

  const isGroups = tournament.TournamentMode === "GROUPS";

  useEffect(() => {
    if ((tab === "run" || tab === "invite") && !canManage) setTab("details");
  }, [tab, canManage]);

  useEffect(() => {
    if (!user) {
      setCanJoin(tournament.TournamentType !== "PRIVATE");
      return;
    }
    if (tournament.TournamentType !== "PRIVATE") {
      setCanJoin(true);
      return;
    }
    void canJoinTournamentAction(tournament.TournamentId).then((result) => {
      if (result.ok) setCanJoin(result.data);
    });
  }, [user, tournament.TournamentId, tournament.TournamentType]);

  useEffect(() => {
    if (!isCaptain || needed < 2) {
      setPendingTeamInvites([]);
      return;
    }
    void listPendingTeamInvitesAction(tournament.TournamentId).then(
      (result) => {
        if (result.ok) setPendingTeamInvites(result.data);
      },
    );
  }, [isCaptain, needed, tournament.TournamentId, participants.length]);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "details", label: "Details", show: true },
    {
      id: "announcements",
      label:
        announcements.length > 0
          ? `Announcements (${announcements.length})`
          : "Announcements",
      show: true,
    },
    { id: "invite", label: "Invite", show: canManage },
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
      show:
        tournament.TournamentMode === "LEAGUE" ||
        tournament.TournamentMode === "BATTLEROYALE",
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
    return computeLeagueStandings(
      teams,
      draws,
      tournament.PointSystem,
      tournament.TieBreaker,
    );
  }, [draws, participants, tournament.PointSystem, tournament.TournamentMode]);

  const hydratedDraws = useMemo(
    () => draws.map((d) => hydrateDrawIcons(d, teamIcons)),
    [draws, teamIcons],
  );

  const groupFixtureSections = useMemo(() => {
    const map = new Map<string, Draw[]>();
    for (const d of hydratedDraws) {
      if (!isGroupDraw(d)) continue;
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
      if (isGroupDraw(d) || d.BRTeams.length > 0) continue;
      const list = map.get(d.Stage) ?? [];
      list.push(d);
      map.set(d.Stage, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [hydratedDraws]);

  const seriesGamesById = useMemo(() => {
    const map = new Map<string, Draw[]>();
    for (const d of hydratedDraws) {
      const id = seriesKey(d);
      const list = map.get(id) ?? [];
      list.push(d);
      map.set(id, list);
    }
    return map;
  }, [hydratedDraws]);

  const bracketRounds = useMemo(
    () => knockoutRoundsForBracket(hydratedDraws, tournament.KnockoutFormat),
    [hydratedDraws, tournament.KnockoutFormat],
  );

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
        tournament.TieBreaker,
      ),
    }));
  }, [isGroups, groups, draws, tournament.PointSystem, tournament.TieBreaker]);

  const groupDraws = useMemo(
    () => draws.filter(isGroupDraw),
    [draws],
  );
  const knockoutDraws = useMemo(
    () => draws.filter(isKnockoutDraw),
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
        tournament.TieBreaker,
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
      knockoutFormat: tournament.KnockoutFormat,
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

  const cover = resolveIcon(tournament.icon, FALLBACKS.tournament);

  return (
    <div>
      <PageTour tour={TOURNAMENT_TOUR} enabled={!celebrate} />
      {celebrate && podium?.first.TeamName?.trim() ? (
        <WinnerCelebration
          podium={podium}
          tournamentName={tournament.Name}
          gameName={tournament.GameName}
          onClose={() => setCelebrate(false)}
        />
      ) : null}
      {tournament.Payment === "SPONSORED" && !tournament.PurseFunded ? (
        <div className="border-b border-yellow/30 bg-yellow/10 px-page py-4 text-center text-sm text-white">
          Prize pool is not funded yet. This event stays off the public list
          until the host pays the board plus a{" "}
          {feePercent(tournament.PlatformFeeBps)}% fee.
          {canManage ? (
            <FundPrizeButton tournamentId={tournament.TournamentId} />
          ) : null}
        </div>
      ) : null}
      <section className="relative overflow-hidden border-b border-primary/20 bg-primary-panel">
        <CatalogImage
          src={cover}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={90}
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/55 to-black/20" />
        <div className="relative z-1 mx-auto flex min-h-56 max-w-6xl flex-col justify-end px-page py-8 sm:min-h-80 sm:py-14 md:min-h-96 md:py-16">
          <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Tag payment={tournament.Payment} className="rounded-md" />
                {tournament.TournamentType === "PRIVATE" ? (
                  <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs text-white">
                    Invite only
                  </span>
                ) : null}
                <span className="rounded-full border border-primary/25 bg-black/50 px-3 py-1 text-xs text-white">
                  {tournament.TournamentMode}
                </span>
                {(tournament.CatalogKind || GAMES_KIND) !== GAMES_KIND ? (
                  <span className="rounded-full border border-primary/25 bg-black/50 px-3 py-1 text-xs text-white">
                    {kindPublicLabel(tournament.CatalogKind)}
                  </span>
                ) : null}
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
              <h1 className="mt-3 font-display text-3xl leading-none text-white sm:text-4xl md:text-5xl">
                {tournament.Name}
              </h1>
              <p
                className="mt-2 text-sm text-white/75 sm:text-base"
                suppressHydrationWarning
              >
                {[
                  catalogSubtitle(tournament),
                  tournament.Date,
                  venueLabel(tournament),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <div
                  className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3"
                  {...helpTarget("tour-actions")}
                >
                  {canRegister ? (
                    <Button
                      className="col-span-2 w-full sm:col-auto sm:w-auto"
                      onClick={() => setTab("register")}
                    >
                      Register
                    </Button>
                  ) : null}
                  {canCheckIn ? (
                    <Button
                      className="w-full sm:w-auto"
                      loading={checkingIn}
                      onClick={async () => {
                        setCheckingIn(true);
                        const result = await checkInForTournamentAction(
                          tournament.TournamentId,
                        );
                        setCheckingIn(false);
                        if (result.ok) {
                          setParticipants((prev) =>
                            prev.map((p) =>
                              p.RegisterTournamentId ===
                              result.data.RegisterTournamentId
                                ? result.data
                                : p,
                            ),
                          );
                          toast.success("You're checked in");
                        } else {
                          toast.error(result.error);
                        }
                      }}
                    >
                      Check in
                    </Button>
                  ) : null}
                  <ShareTournamentButton
                    className="w-full sm:w-auto"
                    name={tournament.Name}
                    description={tournamentShareDescription(tournament)}
                    urlPath={`/tournament/${tournament.TournamentId}`}
                  />
                  {canAdminister ? (
                    <Link
                      href={`/tournament/${tournament.TournamentId}/manage`}
                      className="w-full sm:w-auto"
                    >
                      <Button variant="outline" className="w-full">
                        Manage
                        <span className="hidden sm:inline"> tournament</span>
                      </Button>
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isRegistered ? (
                    <span className="inline-flex h-8 items-center rounded-lg border border-primary/40 bg-black/50 px-2.5 text-xs text-primary">
                      {myTeam?.CheckedIn
                        ? "Checked in"
                        : "You're registered"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setTab("teams")}
                    className="inline-flex h-8 items-center rounded-lg border border-white/15 bg-black/50 px-2.5 text-xs text-white hover:border-primary/50"
                  >
                    <span className="sm:hidden">
                      {participants.length}/{tournament.TournamentSize} teams
                    </span>
                    <span className="hidden sm:inline">
                      {participants.length} of {tournament.TournamentSize}{" "}
                      teams registered
                    </span>
                  </button>
                  {tournament.OrgId && tournament.OrgName && (
                    <Link
                      href={`/org/${tournament.OrgId}`}
                      className="inline-flex h-8 max-w-full items-center gap-2 rounded-lg border border-white/15 bg-black/50 px-2.5 text-xs text-white hover:border-primary/50"
                    >
                      {tournament.OrgIcon ? (
                        <Image
                          src={tournament.OrgIcon}
                          alt=""
                          width={20}
                          height={20}
                          className="h-4 w-4 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="inline-flex min-w-0 items-center gap-1 truncate">
                        Hosted by{" "}
                        <VerifiedName
                          name={tournament.OrgName}
                          verified={tournament.OrgVerified}
                        />
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
      </section>

      {pendingChange && (isRegistered || canAdminister) ? (
        <div className="border-b border-primary/25 bg-nav">
          <div className="mx-auto max-w-6xl px-page py-4">
            <SettingChangePanel
              tournamentId={tournament.TournamentId}
              change={pendingChange}
              currentUserId={user?.user_id}
              canApply={canAdminister}
              onUpdated={(next) => {
                setPendingChange(next.PendingSettingChange);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}

      {announcements[0] && tab !== "announcements" ? (
        <LatestAnnouncementBanner
          announcement={announcements[0]}
          onOpen={() => setTab("announcements")}
        />
      ) : null}

      {/* A half-empty roster is the single most common reason a captain's team
          never makes it to the draw, so this sits above the tabs rather than
          buried under the team list. */}
      {rosterIncomplete ? (
        <button
          type="button"
          onClick={() => {
            setTab("teams");
            if (isKnockout || isGroups) setTeamsPanel("teams");
          }}
          className="w-full border-b border-yellow/40 bg-yellow/15 text-left transition-colors hover:bg-yellow/25"
        >
          <span className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-page py-3.5">
            <span className="shrink-0 rounded-full bg-yellow/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow">
              Captain
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                {myTeam?.TeamName} needs {rosterSpotsLeft} more player
                {rosterSpotsLeft === 1 ? "" : "s"}
              </span>
              <span className="mt-0.5 block text-xs text-body">
                {pendingTeamInvites.length > 0
                  ? `${pendingTeamInvites.length} invite${pendingTeamInvites.length === 1 ? "" : "s"} still waiting to be accepted. `
                  : ""}
                Teammates only join once they accept, so invite them before the
                draw.
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-yellow px-4 py-2 text-sm font-semibold text-[#221a00]">
              Invite players
            </span>
          </span>
        </button>
      ) : null}

      <div className="border-b border-surface-2 bg-nav">
        <div
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-page"
          {...helpTarget("tour-tabs")}
        >
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

      <section className="mx-auto max-w-6xl px-page py-10">
        {tab === "details" && (
          <Details tournament={tournament} champion={champion} />
        )}

        {tab === "announcements" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-5 font-display text-2xl text-white">
              Announcements
            </h2>
            <TournamentAnnouncements
              tournamentId={tournament.TournamentId}
              announcements={announcements}
              canPost={canManage && !championName}
              closed={Boolean(championName)}
              onChange={setAnnouncements}
            />
          </div>
        )}

        {tab === "invite" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-5 font-display text-2xl text-white">Invite</h2>
            <HostInvitePanel
              tournamentId={tournament.TournamentId}
              tournamentType={tournament.TournamentType}
              started={started}
              registeredCount={participants.length}
              tournamentSize={tournament.TournamentSize}
              excludeIds={participants.flatMap((p) =>
                (p.Players ?? []).map((pl) => pl.User_id),
              )}
            />
          </div>
        )}

        {tab === "table" && tournament.TournamentMode === "LEAGUE" && (
          <LeagueTable
            standings={standings}
            scoreLabel={tournament.ScoreLabel}
            allowDraw={tournament.AllowDraw !== false}
          />
        )}
        {tab === "table" && tournament.TournamentMode === "BATTLEROYALE" && (
          <BrTable
            standings={computeBrStandings(draws, {
              PlacementPoints: tournament.BrPlacementPoints,
              KillPoints: tournament.BrKillPoints,
              FirstBloodPoints: tournament.BrFirstBloodPoints,
            })}
          />
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
                    scoreLabel={tournament.ScoreLabel}
                    allowDraw={tournament.AllowDraw !== false}
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
              <div className="py-2">
                {participants.length === 0 ? (
                  <div className="rounded-2xl border border-primary/25 bg-primary-panel py-16 text-center text-body">
                    No registered teams yet
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {participants.length} registered
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {participants.map((p) => (
                        <TeamCard
                          key={p.RegisterTournamentId || p._id}
                          team={p}
                          seats={needed}
                          checkInRequired={tournament.CheckInRequired}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );

            const bracketContent = (
              <div className="space-y-5">
                {canSelectQualifiers && qualifiers.length > 0 ? (
                  <QualifierList groups={groups} qualifiers={qualifiers} />
                ) : null}
                <KnockoutBracket
                  rounds={bracketRounds}
                  groupNames={bracketGroupNames}
                  advancePerGroup={tournament.AdvancePerGroup || 2}
                  teamCount={isGroups ? 0 : participants.length}
                  isGroupMode={isGroups}
                  knockoutLive={knockoutDraws.length > 0}
                  qualifierReasons={qualifiers}
                />
              </div>
            );

            const invitePanels =
              registrationOpen(tournament) &&
              !started &&
              isCaptain &&
              (rosterSpotsLeft > 0 || pendingTeamInvites.length > 0) ? (
                <div className="mx-auto max-w-lg">
                  <div
                    className={`rounded-xl border p-5 ${
                      rosterSpotsLeft > 0
                        ? "border-yellow/40 bg-yellow/10"
                        : "border-primary/25 bg-surface"
                    }`}
                  >
                    <h3
                      className={`mb-2 font-display text-xl ${
                        rosterSpotsLeft > 0 ? "text-yellow" : "text-white"
                      }`}
                    >
                      {rosterSpotsLeft > 0
                        ? `Invite ${rosterSpotsLeft} more player${rosterSpotsLeft === 1 ? "" : "s"}`
                        : "Invite teammates"}
                    </h3>
                    {rosterSpotsLeft > 0 ? (
                      <>
                        <p className="mb-3 text-sm text-body">
                          {myTeam?.TeamName} has {rosterSpotsLeft} of {needed}{" "}
                          seat{rosterSpotsLeft === 1 ? "" : "s"} open. Players
                          are not on your team until they accept, so invite
                          early. The host capped teams at {needed}, and one
                          player cannot join two teams.
                          {tournament.Payment === "PAID"
                            ? " You already paid for the whole team, so the players you invite join free."
                            : ""}
                        </p>
                        <InviteSearch
                          tournamentId={tournament.TournamentId}
                          kind="TEAM"
                          excludeIds={participants.flatMap((p) =>
                            (p.Players ?? []).map((pl) => pl.User_id),
                          )}
                          onSent={(invite) =>
                            setPendingTeamInvites((prev) => [invite, ...prev])
                          }
                        />
                      </>
                    ) : (
                      <p className="mb-3 text-sm text-body">
                        This roster is full ({needed} player
                        {needed === 1 ? "" : "s"}). You can&apos;t send more
                        invites. Outstanding invites will be rejected if someone
                        tries to accept.
                      </p>
                    )}
                    {pendingTeamInvites.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-sm text-body">
                        {pendingTeamInvites.map((invite) => (
                          <li key={invite.invite_id}>
                            Waiting for @
                            {invite.invitee_name || "player"} to accept
                            {rosterSpotsLeft === 0
                              ? " · will be rejected (roster full)"
                              : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null;

            if (!(isKnockout || isGroups)) {
              return (
                <div className="space-y-8">
                  {invitePanels}
                  {teamsContent}
                </div>
              );
            }

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
                {teamsPanel === "teams" ? (
                  <div className="space-y-8">
                    {invitePanels}
                    {teamsContent}
                  </div>
                ) : (
                  bracketContent
                )}
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
                  {knockoutStages.map(([stage, stageDraws]) => {
                    const cupDraws = stageDraws.filter(
                      (d) => !isThirdPlaceDraw(d),
                    );
                    const thirdDraws = stageDraws.filter(isThirdPlaceDraw);
                    return (
                    <div key={`ko-${stage}`}>
                      {cupDraws.length > 0 ? (
                        <>
                      <div className="mb-8 bg-primary-panel px-4 py-5 text-center font-display text-[23px] leading-none tracking-wide text-white">
                        {roundLabel(
                          groupKnockoutTies(cupDraws).length ||
                            cupDraws.length,
                          stage,
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-8">
                        {cupDraws.map((d) => (
                          <Fixture
                            eventVenues={eventVenues}
                            key={d.DrawId || d._id}
                            draw={d}
                            canManage={canManage}
                            onUpdated={handleDrawUpdated}
                            knockoutFormat={tournament.KnockoutFormat}
                            seriesGames={
                              seriesGamesById.get(seriesKey(d)) ?? [d]
                            }
                            hostPicksLevel={knockoutHostPicks(
                              tournament.TournamentMode,
                              d,
                            )}
                          />
                        ))}
                      </div>
                        </>
                      ) : null}
                      {thirdDraws.length > 0 ? (
                        <>
                          <div className="mb-8 bg-primary-panel px-4 py-5 text-center font-display text-[23px] leading-none tracking-wide text-white">
                            THIRD PLACE
                          </div>
                          <div className="flex flex-col items-center gap-8">
                            {thirdDraws.map((d) => (
                              <Fixture
                            eventVenues={eventVenues}
                                key={d.DrawId || d._id}
                                draw={d}
                                canManage={canManage}
                                onUpdated={handleDrawUpdated}
                                knockoutFormat={tournament.KnockoutFormat}
                                seriesGames={
                                  seriesGamesById.get(seriesKey(d)) ?? [d]
                                }
                                hostPicksLevel
                              />
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                    );
                  })}
                  {groupFixtureSections.map(([name, sectionDraws], index) => (
                    <FixtureGroupPanel
                      key={name}
                      title={name}
                      open={fixtureGroupIsOpen(name, index)}
                      onToggle={() => toggleFixtureGroup(name)}
                    >
                      {sectionDraws.map((d) => (
                        <Fixture
                            eventVenues={eventVenues}
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
                        tournament.TournamentMode === "MULTIPLAYER"
                          ? groupKnockoutTies(stageDraws).length ||
                            stageDraws.length
                          : stageDraws.length,
                        stage,
                        tournament.TournamentMode,
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-8">
                        {stageDraws.map((d) => (
                          <Fixture
                            eventVenues={eventVenues}
                            key={d.DrawId || d._id}
                            draw={d}
                            canManage={canManage}
                            onUpdated={handleDrawUpdated}
                            knockoutFormat={
                              tournament.TournamentMode === "MULTIPLAYER"
                                ? tournament.KnockoutFormat
                                : undefined
                            }
                            seriesGames={
                              tournament.TournamentMode === "MULTIPLAYER"
                                ? seriesGamesById.get(seriesKey(d)) ?? [d]
                                : undefined
                            }
                            hostPicksLevel={knockoutHostPicks(
                              tournament.TournamentMode,
                              d,
                            )}
                          />
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}

        {tab === "register" &&
          (!registrationOpen(tournament) ? (
            <div className="mx-auto max-w-lg rounded-xl border border-surface-2 bg-surface p-8 text-center">
              <h3 className="text-xl font-semibold text-white">
                Registration closed
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-body">
                {started
                  ? "This tournament has already started, so new teams cannot join."
                  : "The registration deadline has passed."}
              </p>
            </div>
          ) : user &&
            tournament.TournamentType === "PRIVATE" &&
            !canJoin &&
            !canManage ? (
            <div className="mx-auto max-w-lg rounded-xl border border-surface-2 bg-surface p-8 text-center">
              <h3 className="text-xl font-semibold text-white">
                Invite only
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-body">
                You can join this tournament only after the host invites you.
                Accept the invite from Notifications, then come back to
                register.
              </p>
              <Link
                href="/notifications"
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                Open notifications
              </Link>
            </div>
          ) : user ? (
            <div className="flex max-w-lg flex-col gap-5">
              <RegisterTeam
                tournamentId={tournament.TournamentId}
                teamSize={tournament.Team}
                rosterCount={tournament.RosterCount}
                usesInGameName={catalogKindFlags.usesInGameName}
                payment={tournament.Payment}
                currency={tournament.Currency}
                entryFee={tournament.RegistrationAmount}
                feeBps={tournament.PlatformFeeBps}
                onRegistered={(reg) => {
                  setParticipants((prev) => [...prev, reg]);
                  toast.success("Team registered");
                  setTab("teams");
                }}
              />
              <AlertCaptain tournamentId={tournament.TournamentId} />
            </div>
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

function knockoutHostPicks(
  mode: Tournament["TournamentMode"],
  draw: Draw,
): boolean {
  if (mode === "MULTIPLAYER") return true;
  if (mode === "GROUPS") {
    return isKnockoutDraw(draw) || isThirdPlaceDraw(draw);
  }
  return false;
}

function Details({
  tournament,
  champion,
}: {
  tournament: Tournament;
  champion?: Teams;
}) {
  const scoreCols = scoreColumnLabels(tournament.ScoreLabel);
  const kindLabel = kindPublicLabel(tournament.CatalogKind);
  const rows: { label: string; value: string; href?: string }[] = [
    {
      label: kindLabel === "Sports" ? "Sport" : kindLabel === "Games" ? "Game" : kindLabel,
      value: catalogSubtitle(tournament),
    },
    ...(champion?.TeamName
      ? [{ label: "Champion", value: champion.TeamName }]
      : []),
    { label: "Mode", value: tournament.TournamentMode },
    ...(tournament.TournamentMode === "LEAGUE" ||
    tournament.TournamentMode === "GROUPS"
      ? [
          {
            label: "Return leg",
            value: tournament.ReturnLeg ? "Home and away" : "Single round",
          },
          {
            label: "Points",
            value:
              tournament.AllowDraw === false
                ? `${tournament.PointSystem?.Win ?? 3} for a win`
                : `${tournament.PointSystem?.Win ?? 3} for a win, ${
                    tournament.PointSystem?.Draw ?? 1
                  } for a draw`,
          },
          {
            label: "Tie-break",
            value:
              tournament.TieBreaker === "HEAD_TO_HEAD"
                ? "Head to head"
                : scoreCols.difference,
          },
        ]
      : []),
    ...(tournament.TournamentMode === "GROUPS"
      ? [
          {
            label: "Groups",
            value:
              tournament.GroupCount > 0
                ? String(tournament.GroupCount)
                : "Auto",
          },
          {
            label: "Advance per group",
            value: `${tournament.AdvancePerGroup || 2}`,
          },
          {
            label: "Qualification",
            value: tournament.OwnerCanSelectQualifiers
              ? "Table, with host pick if level on points"
              : "Top of each group table",
          },
        ]
      : []),
    ...(tournament.TournamentMode === "MULTIPLAYER" ||
    tournament.TournamentMode === "GROUPS"
      ? [
          {
            label: "Knockout",
            value: knockoutRulesSummary({
              format: tournament.KnockoutFormat,
              finalsUseSeries: tournament.KnockoutFinalsSeries,
              thirdPlace: tournament.ThirdPlace,
            }),
          },
        ]
      : []),
    ...(tournament.TournamentMode === "BATTLEROYALE"
      ? [
          {
            label: "Lobbies",
            value: String(tournament.BrLobbyCount || 1),
          },
          {
            label: "Kill points",
            value: String(tournament.BrKillPoints ?? 1),
          },
        ]
      : []),
    ...(tournament.RegistrationDeadline
      ? [
          {
            label: "Registration closes",
            value: tournament.RegistrationDeadline,
          },
        ]
      : []),
    ...(tournament.CheckInRequired
      ? [{ label: "Check-in", value: "Required" }]
      : []),
    { label: "Team size", value: tournament.RosterCount > 0
      ? String(tournament.RosterCount)
      : tournament.Team },
    {
      label: "Who can register",
      value:
        tournament.TournamentType === "PRIVATE"
          ? "Invite only"
          : "Anyone can join",
    },
    {
      label: "Payment",
      value:
        tournament.Payment === "PAID"
          ? "Paid"
          : tournament.Payment === "SPONSORED"
            ? "Sponsored"
            : "Free",
    },
    { label: "Draw", value: tournament.Shuffle },
    { label: "Size", value: `${tournament.TournamentSize} teams` },
    { label: "Date", value: tournament.Date },
    ...(locationLabel(tournament)
      ? [
          {
            label: "Location",
            value: locationLabel(tournament),
            href: venueMapsUrl({
              country: tournament.VenueCountry,
              location: eventCity(tournament),
              lat: tournament.VenueLat,
              lng: tournament.VenueLng,
            }),
          },
        ]
      : []),
    ...venuesOf(tournament).map((row, index, all) => ({
      label: all.length > 1 ? `Venue ${index + 1}` : "Venue",
      value: formatVenueRow(row),
      href: venueMapsUrl(row),
    })),
    ...(tournament.Platform
      ? [{ label: "Platform", value: tournament.Platform }]
      : []),
    ...(tournament.Payment === "PAID"
      ? [
          {
            label: "Platform fee",
            value: `${feePercent(tournament.PlatformFeeBps)}% of each entry (Gamelyd; not in the pot)`,
          },
          {
            label: "Entry (player pays)",
            value: formatMoney(
              tournament.RegistrationAmount,
              tournament.Currency,
            ),
          },
          {
            label: "Per seat to pot",
            value: formatMoney(
              splitEntry(
                tournament.RegistrationAmount,
                tournament.PlatformFeeBps,
              ).net,
              tournament.Currency,
            ),
          },
          {
            label: "Per seat to Gamelyd",
            value: formatMoney(
              splitEntry(
                tournament.RegistrationAmount,
                tournament.PlatformFeeBps,
              ).fee,
              tournament.Currency,
            ),
          },
          {
            label: "Net prize pot now",
            value: formatMoney(tournament.PotNet, tournament.Currency),
          },
        ]
      : []),
    ...(tournament.Payment === "SPONSORED"
      ? [
          {
            label: "Platform fee",
            value: `${feePercent(tournament.PlatformFeeBps)}% on top of the prize board (paid by the host)`,
          },
          {
            label: "Published prizes",
            value: tournament.Amount
              ? formatMoney(tournament.Amount, tournament.Currency)
              : "-",
          },
          {
            label: "Host deposit (board + fee)",
            value: tournament.Amount
              ? formatMoney(
                  sponsorDeposit(
                    tournament.Amount,
                    tournament.PlatformFeeBps,
                  ).gross,
                  tournament.Currency,
                )
              : "-",
          },
        ]
      : []),
    ...(tournament.FeeCollected
      ? [
          {
            label: "Fees collected so far",
            value: formatMoney(tournament.FeeCollected, tournament.Currency),
          },
        ]
      : []),
    ...(tournament.Prizes ?? []).map((prize) => ({
      label: `${placeLabel(prize.Position)} prize`,
      // Paid events now advertise cash; only those created under the old
      // percentage split still describe themselves that way.
      value:
        tournament.Payment === "PAID" && usesLegacyShares(tournament.Prizes)
          ? `${prize.Share || 0}% of net pot`
          : formatMoney(prize.Amount, tournament.Currency),
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5" {...helpTarget("tour-details")}>
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
              <dd className="mt-0.5 font-medium text-white">
                {r.href ? (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <VenueMap pins={mapPinsOf(tournament)} />
      <div className="flex justify-center pt-2">
        <ReportTournament
          tournamentId={tournament.TournamentId}
          tournamentName={tournament.Name}
        />
      </div>
      {tournament.Payment !== "FREE" ? (
        <PrizeSettlement tournamentId={tournament.TournamentId} />
      ) : null}
    </div>
  );
}

function FundPrizeButton({ tournamentId }: { tournamentId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <div className="mt-3">
      <Button
        type="button"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          const result = await startSponsorCheckoutAction(tournamentId);
          setLoading(false);
          if (result.ok) {
            window.location.href = result.data.checkoutUrl;
            return;
          }
          toast.error(result.error);
        }}
      >
        Fund prize pool
      </Button>
    </div>
  );
}

function PrizeSettlement({ tournamentId }: { tournamentId: string }) {
  const [rows, setRows] = useState<PayoutRecord[]>([]);
  useEffect(() => {
    void listTournamentPayoutsAction(tournamentId).then((result) => {
      if (result.ok) setRows(result.data);
    });
  }, [tournamentId]);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">
        Prize settlement
      </h3>
      <p className="mb-3 text-sm text-body">
        Held until the event ends. Each place is paid to that team&apos;s
        captain, using the payout account on their profile.
      </p>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.payout_id}
            className="flex justify-between gap-3 text-white"
          >
            <span>
              {row.place > 0 ? `${placeLabel(row.place)} · ` : ""}
              {row.teamName}{" "}
              <span className="text-body">({row.status})</span>
            </span>
            <span>{formatMoney(row.amount, row.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
