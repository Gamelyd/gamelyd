"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { DateInput, DateTimeInput } from "@/components/ui/DateTimePicker";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { saveTournamentAction } from "@/server/actions/tournamentActions";
import { getGamesAction } from "@/server/actions/gameActions";
import { getCatalogKindsAction } from "@/server/actions/catalogKindActions";
import { getPlatformsAction } from "@/server/actions/platformActions";
import { IconPicker } from "@/components/ui/IconPicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FALLBACKS, iconForGame } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";
import { joinPlatforms } from "@/lib/platforms";
import type { Game } from "@/lib/schemas/game";
import type { CatalogKind } from "@/lib/schemas/catalogKind";
import type { Platform } from "@/lib/schemas/platform";
import type { SaveTournamentInput } from "@/lib/schemas/tournament";
import type {
  KnockoutFormat,
  Payment,
  Shuffle,
  TieBreaker,
  TournamentMode,
  TournamentType,
} from "@/lib/schemas/common";
import { formatMoney } from "@/lib/currency";
import type { Plan, PlanLimits } from "@/lib/plans";
import { myPlanLimitsAction } from "@/server/actions/tournamentActions";
import { startOneOffTournamentCheckoutAction } from "@/server/actions/paymentActions";
import { Loader } from "@/components/ui/Loader";
import {
  GAMES_KIND,
  SPORTS_KIND,
  kindUses,
  teamSizeFromRoster,
} from "@/lib/catalog";
import { venueLabel } from "@/lib/venue";
import { PlaceEditor, type VenueDraft } from "@/components/tournament/VenueEditor";
import { PageTour } from "@/components/help/PageTour";
import { CREATE_TOURS } from "@/components/help/tours";
import { helpTarget } from "@/lib/help";

type Step = "game" | "format" | "rules" | "brief";

const STEPS: { id: Step; label: string; code: string }[] = [
  { id: "game", label: "Catalog", code: "01" },
  { id: "format", label: "Format", code: "02" },
  { id: "rules", label: "Rules", code: "03" },
  { id: "brief", label: "Launch", code: "04" },
];

const MODES: {
  value: TournamentMode;
  label: string;
  blurb: string;
  glyph: "knockout" | "groups" | "league" | "br";
}[] = [
  {
    value: "MULTIPLAYER",
    label: "Knockout",
    blurb: "Single elimination. Win or go home.",
    glyph: "knockout",
  },
  {
    value: "GROUPS",
    label: "Groups",
    blurb: "Round-robin pools, then a knockout.",
    glyph: "groups",
  },
  {
    value: "LEAGUE",
    label: "League",
    blurb: "Everyone plays everyone. Table decides.",
    glyph: "league",
  },
  {
    value: "BATTLEROYALE",
    label: "Battle royale",
    blurb: "One lobby. Last squad standing.",
    glyph: "br",
  },
];

const NEXT_LABEL: Record<Exclude<Step, "brief">, string> = {
  game: "Continue",
  format: "Lock format",
  rules: "Lock rules",
};

