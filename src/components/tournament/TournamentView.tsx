"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useRouter } from "next/navigation";
import type { Tournament, GroupQualifier } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { PaymentTag, Tag } from "@/components/ui/Tag";
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
import { JoinRequestsPanel } from "./JoinRequestsPanel";
import { RatingPanel } from "@/components/rating/RatingPanel";
import { AlertCaptain } from "./AlertCaptain";
import { InviteSearch } from "./InviteSearch";
import { HostInvitePanel } from "./HostInvitePanel";
import { LeagueTable } from "./LeagueTable";
import { BrTable } from "./BrTable";
import { ShareTournamentButton } from "./ShareTournamentButton";
import { DownloadViewButton } from "./DownloadViewButton";
import {
  buildMyMatches,
  buildUnplayed,
  exportPlan,
  viewForTeamsPanel,
  type ExportView,
} from "@/lib/exportViews";
import { MatchListModal } from "./MatchListModal";
import {
  LatestAnnouncementBanner,
  TournamentAnnouncements,
} from "./TournamentAnnouncements";
import { TournamentStageControls } from "./TournamentStageControls";
import { NextStageModal } from "./NextStageModal";
import { Confirm } from "@/components/ui/Confirm";
import { Markdown } from "@/components/ui/Markdown";
import { formatMoney } from "@/lib/currency";
import { tzCityLabel } from "@/lib/timezone";
import { SettingChangePanel } from "./SettingChangePanel";
import { WinnerCelebration } from "./WinnerCelebration";
import { resolvePodium } from "@/lib/podium";
import { isCaptain as isTeamCaptain } from "@/lib/captain";
import { runsOrg } from "@/lib/orgRoles";
import { computeLeagueStandings, standingToTeam } from "@/lib/leagueStandings";
import { setTournamentGroupsAction } from "@/server/actions/tournamentActions";
import { hydrateDrawIcons, iconMapFromTeams } from "@/lib/teamIcons";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { tournamentShareDescription } from "@/lib/tournamentShare";
import {
  asDisqualifiedSet,
  groupQualifiersComplete,
  resolvedQualifyingNames,
} from "@/lib/groupQualifiers";
import { placeName, isKnockoutBye } from "@/lib/knockoutSeed";
import { isGroupDraw, isKnockoutDraw, isThirdPlaceDraw } from "@/lib/drawKind";
import { isFixtureStageLocked } from "@/lib/fixtureLock";
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

