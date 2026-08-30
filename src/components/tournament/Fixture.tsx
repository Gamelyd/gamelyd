"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DateInput, TimeInput } from "@/components/ui/DateTimePicker";
import { useToast } from "@/components/ui/Toast";
import {
  addLinkAction,
  addScoreAction,
  addTimeAction,
  addWinnerAction,
  setDrawVenueAction,
  updateBrDrawAction,
} from "@/server/actions/drawActions";
import { PlaceSearch } from "@/components/ui/PlaceSearch";
import type { TournamentVenue } from "@/lib/schemas/tournament";
import { venueMapsUrl } from "@/lib/venue";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import {
  isSoloVerified,
  PlayerNameList,
  VerifiedName,
} from "@/components/ui/VerifiedName";
import { leagueMatchdayLabel } from "@/lib/leagueStandings";
import { isKnockoutBye } from "@/lib/knockoutSeed";
import {
  lastPlayedInTie,
  legCaption,
  formatForSeriesGames,
  tieNeedsHostPick,
} from "@/lib/knockoutSeries";
import type { KnockoutFormat } from "@/lib/schemas/common";

function scoreTone(
  self: number,
  other: number,
): "win" | "lose" | "draw" {
  if (self > other) return "win";
  if (self < other) return "lose";
  return "draw";
}

const scoreBadge: Record<"win" | "lose" | "draw" | "idle", string> = {
  win: "bg-win text-[#04201e]",
  lose: "bg-lose text-white",
  draw: "bg-yellow text-[#221a00]",
  // Not played yet: neutral, so an unscored match never looks like a 0-0 draw.
  idle: "bg-surface-2 text-body",
};

type EditMode = "score" | "time" | "link" | "venue" | null;

export function Fixture({
  draw,
  canManage,
  onUpdated,
  knockoutFormat,
  seriesGames,
  hostPicksLevel,
  eventVenues = [],
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
  knockoutFormat?: KnockoutFormat;
  seriesGames?: Draw[];
  hostPicksLevel?: boolean;
  /** The tournament's own venues, offered as one-tap picks. */
  eventVenues?: TournamentVenue[];
}) {
  if (draw.BRTeams.length > 0) {
    return <BrFixture draw={draw} canManage={canManage} onUpdated={onUpdated} />;
  }
  return (
    <MpFixture
      draw={draw}
      canManage={canManage}
      onUpdated={onUpdated}
      knockoutFormat={knockoutFormat}
      seriesGames={seriesGames}
      hostPicksLevel={hostPicksLevel}
      eventVenues={eventVenues}
    />
  );
}