export function CreateTournamentWizard() {
  const { isAuthenticated, orgs, user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("game");
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [kinds, setKinds] = useState<CatalogKind[]>([]);
  const [catalogKind, setCatalogKind] = useState(GAMES_KIND);
  const [formatId, setFormatId] = useState("");
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [platformsLoaded, setPlatformsLoaded] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const [type, setType] = useState<TournamentType>("PRIVATE");
  const [payment, setPayment] = useState<Payment>("FREE");
  const [mode, setMode] = useState<TournamentMode>("MULTIPLAYER");
  const [rosterCount, setRosterCount] = useState(1);
  const [shuffle, setShuffle] = useState<Shuffle>("AUTOMATIC");
  const [returnLeg, setReturnLeg] = useState(false);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [groupCount, setGroupCount] = useState(0);
  const [pickQualifiers, setPickQualifiers] = useState(false);
  const [pointsWin, setPointsWin] = useState(3);
  const [pointsDraw, setPointsDraw] = useState(1);
  const [knockoutFormat, setKnockoutFormat] =
    useState<KnockoutFormat>("SINGLE");
  const [knockoutFinalsSeries, setKnockoutFinalsSeries] = useState(false);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [tieBreaker, setTieBreaker] = useState<TieBreaker>("GOAL_DIFF");
  const [brLobbies, setBrLobbies] = useState(1);
  const [brKillPoints, setBrKillPoints] = useState(1);
  const [brFirstBloodPoints, setBrFirstBloodPoints] = useState(0);
  const [brPlacement, setBrPlacement] = useState("12,9,7,5,4,3,2,1");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [checkInRequired, setCheckInRequired] = useState(false);
  const [checkInCloses, setCheckInCloses] = useState("");
  const [firstMatchAt, setFirstMatchAt] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [locationCity, setLocationCity] = useState("");
  // Set when the host picks the city from search; tells the server the point is
  // confirmed rather than something to geocode from free text.
  const [locationPoint, setLocationPoint] = useState({ lat: 0, lng: 0 });
  // Null until we know; paid/sponsored stay locked while we are unsure so a
  // host never picks a money option this deployment cannot honour.
  const [planInfo, setPlanInfo] = useState<{
    plan: Plan;
    limits: PlanLimits;
    activeCount: number;
    oneOff: { enabled: boolean; price: number; currency: string; tier: Plan };
    sponsorRequiresOrg: boolean;
  } | null>(null);
  const [venues, setVenues] = useState<VenueDraft[]>([]);
  const [matchInterval, setMatchInterval] = useState(0);
  // Reruns when the host switches org, since a club's plan may differ from
  // the member's own.
  useEffect(() => {
    void myPlanLimitsAction(orgId).then((result) => {
      if (result.ok) setPlanInfo(result.data);
    });
  }, [orgId]);

  const hasOrg = orgId !== "";
  // A solo host can sponsor only when the admin has opened it up.
  const canSponsor =
    hasOrg || (planInfo ? !planInfo.sponsorRequiresOrg : false);

  // If Sponsored becomes unavailable (org removed, or policy tightened), drop
  // back to Free rather than submitting a choice the server will reject.
  useEffect(() => {
    if (!canSponsor) setPayment((prev) => (prev === "SPONSORED" ? "FREE" : prev));
  }, [canSponsor]);

  const [details, setDetails] = useState({
    Name: "",
    GameName: "",
    icon: FALLBACKS.tournament as string,
    TournamentSize: 8,
    Date: "",
    Note: "",
    Amount: 0,
    RegistrationAmount: 0,
  });

  // Null while the plan is still loading, so nothing is wrongly shown as locked.
  const maxTeams = planInfo ? planInfo.limits.maxTeams : null;
  const overTeamCap =
    maxTeams !== null && Number(details.TournamentSize) > maxTeams;
  const modeLocked = (value: TournamentMode) =>
    Boolean(planInfo && !planInfo.limits.modes.includes(value));
  const atActiveCap = Boolean(
    planInfo &&
      planInfo.limits.maxActive !== null &&
      planInfo.activeCount >= planInfo.limits.maxActive,
  );
  // The current form would be rejected by the host's own plan.
  const exceedsPlan = Boolean(
    planInfo &&
      (overTeamCap ||
        modeLocked(mode) ||
        (orgId !== "" && !planInfo.limits.canHostAsOrg) ||
        atActiveCap),
  );
  // A one-off is offered only when it would actually let this through.
  const payOnce = Boolean(exceedsPlan && planInfo?.oneOff.enabled);
  const oneOffPrice =
    planInfo && planInfo.oneOff.enabled
      ? formatMoney(planInfo.oneOff.price, planInfo.oneOff.currency)
      : "";


  useEffect(() => {
    if (!isAuthenticated) router.push("/signup?redirect=/tournament/new");
  }, [isAuthenticated, router]);

  useEffect(() => {
    let active = true;
    void Promise.all([getGamesAction(), getCatalogKindsAction()]).then(
      ([gamesResult, kindsResult]) => {
        if (!active) return;
        if (gamesResult.ok) setGamesList(gamesResult.data);
        else toast.error(gamesResult.error);
        if (kindsResult.ok) {
          setKinds(kindsResult.data);
          if (kindsResult.data.length > 0) {
            setCatalogKind((prev) =>
              kindsResult.data.some((k) => k.slug === prev)
                ? prev
                : kindsResult.data[0].slug,
            );
          }
        } else toast.error(kindsResult.error);
        setGamesLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    let active = true;
    void getPlatformsAction().then((result) => {
      if (!active) return;
      if (result.ok) setPlatformList(result.data);
      else toast.error(result.error);
      setPlatformsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [toast]);

  const selectedGameId = gamesList.find(
    (g) => g.name === details.GameName,
  )?.game_id;
  const { icons: covers, loading: coversLoading } = useIcons("tournament", {
    gameId: selectedGameId,
    taggedOnly: true,
  });

  useEffect(() => {
    if (covers.length === 0) return;
    setDetails((prev) => {
      if (covers.some((icon) => icon.url === prev.icon)) return prev;
      return { ...prev, icon: covers[0].url };
    });
  }, [selectedGameId, covers]);

  const selectedGame = gamesList.find((g) => g.name === details.GameName);
  const selectedFormat =
    (selectedGame?.formats ?? []).find((row) => row.id === formatId) ??
    selectedGame?.formats?.[0];
  const kindFlags = kindUses(kinds, catalogKind);
  const allowDraw = selectedGame?.allowDraw !== false;
  const scoreLabel =
    selectedGame?.scoreLabel === "Points" ? "Points" : "Goals";
  const gamesForKind = gamesList.filter((game) => {
    const kind = game.kind || GAMES_KIND;
    return kind === catalogKind;
  });

  const pickGame = (game: Game) => {
    const catalog = new Set(platformList.map((p) => p.name));
    const fromGame = (game.platforms ?? []).filter((name) => catalog.has(name));
    setDetails((prev) => ({
      ...prev,
      GameName: game.name,
      icon: game.image || iconForGame(game.name, covers) || prev.icon,
    }));
    if (fromGame.length > 0) setSelectedPlatforms(fromGame);
    else if (!kindUses(kinds, game.kind).usesPlatforms) {
      setSelectedPlatforms([]);
    }
    const first = (game.formats ?? [])[0];
    setFormatId(first?.id ?? "");
    setRosterCount(first?.roster ?? 1);
    if (game.allowDraw === false) setPointsDraw(0);
    else setPointsDraw((prev) => (prev === 0 ? 1 : prev));
  };

  const switchKind = (slug: string) => {
    setCatalogKind(slug);
    setDetails((prev) => ({ ...prev, GameName: "" }));
    setFormatId("");
    const flags = kindUses(kinds, slug);
    if (!flags.usesBattleRoyale && mode === "BATTLEROYALE") {
      setMode("MULTIPLAYER");
    }
    if (!flags.usesPlatforms) setSelectedPlatforms([]);
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    if (step === "game") {
      if (!details.GameName) {
        toast.error(
          catalogKind === GAMES_KIND ? "Pick a game to continue" : "Pick a sport to continue",
        );
        return;
      }
      setStep("format");
      return;
    }
    if (step === "format") {
      if (rosterCount < 1 || rosterCount > 32) {
        toast.error("Choose how many players each team has");
        return;
      }
      setStep("rules");
      return;
    }
    if (step === "rules") setStep("brief");
  };

  const goBack = () => {
    if (step === "format") setStep("game");
    if (step === "rules") setStep("format");
    if (step === "brief") setStep("rules");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!details.GameName) {
      toast.error("Select a game");
      setStep("game");
      return;
    }
    setLoading(true);
    const payload: SaveTournamentInput = {
      TournamentType: type,
      Payment: payment,
      Currency: "USD",
      TournamentMode: mode,
      Team: teamSizeFromRoster(rosterCount),
      Shuffle: shuffle,
      Name: details.Name,
      GameName: details.GameName,
      icon: details.icon || FALLBACKS.tournament,
      TournamentSize: details.TournamentSize,
      Date: details.Date,
      Note: details.Note,
      Platform: kindFlags.usesPlatforms
        ? joinPlatforms(selectedPlatforms)
        : "",
      Amount: 0,
      RegistrationAmount: 0,
      Prizes: [],
      Link: "",
      RefNumber: "",
      PaymentChannel: "",
      OrgId: orgId,
      ReturnLeg: mode === "LEAGUE" || mode === "GROUPS" ? returnLeg : false,
      AdvancePerGroup: mode === "GROUPS" ? advancePerGroup : 2,
      GroupCount: mode === "GROUPS" ? groupCount : 0,
      OwnerCanSelectQualifiers: mode === "GROUPS" ? pickQualifiers : false,
      PointSystem:
        mode === "LEAGUE" || mode === "GROUPS"
          ? { Win: pointsWin, Draw: allowDraw ? pointsDraw : 0 }
          : undefined,
      KnockoutFormat:
        mode === "MULTIPLAYER" || mode === "GROUPS" ? knockoutFormat : "SINGLE",
      KnockoutFinalsSeries:
        (mode === "MULTIPLAYER" || mode === "GROUPS") &&
        knockoutFormat !== "SINGLE"
          ? knockoutFinalsSeries
          : false,
      ThirdPlace:
        mode === "MULTIPLAYER" || mode === "GROUPS" ? thirdPlace : false,
      TieBreaker:
        mode === "LEAGUE" || mode === "GROUPS" ? tieBreaker : "GOAL_DIFF",
      BrLobbyCount: mode === "BATTLEROYALE" ? brLobbies : 1,
      BrKillPoints: mode === "BATTLEROYALE" ? brKillPoints : 1,
      BrFirstBloodPoints: mode === "BATTLEROYALE" ? brFirstBloodPoints : 0,
      BrPlacementPoints:
        mode === "BATTLEROYALE"
          ? brPlacement
              .split(/[,\s]+/)
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n))
          : undefined,
      RegistrationDeadline: registrationDeadline,
      CheckInRequired: checkInRequired,
      CheckInOpens: "",
      CheckInCloses: checkInCloses,
      FirstMatchAt: firstMatchAt,
      MatchIntervalMinutes: matchInterval,
      CatalogKind: catalogKind,
      FormatName: selectedFormat?.label ?? "",
      RosterCount: rosterCount,
      AllowDraw: allowDraw,
      ScoreLabel: scoreLabel,
      VenueCountry: kindFlags.usesVenue ? locationCountry : "",
      VenueCity: kindFlags.usesVenue ? locationCity.trim() : "",
      VenueLocation: kindFlags.usesVenue ? locationCity.trim() : "",
      VenueLat: kindFlags.usesVenue ? locationPoint.lat : 0,
      VenueLng: kindFlags.usesVenue ? locationPoint.lng : 0,
      Venues: kindFlags.usesVenue
        ? venues.filter((v) => v.location.trim())
        : [],
    };
    // Over the free limits with no subscription: take the one-off payment,
    // which creates the tournament once it clears.
    if (payOnce) {
      const checkout = await startOneOffTournamentCheckoutAction(payload);
      setLoading(false);
      if (checkout.ok) {
        toast.success("Redirecting to pay");
        window.location.assign(checkout.data.checkoutUrl);
        return;
      }
      toast.error(checkout.error);
      return;
    }

    const result = await saveTournamentAction(payload);
    setLoading(false);
    if (result.ok) {
      if (result.data.checkoutUrl) {
        toast.success("Redirecting to pay the prize pool");
        window.location.href = result.data.checkoutUrl;
        return;
      }
      toast.success(result.message ?? "Tournament created");
      router.push(`/tournament/${result.data.tournament.TournamentId}`);
    } else {
      toast.error(result.error);
    }
  };

  const modeLabel = MODES.find((m) => m.value === mode)?.label ?? mode;
  const teamLabel = selectedFormat
    ? `${selectedFormat.label} · ${rosterCount}`
    : `${rosterCount} per team`;
  const heroSrc = details.GameName
    ? details.icon || selectedGame?.image || FALLBACKS.tournament
    : "";
  const catalogReady = gamesLoaded && platformsLoaded;

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageTour tour={CREATE_TOURS[step]} />
      <section className="create-hud-head relative overflow-hidden border-b border-primary/20 bg-primary-panel">
        {heroSrc ? (
          <>
            <CatalogImage
              key={heroSrc}
              src={heroSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              quality={90}
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/70 to-black/30" />
          </>
        ) : null}
        <div className="relative z-1 mx-auto max-w-6xl px-page py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
            Host terminal
          </p>
          <h1 className="mt-1 font-display text-4xl leading-none text-white md:text-5xl">
            Create tournament
          </h1>
          <p className="mt-3 max-w-xl text-sm text-body">
            Lock in the game, format, and rules, then launch the lobby.
          </p>

          <ol
            className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4"
            {...helpTarget("create-steps")}
          >
            {STEPS.map((item, index) => {
              const done = index < stepIndex;
              const active = item.id === step;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => {
                      if (item.id !== "game" && !details.GameName) return;
                      if (index > stepIndex && !details.GameName) return;
                      setStep(item.id);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/15"
                        : done
                          ? "border-primary/30 bg-black/20"
                          : "border-white/10 bg-black/20"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-sm ${
                        active || done
                          ? "bg-primary text-[#04201e]"
                          : "bg-surface-2 text-white/50"
                      }`}
                    >
                      {item.code}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        active ? "text-white" : "text-white/55"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/40">
            <div
              key={step}
              className="create-hud-bar h-full bg-primary"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-8 px-page py-10 lg:grid-cols-[1fr_16rem]">
        <div key={catalogReady ? step : "boot"} className="create-step min-w-0">
          {!catalogReady ? (
            <Loader label="Loading games" />
          ) : step === "game" ? (
            <GameStep
              games={gamesForKind}
              kinds={kinds}
              catalogKind={catalogKind}
              onKind={switchKind}
              loaded={gamesLoaded}
              selected={details.GameName}
              covers={covers}
              onPick={(game) => {
                if (details.GameName === game.name) {
                  goNext();
                  return;
                }
                pickGame(game);
              }}
            />
          ) : null}

          {step === "format" ? (
            <div className="flex flex-col gap-8">
              <SectionTitle kicker="Loadout" title="How do they compete?" />
              {((selectedGame?.formats ?? []).length > 0) ? (
                <div {...helpTarget("create-pitch-format")}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Format
                  </p>
                  <p className="mb-3 text-sm text-body">
                    Optional preset. You still set how many players sit on a
                    team.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {(selectedGame?.formats ?? []).map((row) => (
                      <ChoiceChip
                        key={row.id}
                        label={`${row.label} · ${row.roster}`}
                        active={
                          (selectedFormat?.id ?? formatId) === row.id
                        }
                        onClick={() => {
                          setFormatId(row.id);
                          setRosterCount(row.roster);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <div
                className="grid gap-3 sm:grid-cols-2"
                {...helpTarget("create-modes")}
              >
                {MODES.filter(
                  (item) =>
                    item.value !== "BATTLEROYALE" ||
                    kindFlags.usesBattleRoyale,
                ).map((item, i) => (
                  <ChoiceTile
                    key={item.value}
                    delay={i}
                    title={item.label}
                    blurb={
                      modeLocked(item.value)
                        ? `Included from the Club plan. You are on ${planInfo?.limits.label}.`
                        : item.blurb
                    }
                    active={mode === item.value}
                    disabled={modeLocked(item.value)}
                    disabledLabel="Upgrade"
                    glyph={<ModeGlyph kind={item.glyph} />}
                    onClick={() => setMode(item.value)}
                  />
                ))}
              </div>
              {mode === "LEAGUE" || mode === "GROUPS" ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Return leg
                  </p>
                  <p className="mb-3 text-sm text-body">
                    {mode === "GROUPS"
                      ? "Play each pairing once in the group, or again with sides swapped."
                      : "Play each pairing once, or again with sides swapped."}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <ChoiceChip
                      label="Single round"
                      active={!returnLeg}
                      onClick={() => setReturnLeg(false)}
                    />
                    <ChoiceChip
                      label="Home and away"
                      active={returnLeg}
                      onClick={() => setReturnLeg(true)}
                    />
                  </div>
                </div>
              ) : null}
              {mode === "LEAGUE" || mode === "GROUPS" ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Points
                  </p>
                  <p className="mb-3 text-sm text-body">
                    How the table scores a win{allowDraw ? " and a draw" : ""}.
                    A loss is always 0.
                  </p>
                  <div className="grid max-w-md gap-4 sm:grid-cols-2">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      label="Win"
                      value={pointsWin}
                      onChange={(e) =>
                        setPointsWin(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                    {allowDraw ? (
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      label="Draw"
                      value={pointsDraw}
                      onChange={(e) =>
                        setPointsDraw(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {mode === "GROUPS" ? (
                <div className="flex flex-col gap-8">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      Number of groups
                    </p>
                    <p className="mb-3 text-sm text-body">
                      Auto aims for about four teams per group. You can still
                      move teams after groups are created, before fixtures.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {[0, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <ChoiceChip
                          key={n}
                          label={n === 0 ? "Auto" : String(n)}
                          active={groupCount === n}
                          onClick={() => setGroupCount(n)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="max-w-xs">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      Advance per group
                    </p>
                    <p className="mb-3 text-sm text-body">
                      How many from each group go through to knockout. You can
                      change this until the event starts.
                    </p>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      value={advancePerGroup}
                      onChange={(e) =>
                        setAdvancePerGroup(
                          Math.min(8, Math.max(1, Number(e.target.value) || 1)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      Ties on the table
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ChoiceTile
                        title="Table order"
                        blurb="Points, then goal difference. Ties stay as the table ranks them."
                        active={!pickQualifiers}
                        onClick={() => setPickQualifiers(false)}
                      />
                      <ChoiceTile
                        title="Host picks ties"
                        blurb="If teams finish level on points, you choose who goes through, with a public reason."
                        active={pickQualifiers}
                        onClick={() => setPickQualifiers(true)}
                        delay={1}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {mode === "LEAGUE" || mode === "GROUPS" ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Table tie-break
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <ChoiceChip
                      label="Goal difference"
                      active={tieBreaker === "GOAL_DIFF"}
                      onClick={() => setTieBreaker("GOAL_DIFF")}
                    />
                    <ChoiceChip
                      label="Head to head"
                      active={tieBreaker === "HEAD_TO_HEAD"}
                      onClick={() => setTieBreaker("HEAD_TO_HEAD")}
                    />
                  </div>
                </div>
              ) : null}
              {mode === "MULTIPLAYER" || mode === "GROUPS" ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Knockout ties
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        ["SINGLE", "Single match"],
                        ["TWO_LEG", "Two legs"],
                        ["BO3", "Best of 3"],
                        ["BO5", "Best of 5"],
                      ] as const
                    ).map(([value, label]) => (
                      <ChoiceChip
                        key={value}
                        label={label}
                        active={knockoutFormat === value}
                        onClick={() => {
                          setKnockoutFormat(value);
                          if (value === "SINGLE") setKnockoutFinalsSeries(false);
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ChoiceChip
                      label="No 3rd place"
                      active={!thirdPlace}
                      onClick={() => setThirdPlace(false)}
                    />
                    <ChoiceChip
                      label="3rd place match"
                      active={thirdPlace}
                      onClick={() => setThirdPlace(true)}
                    />
                  </div>
                  {knockoutFormat !== "SINGLE" ? (
                    <div className="mt-4">
                      <p className="mb-3 text-sm leading-relaxed text-body">
                        The final is one match by default
                        {thirdPlace
                          ? ", and 3rd place is always one match"
                          : ""}
                        . Include the final in{" "}
                        {knockoutFormat === "TWO_LEG"
                          ? "two-leg"
                          : knockoutFormat === "BO3"
                            ? "best-of-3"
                            : "best-of-5"}{" "}
                        fixtures?
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <ChoiceChip
                          label="Final is one match"
                          active={!knockoutFinalsSeries}
                          onClick={() => setKnockoutFinalsSeries(false)}
                        />
                        <ChoiceChip
                          label={
                            knockoutFormat === "TWO_LEG"
                              ? "Two-leg final"
                              : knockoutFormat === "BO3"
                                ? "Best-of-3 final"
                                : "Best-of-5 final"
                          }
                          active={knockoutFinalsSeries}
                          onClick={() => setKnockoutFinalsSeries(true)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {mode === "BATTLEROYALE" ? (
                <div className="flex flex-col gap-6">
                  <div className="grid max-w-xl gap-4 sm:grid-cols-3">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      label="Lobbies"
                      value={brLobbies}
                      onChange={(e) =>
                        setBrLobbies(
                          Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      label="Points per kill"
                      value={brKillPoints}
                      onChange={(e) =>
                        setBrKillPoints(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      label="First blood pts"
                      value={brFirstBloodPoints}
                      onChange={(e) =>
                        setBrFirstBloodPoints(
                          Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                    />
                  </div>
                  <Input
                    label="Placement points (1st, 2nd, …)"
                    value={brPlacement}
                    onChange={(e) => setBrPlacement(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="max-w-xs" {...helpTarget("create-roster")}>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  label="Players per team"
                  value={rosterCount}
                  onChange={(e) => {
                    const next = Math.max(
                      1,
                      Math.min(32, Number(e.target.value) || 1),
                    );
                    setRosterCount(next);
                  }}
                />
              </div>
              <div {...helpTarget("create-draw")}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  Draw
                </p>
                <div className="flex flex-wrap gap-3">
                  <ChoiceChip
                    label="Auto seed"
                    active={shuffle === "AUTOMATIC"}
                    onClick={() => setShuffle("AUTOMATIC")}
                  />
                  <ChoiceChip
                    label="Manual seed"
                    active={shuffle === "MANUAL"}
                    onClick={() => setShuffle("MANUAL")}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === "rules" ? (
            <div className="flex flex-col gap-8">
              <SectionTitle
                kicker="Access"
                title="Who gets in, and the stakes"
              />
              <div {...helpTarget("create-access")}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  Who can register
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceTile
                    title="Invite only"
                    blurb="Default. Listed for everyone. Players can register only after they accept your invite."
                    active={type === "PRIVATE"}
                    onClick={() => setType("PRIVATE")}
                  />
                  <ChoiceTile
                    title="Anyone can join"
                    blurb="Also listed for everyone. Anyone with an account can register, no invite needed."
                    active={type === "PUBLIC"}
                    onClick={() => setType("PUBLIC")}
                    delay={1}
                  />
                </div>
              </div>
              <div {...helpTarget("create-entry")}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  Entry
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceTile
                    title="Free"
                    blurb="An open tournament anyone can find and join."
                    active={payment === "FREE"}
                    onClick={() => setPayment("FREE")}
                  />
                  <ChoiceTile
                    title="Sponsored"
                    blurb={
                      canSponsor
                        ? "A sponsor badge on the event. No entry fees or prize money."
                        : "Host under an organization to run a sponsored event."
                    }
                    active={payment === "SPONSORED"}
                    disabled={!canSponsor}
                    disabledLabel="Organization only"
                    onClick={() => setPayment("SPONSORED")}
                    delay={1}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === "brief" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <SectionTitle
                kicker="Intel"
                title="Name the event and go live"
              />
              <ul className="flex flex-wrap gap-2">
                {[
                  details.GameName || "Game",
                  modeLabel,
                  teamLabel,
                  type === "PUBLIC" ? "Anyone can join" : "Invite only",
                  payment === "SPONSORED" ? "Sponsored" : "Free",
                ].map((chip) => (
                  <li
                    key={chip}
                    className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
              <div {...helpTarget("create-identity")}>
              {orgs.length > 0 ? (
                <Select
                  label="Host as"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  options={[
                    { label: "Yourself", value: "" },
                    ...orgs.map((o) => ({ label: o.name, value: o.org_id })),
                  ]}
                />
              ) : (
                <p className="text-sm text-body">
                  Hosting as yourself.{" "}
                  <Link href="/org/new" className="text-primary hover:underline">
                    Create an organization
                  </Link>{" "}
                  to host under a brand.
                </p>
              )}
              <Input
                label="Tournament name"
                value={details.Name}
                onChange={(e) =>
                  setDetails({ ...details, Name: e.target.value })
                }
                required
              />
              <IconPicker
                label="Head image"
                icons={covers}
                value={details.icon}
                onChange={(url) => setDetails({ ...details, icon: url })}
                loading={coversLoading}
                emptyHint={
                  details.GameName
                    ? "No covers tagged for this game yet. Tag some under Admin → Images."
                    : "Pick a game first to see matching covers."
                }
              />
              <p className="-mt-2 text-xs text-body">
                This is the hero at the top of this page and on the event page.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  type="number"
                  label={
                    maxTeams === null
                      ? "Lobby size (teams)"
                      : `Lobby size (teams, up to ${maxTeams})`
                  }
                  value={details.TournamentSize}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      TournamentSize: Number(e.target.value),
                    })
                  }
                  min={2}
                  max={maxTeams ?? undefined}
                  error={
                    overTeamCap
                      ? `The ${planInfo?.limits.label} plan allows ${maxTeams} teams. Upgrade for more.`
                      : undefined
                  }
                  required
                />
                <DateInput
                  label="Date"
                  value={details.Date}
                  onChange={(e) =>
                    setDetails({ ...details, Date: e.target.value })
                  }
                  required
                />
              </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <DateInput
                  label="Registration closes (optional)"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                />
                <DateTimeInput
                  label="First match (optional)"
                  value={firstMatchAt}
                  onChange={(e) => setFirstMatchAt(e.target.value)}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  label="Minutes between matches"
                  value={matchInterval}
                  onChange={(e) =>
                    setMatchInterval(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <DateInput
                  label="Check-in closes (optional)"
                  value={checkInCloses}
                  onChange={(e) => setCheckInCloses(e.target.value)}
                  disabled={!checkInRequired}
                />
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  Check-in
                </p>
                <div className="flex flex-wrap gap-3">
                  <ChoiceChip
                    label="No check-in"
                    active={!checkInRequired}
                    onClick={() => setCheckInRequired(false)}
                  />
                  <ChoiceChip
                    label="Teams must check in"
                    active={checkInRequired}
                    onClick={() => setCheckInRequired(true)}
                  />
                </div>
              </div>
              {kindFlags.usesVenue ? (
                <div {...helpTarget("create-venues")}>
                  <PlaceEditor
                    country={locationCountry}
                    city={locationCity}
                    cityLat={locationPoint.lat}
                    cityLng={locationPoint.lng}
                    onCountry={setLocationCountry}
                    onCity={setLocationCity}
                    onCityPlace={(place) => {
                      setLocationCity(place.city);
                      if (place.country) setLocationCountry(place.country);
                      setLocationPoint({ lat: place.lat, lng: place.lng });
                    }}
                    venues={venues}
                    onVenues={setVenues}
                  />
                </div>
              ) : null}
              {kindFlags.usesPlatforms ? (
              <div>
                <MultiSelect
                  label="Platforms"
                  options={platformList.map((p) => ({
                    label: p.name,
                    value: p.name,
                  }))}
                  value={selectedPlatforms}
                  onChange={setSelectedPlatforms}
                  disabled={!platformsLoaded || platformList.length === 0}
                  hint={
                    platformsLoaded && platformList.length === 0
                      ? user?.user_type === "ADMIN"
                        ? "Add platforms in Admin → Platforms first."
                        : "Platforms aren't listed yet."
                      : "Every platform this lobby supports."
                  }
                />
                {platformsLoaded &&
                platformList.length === 0 &&
                user?.user_type === "ADMIN" ? (
                  <p className="mt-1.5 text-xs text-body">
                    <Link
                      href="/admin/platforms"
                      className="text-primary hover:underline"
                    >
                      Open platforms
                    </Link>
                  </p>
                ) : null}
              </div>
              ) : null}
              <TextArea
                label="Briefing / rules"
                rows={4}
                value={details.Note}
                onChange={(e) =>
                  setDetails({ ...details, Note: e.target.value })
                }
                required
              />
              <p className="text-xs text-body">
                By launching you accept the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms
                </Link>
                .
              </p>
              <div
                className="create-action-bar flex flex-wrap gap-3"
                {...helpTarget("create-launch")}
              >
                <Button type="button" variant="dark" onClick={goBack}>
                  Back
                </Button>
                <Button type="submit" loading={loading}>
                  {payOnce ? `Pay ${oneOffPrice} and create` : "Launch lobby"}
                </Button>
              </div>
            </form>
          ) : null}

          {catalogReady && step !== "brief" ? (
            <div className="create-action-bar flex flex-wrap gap-3">
              {step !== "game" ? (
                <Button type="button" variant="dark" onClick={goBack}>
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={goNext}
                disabled={step === "game" && !details.GameName}
              >
                {NEXT_LABEL[step]}
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-primary-panel">
            <div className="create-loadout-art relative h-36 bg-black">
              <CatalogImage
                src={
                  details.icon || selectedGame?.image || FALLBACKS.tournament
                }
                alt=""
                fill
                sizes="256px"
                quality={90}
                className="object-cover opacity-80"
              />
              <div className="absolute inset-x-0 bottom-0 z-1 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Loadout
                </p>
                <p className="truncate font-display text-xl text-white">
                  {details.GameName || "Nothing locked"}
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm lg:grid-cols-1">
              <LoadoutRow label="Format" value={modeLabel} />
              <LoadoutRow label="Roster" value={teamLabel} />
              {kindFlags.usesVenue &&
              venueLabel({
                VenueCountry: locationCountry,
                VenueCity: locationCity,
                Venues: venues,
              }) ? (
                <LoadoutRow
                  label="Place"
                  value={venueLabel({
                    VenueCountry: locationCountry,
                    VenueCity: locationCity,
                    Venues: venues,
                  })}
                />
              ) : null}
              <LoadoutRow
                label="Access"
                value={type === "PUBLIC" ? "Anyone can join" : "Invite only"}
              />
              <LoadoutRow
                label="Entry"
                value={payment === "SPONSORED" ? "Sponsored" : "Free"}
              />
              <LoadoutRow
                label="Seed"
                value={shuffle === "AUTOMATIC" ? "Auto" : "Manual"}
              />
              <LoadoutRow
                label="Lobby"
                value={`${details.TournamentSize} teams`}
              />
              {mode === "GROUPS" ? (
                <LoadoutRow
                  label="Groups"
                  value={groupCount === 0 ? "Auto" : String(groupCount)}
                />
              ) : null}
              {mode === "GROUPS" ? (
                <LoadoutRow
                  label="Advance"
                  value={`${advancePerGroup} / group`}
                />
              ) : null}
              {mode === "LEAGUE" || mode === "GROUPS" ? (
                <LoadoutRow
                  label="Return"
                  value={returnLeg ? "Home / away" : "Single"}
                />
              ) : null}
              {mode === "LEAGUE" || mode === "GROUPS" ? (
                <LoadoutRow
                  label="Points"
                  value={
                    allowDraw
                      ? `${pointsWin} / ${pointsDraw}`
                      : `${pointsWin} win`
                  }
                />
              ) : null}
              {mode === "GROUPS" ? (
                <LoadoutRow
                  label="Ties"
                  value={pickQualifiers ? "Host picks" : "Table"}
                />
              ) : null}
              {mode === "LEAGUE" || mode === "GROUPS" ? (
                <LoadoutRow
                  label="Tie-break"
                  value={
                    tieBreaker === "HEAD_TO_HEAD" ? "Head to head" : "GD"
                  }
                />
              ) : null}
              {mode === "MULTIPLAYER" || mode === "GROUPS" ? (
                <LoadoutRow
                  label="KO"
                  value={`${
                    knockoutFormat === "TWO_LEG"
                      ? "Two legs"
                      : knockoutFormat === "BO3"
                        ? "Bo3"
                        : knockoutFormat === "BO5"
                          ? "Bo5"
                          : "Single"
                  }${
                    knockoutFormat !== "SINGLE" && !knockoutFinalsSeries
                      ? " · 1-match final"
                      : ""
                  }${thirdPlace ? " + 3rd" : ""}`}
                />
              ) : null}
              {mode === "BATTLEROYALE" ? (
                <LoadoutRow label="Lobbies" value={String(brLobbies)} />
              ) : null}
              {checkInRequired ? (
                <LoadoutRow label="Check-in" value="Required" />
              ) : null}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
        {kicker}
      </p>
      <h2 className="mt-1 font-display text-3xl text-white">{title}</h2>
    </div>
  );
}

function ChoiceTile({
  title,
  blurb,
  active,
  onClick,
  delay = 0,
  glyph,
  soon = false,
  disabled = false,
  disabledLabel,
}: {
  title: string;
  blurb: string;
  active: boolean;
  onClick?: () => void;
  delay?: number;
  glyph?: ReactNode;
  soon?: boolean;
  /** Selectable in principle, but unavailable in this deployment right now. */
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const off = soon || disabled;
  const badge = soon ? "Coming soon" : disabled ? disabledLabel : undefined;
  return (
    <button
      type="button"
      disabled={off}
      onClick={off ? undefined : onClick}
      style={{ animationDelay: `${delay * 60}ms` }}
      className={`create-tile create-hud-tile rounded-2xl border px-5 py-4 text-left transition-colors ${
        off
          ? "cursor-not-allowed border-surface-2 bg-surface/60 opacity-60"
          : active
            ? "is-on border-primary bg-primary/15"
            : "border-surface-2 bg-surface hover:border-primary/40"
      }`}
    >
      {glyph ? (
        <span
          className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${
            active ? "bg-primary text-[#04201e]" : "bg-black/40 text-primary"
          }`}
        >
          {glyph}
        </span>
      ) : null}
      <span className="flex flex-wrap items-center gap-2">
        <span
          className={`font-display text-xl leading-none ${
            off ? "text-white/70" : active ? "text-primary" : "text-white"
          }`}
        >
          {title}
        </span>
        {badge ? (
          <span className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
            {badge}
          </span>
        ) : null}
      </span>
      <p className="mt-2 text-sm text-body">{blurb}</p>
    </button>
  );
}

function ChoiceChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-5 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-surface-2 bg-surface text-body hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}

function LoadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </span>
      <span className="truncate text-right text-white">{value}</span>
    </li>
  );
}

const ARENA_PREVIEW = 6;

function arenaGames(games: Game[], selected: string, query: string): Game[] {
  const q = query.trim().toLowerCase();
  if (q) {
    return games.filter((game) => game.name.toLowerCase().includes(q));
  }
  const head = games.slice(0, ARENA_PREVIEW);
  if (!selected || head.some((game) => game.name === selected)) return head;
  const picked = games.find((game) => game.name === selected);
  if (!picked) return head;
  return [...head.slice(0, ARENA_PREVIEW - 1), picked];
}

function GameStep({
  games,
  kinds,
  catalogKind,
  onKind,
  loaded,
  selected,
  covers,
  onPick,
}: {
  games: Game[];
  kinds: CatalogKind[];
  catalogKind: string;
  onKind: (slug: string) => void;
  loaded: boolean;
  selected: string;
  covers: { id: string; label: string; url: string }[];
  onPick: (game: Game) => void;
}) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const shown = arenaGames(games, selected, query);
  const kindLabel =
    kinds.find((k) => k.slug === catalogKind)?.label ?? "Games";
  const noun = catalogKind === GAMES_KIND ? "game" : kindLabel.toLowerCase();

  return (
    <div>
      <SectionTitle
        kicker="Catalog"
        title={
          catalogKind === GAMES_KIND
            ? "Choose a game"
            : catalogKind === SPORTS_KIND
              ? "Choose a sport"
              : `Choose ${kindLabel.toLowerCase()}`
        }
      />
      {kinds.length > 1 ? (
        <div className="mt-6 flex flex-wrap gap-2" {...helpTarget("create-kinds")}>
          {kinds.map((kind) => (
            <ChoiceChip
              key={kind.slug}
              label={kind.label}
              active={catalogKind === kind.slug}
              onClick={() => onKind(kind.slug)}
            />
          ))}
        </div>
      ) : null}
      {loaded && games.length > 0 ? (
        <div className="mt-6 max-w-md">
          <Input
            placeholder={`Search ${noun}s`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${noun}s`}
          />
          {searching || games.length > ARENA_PREVIEW ? (
            <p className="mt-2 text-xs text-body">
              {searching
                ? shown.length === 1
                  ? "1 match."
                  : `${shown.length} matches.`
                : `Showing ${shown.length} of ${games.length}. Search to find any ${noun}.`}
            </p>
          ) : null}
        </div>
      ) : null}
      {!loaded ? (
        <Loader label={`Loading ${noun}s`} />
      ) : games.length === 0 ? (
        <p className="mt-6 text-sm text-body">
          No {noun}s available now.
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm text-body">No {noun}s match that name.</p>
      ) : (
        <div
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"
          {...helpTarget("create-pick")}
        >
          {shown.map((game, i) => {
            const on = selected === game.name;
            const art = game.image || iconForGame(game.name, covers);
            return (
              <button
                key={game.game_id || game._id}
                type="button"
                onClick={() => onPick(game)}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`create-tile create-game-card rounded-2xl border text-left ${
                  on
                    ? "is-on border-primary"
                    : "border-surface-2 hover:border-primary/50"
                }`}
              >
                <span className="create-loadout-art relative block aspect-4/3 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={art}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {on ? <span className="create-scanline z-10" /> : null}
                </span>
                <span className="flex items-center justify-between gap-2 px-3 py-3">
                  <span className="truncate font-display text-lg leading-none text-white">
                    {game.name}
                  </span>
                  {on ? (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Locked
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeGlyph({
  kind,
}: {
  kind: "knockout" | "groups" | "league" | "br";
}) {
  const cls = "h-6 w-6";
  if (kind === "knockout") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 5h6v4H4zM14 5h6v4h-6zM9 15h6v4H9z" />
        <path d="M7 9v2h10V9M12 11v4" />
      </svg>
    );
  }
  if (kind === "groups") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    );
  }
  if (kind === "league") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 6h14M5 12h14M5 18h10" />
        <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={cls}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

