"use client";

import { useEffect, useRef, useState } from "react";
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
  updateBrDrawAction,
} from "@/server/actions/drawActions";
import { FALLBACKS, UI_ICONS, resolveIcon } from "@/lib/icons";
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

const scoreClass: Record<"win" | "lose" | "draw", string> = {
  win: "bg-win",
  lose: "bg-lose",
  draw: "bg-yellow",
};

type EditMode = "score" | "time" | "link" | null;

export function Fixture({
  draw,
  canManage,
  onUpdated,
  knockoutFormat,
  seriesGames,
  hostPicksLevel,
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
  knockoutFormat?: KnockoutFormat;
  seriesGames?: Draw[];
  hostPicksLevel?: boolean;
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
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
  knockoutFormat?: KnockoutFormat;
  seriesGames?: Draw[];
  hostPicksLevel?: boolean;
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
  const tone1 = scoreTone(draw.Team1Score, draw.Team2Score);
  const tone2 = scoreTone(draw.Team2Score, draw.Team1Score);

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
    <div className="relative flex w-full max-w-[720px] flex-col items-center px-2 py-6">
      {seriesLabel ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {draw.Kind === "THIRD_PLACE" ? `Third place · ${seriesLabel}` : seriesLabel}
        </p>
      ) : draw.Kind === "THIRD_PLACE" ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Third place
        </p>
      ) : null}
      {canManage && !autoBye && (
        <ManageMenu
          onSelect={(next) => {
            if (next === "score") beginScoreEdit();
            else setMode(next);
          }}
        />
      )}

      {autoBye ? (
        <div className="flex w-full max-w-[720px] flex-col items-center gap-3">
          <TeamFace team={t1} score={0} tone="win" side="left" showScore={false} />
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            Auto qualified
          </span>
        </div>
      ) : (
      <div className="flex w-full max-w-[720px] flex-col items-center justify-center gap-3 md:flex-row md:gap-0">
        <TeamFace
          team={t1}
          score={draw.Team1Score}
          tone={tone1}
          side="left"
          editable={canManage && !autoBye}
          onScoreClick={beginScoreEdit}
        />

        <div
          className="z-20 h-[60px] w-[60px] shrink-0 bg-contain bg-center bg-no-repeat md:-mx-3"
          style={{ backgroundImage: `url("${UI_ICONS.vs}")` }}
          aria-hidden
        />

        <TeamFace
          team={t2}
          score={draw.Team2Score}
          tone={tone2}
          side="right"
          editable={canManage && !autoBye}
          onScoreClick={beginScoreEdit}
        />
      </div>
      )}

      {canManage && needsWinner ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <p className="w-full text-center text-xs text-body">
            {seriesFormat === "TWO_LEG"
              ? "Level on aggregate. Pick who goes through"
              : "Level score. Pick who goes through"}
          </p>
          <Button
            type="button"
            loading={saving}
            onClick={() => void pickWinner("Team1")}
          >
            {t1?.TeamName || "Team 1"} wins
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={saving}
            onClick={() => void pickWinner("Team2")}
          >
            {t2?.TeamName || "Team 2"} wins
          </Button>
        </div>
      ) : null}

      {!autoBye && (
      <div className="mt-4 flex min-h-6 flex-wrap items-center justify-center gap-x-4 text-[15.5px] font-bold text-white">
        {mode === "time" ? (
          <div className="flex flex-wrap items-end justify-center gap-2">
            <DateInput
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="py-2"
            />
            <TimeInput
              label="Time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="py-2"
            />
            <Button loading={saving} onClick={saveTime}>
              Save
            </Button>
          </div>
        ) : mode === "link" ? (
          <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label="Match link"
              placeholder="paste game room link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="py-2"
            />
            <Button loading={saving} onClick={saveLink}>
              Save
            </Button>
            {link.trim() ? (
              <a href={link.trim()} target="_blank" rel="noreferrer">
                <Button variant="outline" type="button">
                  Open
                </Button>
              </a>
            ) : null}
          </div>
        ) : mode === "score" ? (
          <div className="flex flex-wrap items-end justify-center gap-3">
            <Input
              type="text"
              inputMode="numeric"
              label={t1?.TeamName || "Team 1"}
              value={team1}
              placeholder="0"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setTeam1(e.target.value.replace(/[^\d]/g, ""))
              }
              className="w-28 py-2"
            />
            <Input
              type="text"
              inputMode="numeric"
              label={t2?.TeamName || "Team 2"}
              value={team2}
              placeholder="0"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setTeam2(e.target.value.replace(/[^\d]/g, ""))
              }
              className="w-28 py-2"
            />
            <Button loading={saving} onClick={saveScore} className="bg-win text-[#04201e] hover:bg-win">
              Save
            </Button>
          </div>
        ) : (
          <>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setDate(draw.Date);
                  setTime(draw.Time);
                  setMode("time");
                }}
                className="cursor-pointer hover:text-primary"
              >
                {draw.Date || "Date TBD"}
              </button>
            ) : (
              <span>{draw.Date || "Date TBD"}</span>
            )}
            <span className="text-white/40">|</span>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setDate(draw.Date);
                  setTime(draw.Time);
                  setMode("time");
                }}
                className="cursor-pointer hover:text-primary"
              >
                {draw.Time ? `${draw.Time} (WAT)` : "Time TBD"}
              </button>
            ) : (
              <span>{draw.Time ? `${draw.Time} (WAT)` : "Time TBD"}</span>
            )}
            {draw.Link || canManage ? (
              <>
                <span className="text-white/40">|</span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLink(draw.Link);
                      setMode("link");
                    }}
                    className="cursor-pointer text-cyan hover:underline"
                  >
                    {draw.Link ? "Join match" : "Add link"}
                  </button>
                ) : (
                  <a
                    href={draw.Link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan hover:underline"
                  >
                    Join match
                  </a>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
      )}
    </div>
  );
}