function MpFixture({
  draw,
  canManage,
  onUpdated,
  knockoutFormat,
  seriesGames,
  hostPicksLevel,
  eventVenues = [],
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
  knockoutFormat?: KnockoutFormat;
  seriesGames?: Draw[];
  hostPicksLevel?: boolean;
  eventVenues?: TournamentVenue[];
}) {
  const toast = useToast();
  const [mode, setMode] = useState<EditMode>(null);
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [time, setTime] = useState(draw.Time);
  const [date, setDate] = useState(draw.Date);
  const [link, setLink] = useState(draw.Link);
  const [saving, setSaving] = useState(false);

  const autoBye = isKnockoutBye(draw);
  const tieGames = seriesGames?.length ? seriesGames : [draw];
  const seriesFormat = formatForSeriesGames(tieGames, knockoutFormat);
  const seriesLabel = legCaption(draw, seriesFormat);
  const pickSurface = lastPlayedInTie(tieGames);
  const needsWinner =
    Boolean(hostPicksLevel) &&
    !autoBye &&
    pickSurface?.DrawId === draw.DrawId &&
    tieNeedsHostPick(tieGames, seriesFormat);

  const pickWinner = async (side: "Team1" | "Team2") => {
    setSaving(true);
    const result = await addWinnerAction(draw.DrawId, { Winner: side });
    setSaving(false);
    if (result.ok) {
      toast.success("Winner set");
      onUpdated(result.data);
    } else {
      toast.error(result.error);
    }
  };
  const t1 = draw.Team1;
  const t2 = draw.Team2;
  const played = Boolean(draw.Played);
  const tone1 = played ? scoreTone(draw.Team1Score, draw.Team2Score) : "idle";
  const tone2 = played ? scoreTone(draw.Team2Score, draw.Team1Score) : "idle";

  const beginScoreEdit = () => {
    setTeam1(draw.Played ? String(draw.Team1Score) : "");
    setTeam2(draw.Played ? String(draw.Team2Score) : "");
    setMode("score");
  };

  const saveScore = async () => {
    setSaving(true);
    const result = await addScoreAction(draw.DrawId, {
      Team1: team1.trim() === "" ? 0 : Number(team1),
      Team2: team2.trim() === "" ? 0 : Number(team2),
      Winner: "",
      TournamentId: draw.TournamentId,
      WinnerTeam: "",
      IsFinal: "",
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Score added");
      onUpdated(result.data);
      setMode(null);
    } else {
      toast.error(result.error);
    }
  };

  const saveTime = async () => {
    if (!date || !time) {
      toast.error("Set both date and time");
      return;
    }
    setSaving(true);
    const result = await addTimeAction(draw.DrawId, { Time: time, Date: date });
    setSaving(false);
    if (result.ok) {
      toast.success("Time added");
      onUpdated(result.data);
      setMode(null);
    } else {
      toast.error(result.error);
    }
  };

  // Coordinates give an exact pin; otherwise fall back to a text search.
  const mapsUrl = draw.VenueName
    ? venueMapsUrl({
        country: draw.VenueCountry,
        location: draw.VenueName,
        lat: draw.VenueLat,
        lng: draw.VenueLng,
      })
    : undefined;

  const saveVenue = async (venue: {
    VenueName: string;
    VenueCountry: string;
    VenueLat: number;
    VenueLng: number;
  }) => {
    setSaving(true);
    const result = await setDrawVenueAction(draw.DrawId, venue);
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Location saved");
      onUpdated(result.data);
      setMode(null);
    } else {
      toast.error(result.error);
    }
  };

  const saveLink = async () => {
    if (!link.trim()) {
      toast.error("Paste a match link");
      return;
    }
    setSaving(true);
    const result = await addLinkAction(draw.DrawId, { Link: link.trim() });
    setSaving(false);
    if (result.ok) {
      toast.success("Link added");
      onUpdated(result.data);
      setMode(null);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div
      className={`relative w-full max-w-md rounded-2xl border p-3 sm:p-4 ${
        !played && !autoBye
          ? "border-primary/40 bg-primary/[0.05]"
          : "border-surface-2 bg-surface"
      }`}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2 pr-9">
        {!autoBye ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              played
                ? "bg-win/15 text-win"
                : "bg-yellow/15 text-yellow"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                played ? "bg-win" : "animate-pulse bg-yellow"
              }`}
              aria-hidden
            />
            {played ? "Final" : "Not played"}
          </span>
        ) : null}
        {seriesLabel || draw.Kind === "THIRD_PLACE" ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {draw.Kind === "THIRD_PLACE"
              ? seriesLabel
                ? `Third place · ${seriesLabel}`
                : "Third place"
              : seriesLabel}
          </span>
        ) : null}
      </div>

      {canManage && !autoBye ? (
        <ManageMenu
          hasVenue={Boolean(draw.VenueName)}
          onSelect={(next) => {
            if (next === "score") beginScoreEdit();
            else setMode(next);
          }}
        />
      ) : null}

      {autoBye ? (
        <div className="flex items-center justify-between gap-3">
          <TeamRow team={t1} showScore={false} />
          <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Auto qualified
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <TeamRow
            team={t1}
            score={draw.Team1Score}
            played={played}
            tone={tone1}
            onScoreClick={canManage ? beginScoreEdit : undefined}
          />
          <TeamRow
            team={t2}
            score={draw.Team2Score}
            played={played}
            tone={tone2}
            onScoreClick={canManage ? beginScoreEdit : undefined}
          />
        </div>
      )}

      {canManage && needsWinner ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-center text-xs text-body">
            {seriesFormat === "TWO_LEG"
              ? "Level on aggregate. Pick who goes through"
              : "Level score. Pick who goes through"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              loading={saving}
              onClick={() => void pickWinner("Team1")}
            >
              {t1?.TeamName || "Team 1"} wins
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              loading={saving}
              onClick={() => void pickWinner("Team2")}
            >
              {t2?.TeamName || "Team 2"} wins
            </Button>
          </div>
        </div>
      ) : null}

      {!autoBye ? (
        <div className="mt-3 border-t border-surface-2 pt-3">
          {mode === "time" ? (
            <div className="flex flex-wrap items-end gap-2">
              <DateInput
                label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <TimeInput
                label="Time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <Button loading={saving} onClick={saveTime}>
                Save
              </Button>
              <Button type="button" variant="dark" onClick={() => setMode(null)}>
                Cancel
              </Button>
            </div>
          ) : mode === "link" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                label="Match link"
                placeholder="paste game room link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="flex-1"
              />
              <Button loading={saving} onClick={saveLink}>
                Save
              </Button>
              <Button type="button" variant="dark" onClick={() => setMode(null)}>
                Cancel
              </Button>
            </div>
          ) : mode === "venue" ? (
            <div className="flex flex-col gap-3 text-left">
              {eventVenues.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-sm text-label">
                    Use a venue from this event
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {eventVenues.map((venue, i) => (
                      <button
                        key={`${venue.location}-${i}`}
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void saveVenue({
                            VenueName: venue.location,
                            VenueCountry: venue.country,
                            VenueLat: venue.lat,
                            VenueLng: venue.lng,
                          })
                        }
                        className="cursor-pointer rounded-lg border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/20 disabled:opacity-60"
                      >
                        {venue.location}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <PlaceSearch
                label={
                  eventVenues.length > 0 ? "Or search somewhere else" : "Location"
                }
                value=""
                disabled={saving}
                placeholder="Search a stadium, pitch, or address"
                onSelect={(place) =>
                  void saveVenue({
                    VenueName: place.label,
                    VenueCountry: place.country,
                    VenueLat: place.lat,
                    VenueLng: place.lng,
                  })
                }
              />
              <div className="flex gap-2">
                {draw.VenueName ? (
                  <Button
                    type="button"
                    variant="dark"
                    loading={saving}
                    onClick={() =>
                      void saveVenue({
                        VenueName: "",
                        VenueCountry: "",
                        VenueLat: 0,
                        VenueLng: 0,
                      })
                    }
                  >
                    Clear location
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : mode === "score" ? (
            <div className="flex flex-wrap items-end justify-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                label={t1?.TeamName || "Team 1"}
                value={team1}
                placeholder="0"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setTeam1(e.target.value.replace(/[^\d]/g, ""))}
                className="w-24"
              />
              <Input
                type="text"
                inputMode="numeric"
                label={t2?.TeamName || "Team 2"}
                value={team2}
                placeholder="0"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setTeam2(e.target.value.replace(/[^\d]/g, ""))}
                className="w-24"
              />
              <Button
                loading={saving}
                onClick={saveScore}
                className="bg-win text-[#04201e] hover:bg-win"
              >
                Save
              </Button>
              <Button type="button" variant="dark" onClick={() => setMode(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <MetaChip>{draw.Date || "Date TBD"}</MetaChip>
              <MetaChip>{draw.Time ? `${draw.Time} (WAT)` : "Time TBD"}</MetaChip>
              {draw.VenueName ? (
                mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-[55%] items-center gap-1 truncate rounded-md bg-surface-2 px-2 py-1 text-[11px] text-primary hover:bg-surface-3"
                    title={draw.VenueName}
                  >
                    <MapPin />
                    <span className="truncate">{draw.VenueName}</span>
                  </a>
                ) : (
                  <MetaChip title={draw.VenueName}>{draw.VenueName}</MetaChip>
                )
              ) : null}
              {draw.Link ? (
                <a
                  href={draw.Link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md bg-cyan/15 px-2 py-1 text-[11px] font-semibold text-cyan hover:bg-cyan/25"
                >
                  Join match
                </a>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MetaChip({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex max-w-[55%] items-center truncate rounded-md bg-surface-2 px-2 py-1 text-[11px] text-body"
    >
      {children}
    </span>
  );
}

function MapPin() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
    </svg>
  );
}

function TeamRow({
  team,
  score = 0,
  played = true,
  tone = "idle",
  showScore = true,
  onScoreClick,
}: {
  team?: Teams;
  score?: number;
  played?: boolean;
  tone?: "win" | "lose" | "draw" | "idle";
  showScore?: boolean;
  onScoreClick?: () => void;
}) {
  const name = team?.TeamName || "TBD";
  const isWin = played && tone === "win";
  const isLose = played && tone === "lose";
  const badge = (
    <span
      className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-1.5 font-display text-base leading-none ${
        played ? scoreBadge[tone] : "bg-surface-2 text-body"
      }`}
    >
      {played ? score : " "}
    </span>
  );
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${
        isWin ? "bg-win/10" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveIcon(team?.Icon, FALLBACKS.team)}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full bg-primary object-cover ring-1 ring-black/30"
      />
      <span
        className={`min-w-0 flex-1 truncate font-display text-[15px] leading-tight ${
          isLose ? "text-body" : "text-white"
        }`}
      >
        <VerifiedName name={name} verified={isSoloVerified(team?.Players)} />
      </span>
      {showScore ? (
        onScoreClick ? (
          <button type="button" onClick={onScoreClick} aria-label="Edit score">
            {badge}
          </button>
        ) : (
          badge
        )
      ) : null}
    </div>
  );
}