/** Draw ids where the given team (by name or a player's user id) competes. */
function drawIdsForTeam(
  draws: Draw[],
  teamName: string,
  userId: string,
): Set<string> {
  const ids = new Set<string>();
  if (!teamName && !userId) return ids;
  const isMine = (t?: {
    TeamName?: string;
    Players?: { User_id?: string }[];
  }) =>
    Boolean(t) &&
    ((teamName !== "" && t?.TeamName === teamName) ||
      (userId !== "" &&
        (t?.Players ?? []).some((pl) => pl.User_id === userId)));
  for (const d of draws) {
    if (
      isMine(d.Team1) ||
      isMine(d.Team2) ||
      (d.BRTeams ?? []).some((t) => isMine(t))
    ) {
      ids.add(d.DrawId);
    }
  }
  return ids;
}

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
  const disqualifiedTeams = useMemo(
    () => tournament.DisqualifiedTeams ?? [],
    [tournament.DisqualifiedTeams],
  );
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
  // Once a champion is decided the event is frozen: view-only, no more edits.
  const isFinished = Boolean(championName);

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
  const tzLabel = tzCityLabel(tournament.TimeZone);
  const myTeamName = myTeam?.TeamName ?? "";
  const myUserId = user?.user_id ?? "";
  // Draw ids the signed-in user's team plays in, so their fixtures can be
  // highlighted and jumped to. Left un-memoized so the React Compiler owns it.
  const mineDrawIds = drawIdsForTeam(draws, myTeamName, myUserId);
  const hasMyFixtures = mineDrawIds.size > 0;
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
  // Invited to a private event and not yet registered: nudge them once.
  const isInvited = Boolean(
    user &&
      tournament.TournamentType === "PRIVATE" &&
      canJoin &&
      !isRegistered &&
      !canManage &&
      registrationOpen(tournament),
  );
  const [invitePromptOpen, setInvitePromptOpen] = useState(false);
  const invitePromptShown = useRef(false);
  useEffect(() => {
    if (isInvited && !invitePromptShown.current) {
      invitePromptShown.current = true;
      setInvitePromptOpen(true);
    }
  }, [isInvited]);
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

  // A manager should not have to hunt in the Run tab to know it is time for the
  // next step. This surfaces the prompt up top, with a reminder to sanity-check
  // the roster before a draw locks it in.
  const stageNudge = useMemo((): { title: string; body: string } | null => {
    if (!canManage || champion?.TeamName?.trim()) return null;
    const groupPlayed = draws.filter(isGroupDraw);
    const knockoutPlayed = draws.filter(isKnockoutDraw);

    if (!started) {
      if (participants.length < 2) return null;
      const full =
        tournament.TournamentSize > 0 &&
        participants.length >= tournament.TournamentSize;
      if (!full && registrationOpen(tournament)) return null;
      return {
        title: full ? "Registration is full" : "Registration has closed",
        body: isGroups
          ? "Check the registered teams are correct, then create your groups from the Run tab. The draw locks the roster in."
          : "Check the registered teams are correct, then draw the fixtures from the Run tab. The draw locks the roster in.",
      };
    }
    if (
      isGroups &&
      groupPlayed.length > 0 &&
      groupPlayed.every((d) => d.Played) &&
      knockoutPlayed.length === 0
    ) {
      return {
        title: "Group stage complete",
        body: "Every group match has a result. Advance to the knockout from the Run tab.",
      };
    }
    if (
      (isKnockout || isGroups) &&
      knockoutPlayed.length > 0 &&
      knockoutPlayed.every((d) => d.Played)
    ) {
      return {
        title: "This round is complete",
        body: "Every match in this round has a result. If more rounds remain, draw the next one from the Run tab.",
      };
    }
    return null;
  }, [canManage, champion, draws, started, participants, tournament, isGroups, isKnockout]);

  useEffect(() => {
    if ((tab === "run" || tab === "invite") && (!canManage || isFinished)) {
      setTab("details");
    }
  }, [tab, canManage, isFinished]);

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
    { id: "invite", label: "Invite", show: canManage && !isFinished },
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
    { id: "run", label: "Run", show: canManage && !isFinished },
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

  // Which downloads exist, and how many images each needs.
  const exportViews = useMemo(
    () => exportPlan(tournament, draws, participants),
    [tournament, draws, participants],
  );
  const [previewQualifiers, setPreviewQualifiers] = useState(false);
  const [showUnplayed, setShowUnplayed] = useState(false);
  const [showMine, setShowMine] = useState(false);

  const exportable = useMemo(
    () => new Set(Object.keys(exportViews) as ExportView[]),
    [exportViews],
  );

  const downloadButton = (view: ExportView, className = "", compact = false) =>
    exportViews[view] ? (
      <DownloadViewButton
        tournamentId={tournament.TournamentId}
        tournamentName={tournament.Name}
        view={view}
        pages={exportViews[view]}
        className={className}
        compact={compact}
      />
    ) : null;

  // The match a host most likely wants to score next: the earliest unplayed one.
  const nextToScore = useMemo(
    () =>
      [...draws]
        .filter(
          (d) => !d.Played && !isKnockoutBye(d) && (d.BRTeams ?? []).length === 0,
        )
        .sort((a, b) => a.Stage - b.Stage)[0] ?? null,
    [draws],
  );
  const canUpdateScores = canManage && !isFinished && draws.length > 0;

  /** Take the host to the fixtures, scrolled to the next match to score. */
  const goUpdateScores = () => {
    setTab("fixtures");
    const id = nextToScore?.DrawId;
    window.setTimeout(() => {
      const target = id ? document.getElementById(`fixture-${id}`) : null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 80);
  };

  const hydratedDraws = useMemo(
    () => draws.map((d) => hydrateDrawIcons(d, teamIcons)),
    [draws, teamIcons],
  );

  const unplayedSections = useMemo(
    () => buildUnplayed(tournament, hydratedDraws),
    [tournament, hydratedDraws],
  );
  const mySections = useMemo(
    () => buildMyMatches(tournament, hydratedDraws, mineDrawIds),
    [tournament, hydratedDraws, mineDrawIds],
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

  // Jump from a group's standings straight to that group's fixture panel.
  const pendingGroupScroll = useRef<string | null>(null);
  const findGroupPanel = (name: string) =>
    Array.from(document.querySelectorAll("[data-group-panel]")).find(
      (el) => el.getAttribute("data-group-panel") === name,
    );
  useEffect(() => {
    const name = pendingGroupScroll.current;
    if (!name) return;
    const el = findGroupPanel(name);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingGroupScroll.current = null;
    }
  });

  const viewGroupFixtures = (name: string) => {
    setTab("fixtures");
    const openNow = groupFixtureSections
      .filter(([n], index) => fixtureGroupIsOpen(n, index))
      .map(([n]) => n);
    setOpenFixtureGroups(Array.from(new Set([...openNow, name])));
    pendingGroupScroll.current = name;
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

  /**
   * Which team currently holds each placeholder place, keyed by the label the
   * bracket uses for it ("Group A winner").
   *
   * The bracket keeps its full shape and these only fill the slots, so a place
   * nobody holds yet stays a placeholder. Qualifying order comes from the same
   * helper the server uses at draw time, including the host's tie-break picks
   * and any disqualifications, so the preview cannot show a team through that
   * the real draw would leave out.
   */
  const qualifierPreview = useMemo(() => {
    const filled = new Map<string, Teams>();
    if (!isGroups || groupStandings.length === 0) return filled;
    const advance = tournament.AdvancePerGroup || 2;
    const out = asDisqualifiedSet(disqualifiedTeams);

    for (const section of groupStandings) {
      // The bracket trims group names before it builds its labels, so the keys
      // have to be trimmed too or every lookup quietly misses.
      const label = section.name.trim();
      const names = resolvedQualifyingNames(
        section.standings,
        section.name,
        advance,
        qualifiers,
        out,
        tournament.OwnerCanSelectQualifiers,
      );
      names.forEach((name, index) => {
        const row = section.standings.find((s) => s.TeamName === name);
        if (!row) return;
        const team = standingToTeam(row);
        filled.set(`${label} ${placeName(index + 1)}`, {
          ...team,
          // Group rows often carry no crest; the registrations do.
          Icon: team.Icon || teamIcons.get(name.trim().toLowerCase()) || "",
        });
      });
    }
    return filled;
  }, [
    isGroups,
    groupStandings,
    qualifiers,
    disqualifiedTeams,
    teamIcons,
    tournament.AdvancePerGroup,
    tournament.OwnerCanSelectQualifiers,
  ]);

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

  // The one action the host should take right now to get the tournament moving,
  // surfaced as an automatic pop-up. Only the two "start" moments: kicking the
  // event off once the field is set, and drawing group fixtures after groups.
  const startPrompt = useMemo((): {
    step: string;
    title: string;
    body: string;
    cta: string;
  } | null => {
    if (!canManage || champion?.TeamName?.trim()) return null;
    // Groups are drawn but their fixtures are not: prompt to draw them.
    if (isGroups && groupsCreated && !groupStageDrawn) {
      return {
        step: "group-fixtures",
        title: "Groups are set",
        body: "Your groups are drawn. Generate the group fixtures so every team can see who they play.",
        cta: "Draw group fixtures",
      };
    }
    // Nothing started yet and the field is set: prompt to kick things off.
    if (!started && !groupsCreated && participants.length >= 2) {
      const full =
        tournament.TournamentSize > 0 &&
        participants.length >= tournament.TournamentSize;
      if (!full && registrationOpen(tournament)) return null;
      return {
        step: "start",
        title: full ? "All teams are in" : "Registration has closed",
        body: isGroups
          ? "Every slot is filled. Check the registered teams are correct, then create your groups to lock the roster."
          : "Every slot is filled. Check the registered teams are correct, then draw the fixtures to lock the roster.",
        cta: isGroups ? "Create groups" : "Draw fixtures",
      };
    }
    return null;
  }, [
    canManage,
    champion,
    isGroups,
    groupsCreated,
    groupStageDrawn,
    started,
    participants,
    tournament,
  ]);

  const [startPromptOpen, setStartPromptOpen] = useState(false);
  const startPromptShownRef = useRef<string | null>(null);
  useEffect(() => {
    const step = startPrompt?.step ?? null;
    if (!step) {
      startPromptShownRef.current = null;
      return;
    }
    if (startPromptShownRef.current === step) return;
    startPromptShownRef.current = step;
    let dismissed = false;
    try {
      dismissed =
        localStorage.getItem(`gl_start_${tournament.TournamentId}_${step}`) ===
        "1";
    } catch {
      dismissed = false;
    }
    if (!dismissed) setStartPromptOpen(true);
  }, [startPrompt, tournament.TournamentId]);

  const closeStartPrompt = () => {
    if (startPrompt) {
      try {
        localStorage.setItem(
          `gl_start_${tournament.TournamentId}_${startPrompt.step}`,
          "1",
        );
      } catch {
        // Ignore storage failures; the prompt just may show again next visit.
      }
    }
    setStartPromptOpen(false);
  };

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
          tournamentId={tournament.TournamentId}
          tournamentName={tournament.Name}
          gameName={tournament.GameName}
          onClose={() => setCelebrate(false)}
        />
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
                <PaymentTag payment={tournament.Payment} className="rounded-md" />
                {tournament.TournamentType === "PRIVATE" ? (
                  <Tag tone="outline" size="md" uppercase={false}>
                    Invite only
                  </Tag>
                ) : null}
                <Tag tone="outline" size="md" className="border-primary/25">
                  {tournament.TournamentMode}
                </Tag>
                {(tournament.CatalogKind || GAMES_KIND) !== GAMES_KIND ? (
                  <Tag tone="outline" size="md" uppercase={false} className="border-primary/25">
                    {kindPublicLabel(tournament.CatalogKind)}
                  </Tag>
                ) : null}
                {champion?.TeamName?.trim() ? (
                  <button
                    type="button"
                    onClick={() => setCelebrate(true)}
                    className="inline-flex items-center justify-center leading-none rounded-full border border-yellow/40 bg-yellow/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow hover:bg-yellow/25"
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
            <span className="inline-flex items-center justify-center leading-none shrink-0 rounded-full bg-yellow/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow">
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

      {stageNudge ? (
        <button
          type="button"
          onClick={() => setTab("run")}
          className="block w-full border-b border-primary/40 bg-primary/15 text-left transition-colors hover:bg-primary/20"
        >
          <span className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-page py-3.5">
            <span className="inline-flex items-center justify-center leading-none shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-primary">
              Action needed
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                {stageNudge.title}
              </span>
              <span className="mt-0.5 block text-xs text-body">
                {stageNudge.body}
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              Go to Run
            </span>
          </span>
        </button>
      ) : null}

      <div className="border-b border-surface-2 bg-nav">
        <div
          // One row that scrolls sideways on phones, rather than wrapping a
          // lone tab onto a second line.
          className="mx-auto flex max-w-6xl gap-x-1 overflow-x-auto px-page [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          {...helpTarget("tour-tabs")}
        >
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`cursor-pointer whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors sm:px-4 sm:py-4 sm:text-sm ${
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
            {tournament.TournamentType === "PRIVATE" ? (
              <div className="mb-6">
                <JoinRequestsPanel tournamentId={tournament.TournamentId} />
              </div>
            ) : null}
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
          <div className="flex flex-col gap-4">
            {exportable.has("standings") ? (
              <div className="flex justify-end">
                {downloadButton("standings")}
              </div>
            ) : null}
            <LeagueTable
              standings={standings}
              scoreLabel={tournament.ScoreLabel}
              allowDraw={tournament.AllowDraw !== false}
            />
          </div>
        )}
        {tab === "table" && tournament.TournamentMode === "BATTLEROYALE" && (
          <div className="flex flex-col gap-4">
            {exportable.has("standings") ? (
              <div className="flex justify-end">
                {downloadButton("standings")}
              </div>
            ) : null}
            <BrTable
              standings={computeBrStandings(draws, {
                PlacementPoints: tournament.BrPlacementPoints,
                KillPoints: tournament.BrKillPoints,
                FirstBloodPoints: tournament.BrFirstBloodPoints,
              })}
            />
          </div>
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
                    onViewFixtures={
                      groupStageDrawn ? viewGroupFixtures : undefined
                    }
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

            const canPreview =
              isGroups &&
              knockoutDraws.length === 0 &&
              qualifierPreview.size > 0;

            const bracketContent = (
              <div className="space-y-5">
                {canSelectQualifiers && qualifiers.length > 0 ? (
                  <QualifierList groups={groups} qualifiers={qualifiers} />
                ) : null}
                {canPreview ? (
                  // A small switch rather than another big button.
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-2 bg-surface px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      checked={previewQualifiers}
                      onChange={() => setPreviewQualifiers((on) => !on)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-white">
                        Show who qualifies right now
                      </span>
                      <span className="block text-xs text-body">
                        From the tables as they stand. Nothing is drawn yet.
                      </span>
                    </span>
                  </label>
                ) : null}
                <KnockoutBracket
                  rounds={bracketRounds}
                  groupNames={bracketGroupNames}
                  advancePerGroup={tournament.AdvancePerGroup || 2}
                  teamCount={isGroups ? 0 : participants.length}
                  isGroupMode={isGroups}
                  knockoutLive={knockoutDraws.length > 0}
                  qualifierReasons={qualifiers}
                  previewTeams={
                    previewQualifiers && canPreview ? qualifierPreview : undefined
                  }
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
                  {exportable.has("teams") ? (
                    <div className="flex justify-end">
                      {downloadButton("teams")}
                    </div>
                  ) : null}
                  {invitePanels}
                  {teamsContent}
                </div>
              );
            }

            // Whatever this panel is actually showing right now.
            const panelView = viewForTeamsPanel({
              panel: teamsPanel,
              isGroups,
              groupsCreated,
              available: (v) => Boolean(exportViews[v]),
            });
            const panels: { id: TeamsPanel; label: string }[] = [
              { id: "teams", label: isGroups ? "Groups" : "Teams" },
              { id: "bracket", label: "Knockout" },
            ];

            return (
              <div className="flex flex-col gap-4 sm:gap-6">
                {/* One switch and at most two small actions, so the row fits a
                    phone without wrapping into a stack of big buttons. */}
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="tablist"
                    className="flex min-w-0 flex-1 rounded-xl border border-surface-2 bg-surface p-1 sm:flex-none"
                  >
                    {panels.map((panel) => (
                      <button
                        key={panel.id}
                        type="button"
                        role="tab"
                        aria-selected={teamsPanel === panel.id}
                        onClick={() => setTeamsPanel(panel.id)}
                        className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                          teamsPanel === panel.id
                            ? "bg-primary text-on-primary"
                            : "text-body hover:text-white"
                        }`}
                      >
                        {panel.label}
                      </button>
                    ))}
                  </div>
                  {/* Phones: the switch and download share a row, and Update
                      scores takes the full row under them. */}
                  {canUpdateScores ? (
                    <Button
                      type="button"
                      className="order-last w-full px-4 sm:order-none sm:ml-auto sm:w-auto"
                      onClick={goUpdateScores}
                    >
                      <PencilGlyph />
                      Update scores
                    </Button>
                  ) : null}
                  {panelView ? (
                    <div className={canUpdateScores ? "" : "sm:ml-auto"}>
                      {downloadButton(panelView, "", true)}
                    </div>
                  ) : null}
                </div>
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

        {tab === "fixtures" ? (
          <div className="mb-6 flex flex-wrap justify-center gap-3">
            {hasMyFixtures ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMine(true)}
              >
                See my matches
              </Button>
            ) : null}
            {unplayedSections.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUnplayed(true)}
              >
                View unplayed matches
              </Button>
            ) : null}
          </div>
        ) : null}

        <MatchListModal
          open={showUnplayed}
          onClose={() => setShowUnplayed(false)}
          title="Unplayed matches"
          sections={unplayedSections}
          empty="Every match has been played."
          download={
            exportViews.unplayed
              ? {
                  tournamentId: tournament.TournamentId,
                  tournamentName: tournament.Name,
                  view: "unplayed",
                  pages: exportViews.unplayed,
                }
              : undefined
          }
        />

        <MatchListModal
          open={showMine}
          onClose={() => setShowMine(false)}
          title="My matches"
          sections={mySections}
          empty="You are not in any fixtures yet."
        />

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
                            mine={mineDrawIds.has(d.DrawId)}
                            timeZoneLabel={tzLabel}
                            draw={d}
                            canManage={canManage && !isFinished && !isFixtureStageLocked(d, draws)}
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
                                mine={mineDrawIds.has(d.DrawId)}
                            timeZoneLabel={tzLabel}
                                draw={d}
                                canManage={canManage && !isFinished && !isFixtureStageLocked(d, draws)}
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
                          mine={mineDrawIds.has(d.DrawId)}
                          timeZoneLabel={tzLabel}
                          draw={d}
                          canManage={canManage && !isFinished && !isFixtureStageLocked(d, draws)}
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
                            mine={mineDrawIds.has(d.DrawId)}
                            timeZoneLabel={tzLabel}
                            draw={d}
                            canManage={canManage && !isFinished && !isFixtureStageLocked(d, draws)}
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
            <div className="flex max-w-lg flex-col gap-5">
              <div className="rounded-xl border border-surface-2 bg-surface p-5">
                <h3 className="text-lg font-semibold text-white">Invite only</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">
                  This event is invite only. Send a request below and the host
                  can accept it (you are registered straight away) or invite you.
                </p>
              </div>
              <RegisterTeam
                tournamentId={tournament.TournamentId}
                teamSize={tournament.Team}
                rosterCount={tournament.RosterCount}
                usesInGameName={catalogKindFlags.usesInGameName}
                payment={tournament.Payment}
                currency={tournament.Currency}
                entryFee={tournament.RegistrationAmount}
                feeBps={tournament.PlatformFeeBps}
                requestMode
                onRegistered={() => {}}
                onRequested={() => setTab("details")}
              />
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

      <section className="mx-auto max-w-6xl px-page pb-10">
        <RatingPanel
          targetType="TOURNAMENT"
          targetId={tournament.TournamentId}
          title="Rate this tournament"
          noun="this tournament"
        />
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
      <Confirm
        open={invitePromptOpen}
        title="You're invited"
        message="You've been invited to this tournament. Register your team to lock in your spot before the deadline."
        confirmLabel="Go to registration"
        confirmVariant="default"
        onConfirm={() => {
          setTab("register");
          setInvitePromptOpen(false);
        }}
        onCancel={() => setInvitePromptOpen(false)}
      />
      {canManage && startPrompt ? (
        <Confirm
          open={startPromptOpen}
          title={startPrompt.title}
          message={startPrompt.body}
          confirmLabel={startPrompt.cta}
          confirmVariant="default"
          onConfirm={() => {
            setTab("run");
            closeStartPrompt();
          }}
          onCancel={closeStartPrompt}
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
    <div
      data-group-panel={title}
      className="overflow-hidden rounded-xl border border-surface-2"
    >
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

function placeLabel(position: number): string {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
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
      label: "Type",
      value: tournament.Payment === "SPONSORED" ? "Sponsored" : "Free",
    },
    { label: "Draw", value: tournament.Shuffle },
    { label: "Size", value: `${tournament.TournamentSize} teams` },
    { label: "Date", value: tournament.Date },
    ...(tournament.TimeZone
      ? [{ label: "Timezone", value: tzCityLabel(tournament.TimeZone) }]
      : []),
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
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5" {...helpTarget("tour-details")}>
      {tournament.Payment === "SPONSORED" && tournament.Prizes.length > 0 ? (
        <div className="rounded-xl border border-yellow/40 bg-yellow/10 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-yellow">
            Prizes
          </h3>
          <ul className="space-y-2">
            {tournament.Prizes.map((prize) => (
              <li
                key={prize.Position}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-body">
                  {placeLabel(prize.Position)} place
                </span>
                <span className="font-display text-lg text-white">
                  {formatMoney(prize.Amount, tournament.Currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-body">
            Prizes are awarded directly by the organizer. Gamelyd does not
            collect or pay out any money.
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white">
          About
        </h3>
        {tournament.Description ? (
          <p className="mb-3 text-sm leading-relaxed text-white/90">
            {tournament.Description}
          </p>
        ) : null}
        {tournament.Note ? (
          <Markdown source={tournament.Note} />
        ) : !tournament.Description ? (
          <p className="text-sm leading-relaxed text-body">
            No description yet.
          </p>
        ) : null}
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
    </div>
  );
}

function PencilGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