function TeamFace({
  team,
  score,
  tone,
  side,
  editable = false,
  showScore = true,
  onScoreClick,
}: {
  team?: Teams;
  score: number;
  tone: "win" | "lose" | "draw";
  side: "left" | "right";
  editable?: boolean;
  showScore?: boolean;
  onScoreClick?: () => void;
}) {
  const name = team?.TeamName || "TBD";
  const scoreBadge = (
    <span
      className={`shrink-0 rounded-[5px] px-2.5 py-1 font-display text-[20px] leading-none text-white ${scoreClass[tone]} ${
        editable ? "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-white/70" : ""
      } ${side === "left" ? "ml-2" : "mr-2"}`}
    >
      {score}
    </span>
  );
  const scoreControl = editable ? (
    <button type="button" onClick={onScoreClick} aria-label="Update score">
      {scoreBadge}
    </button>
  ) : (
    scoreBadge
  );
  const avatar = (
    <div
      className="relative z-10 flex h-[100px] w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[7px] border-surface-3 bg-primary"
      role="img"
      aria-label={name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveIcon(team?.Icon, FALLBACKS.team)}
        alt=""
        className="h-full w-full rounded-full object-cover"
      />
    </div>
  );
  const bar = (
    <div
      className={`flex h-12 min-w-0 flex-1 items-center justify-between border-[2.7px] border-surface-3 bg-white md:w-[265px] md:flex-none ${
        side === "left"
          ? "rounded-r-[20px] pl-12 pr-3 md:-ml-10 md:rounded-none"
          : "rounded-l-[20px] pl-3 pr-12 md:-mr-10 md:rounded-none"
      }`}
    >
      {side === "left" ? (
        <>
          <span className="inline-flex min-w-0 items-center gap-1 truncate font-display text-[20px] leading-none text-surface-3">
            <VerifiedName name={name} verified={isSoloVerified(team?.Players)} />
          </span>
          {showScore ? scoreControl : null}
        </>
      ) : (
        <>
          {showScore ? scoreControl : null}
          <span className="inline-flex min-w-0 items-center justify-end gap-1 truncate text-right font-display text-[20px] leading-none text-surface-3">
            <VerifiedName name={name} verified={isSoloVerified(team?.Players)} />
          </span>
        </>
      )}
    </div>
  );

  return (
    <div className="flex w-full max-w-[340px] items-center md:w-auto">
      {side === "left" ? (
        <>
          {avatar}
          {bar}
        </>
      ) : (
        <>
          {bar}
          {avatar}
        </>
      )}
    </div>
  );
}

function ManageMenu({
  onSelect,
}: {
  onSelect: (mode: "score" | "time" | "link") => void;
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