function ManageMenu({
  onSelect,
  hasVenue = false,
}: {
  onSelect: (mode: "score" | "time" | "link" | "venue") => void;
  hasVenue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={root} className="absolute right-0 top-0 z-40">
      <button
        type="button"
        aria-label="Fixture actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow text-on-primary shadow-lg ring-2 ring-black/30 hover:bg-yellow-soft"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="2.25" />
          <circle cx="12" cy="12" r="2.25" />
          <circle cx="12" cy="19" r="2.25" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-10 min-w-[160px] overflow-hidden rounded-lg border border-surface-2 bg-surface py-1 shadow-xl">
          {(
            [
              ["score", "Add score"],
              ["time", "Add time"],
              ["venue", hasVenue ? "Change location" : "Add location"],
              ["link", "Add match link"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                onSelect(value);
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-white hover:bg-surface-2"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrFixture({
  draw,
  canManage,
  onUpdated,
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(draw.Link);
  const [date, setDate] = useState(draw.Date);
  const [time, setTime] = useState(draw.Time);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(draw.BRTeams);

  const saveResults = async () => {
    setSaving(true);
    const result = await updateBrDrawAction(draw.DrawId, {
      Players: rows,
      Link: link,
      Date: date,
      Time: time,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Lobby result saved");
      onUpdated(result.data);
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  };

  const saveMeta = async () => {
    await saveResults();
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-xl border border-surface-2 bg-[#06252c] p-5">
      {canManage && (
        <ManageMenu
          onSelect={() => {
            setRows(draw.BRTeams);
            setOpen(true);
          }}
        />
      )}
      <h4 className="mb-1 text-center font-display text-xl text-white">
        Lobby {draw.Stage}
      </h4>
      {draw.Played ? (
        <p className="mb-4 text-center text-xs uppercase tracking-wide text-primary">
          Result in
        </p>
      ) : (
        <p className="mb-4 text-center text-xs text-body">Awaiting placement</p>
      )}
      <ul className="divide-y divide-white/10">
        {(open ? rows : draw.BRTeams).map((team, i) => (
          <li key={`${team.TeamName}-${i}`} className="flex flex-col gap-2 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-deep font-display text-sm text-white">
                {team.Placement || i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-none text-white">
                  {team.TeamName}
                </p>
                <p className="mt-1 text-xs text-body">
                  <PlayerNameList players={team.Players} />
                  {!open && team.Kills
                    ? ` · ${team.Kills} kill${team.Kills === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            </div>
            {canManage && open ? (
              <div className="grid grid-cols-3 gap-2 pl-11">
                <Input
                  type="number"
                  min={1}
                  max={draw.BRTeams.length}
                  label="Place"
                  value={team.Placement || ""}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = {
                      ...team,
                      Placement: Number(e.target.value) || 0,
                    };
                    setRows(next);
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  label="Kills"
                  value={team.Kills}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...team, Kills: Number(e.target.value) || 0 };
                    setRows(next);
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  label="First bloods"
                  value={team.FirstBloods}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = {
                      ...team,
                      FirstBloods: Number(e.target.value) || 0,
                    };
                    setRows(next);
                  }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 text-sm font-bold text-white">
        <span>{draw.Date || "Date TBD"}</span>
        <span className="text-white/40">|</span>
        <span>{draw.Time ? `${draw.Time} (WAT)` : "Time TBD"}</span>
        {draw.Link ? (
          <a
            href={draw.Link}
            target="_blank"
            rel="noreferrer"
            className="text-cyan hover:underline"
          >
            Join match
          </a>
        ) : null}
      </div>
      {canManage && open && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
          <DateInput
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <TimeInput
            label="Time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <Input
            label="Match link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <div className="sm:col-span-3">
            <Button loading={saving} onClick={saveMeta}>
              Save result
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function roundLabel(
  matchCount: number,
  stage: number,
  mode?: string,
): string {
  if (mode === "BATTLEROYALE") return `LOBBY ${stage}`;
  if (mode === "LEAGUE") return leagueMatchdayLabel(stage);
  if (matchCount < 2) return "FINALS";
  if (matchCount < 3) return "SEMI FINALS";
  if (matchCount < 5) return "QUARTER FINALS";
  if (matchCount < 9) return "ROUND OF SIXTEEN";
  return `ROUND ${stage}`;
}
