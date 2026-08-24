"use client";

import { useEffect, useRef, useState } from "react";
import type { Draw, Teams } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  addLinkAction,
  addScoreAction,
  addTimeAction,
} from "@/server/actions/drawActions";
import { FALLBACKS, UI_ICONS, resolveIcon } from "@/lib/icons";
import { leagueMatchdayLabel } from "@/lib/leagueStandings";

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
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
}) {
  if (draw.BRTeams.length > 0) {
    return <BrFixture draw={draw} canManage={canManage} onUpdated={onUpdated} />;
  }
  return <MpFixture draw={draw} canManage={canManage} onUpdated={onUpdated} />;
}

function MpFixture({
  draw,
  canManage,
  onUpdated,
}: {
  draw: Draw;
  canManage: boolean;
  onUpdated: (draw: Draw) => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<EditMode>(null);
  const [team1, setTeam1] = useState(draw.Team1Score);
  const [team2, setTeam2] = useState(draw.Team2Score);
  const [time, setTime] = useState(draw.Time);
  const [date, setDate] = useState(draw.Date);
  const [link, setLink] = useState(draw.Link);
  const [saving, setSaving] = useState(false);

  const autoBye = draw.Team2?.TeamName === "Automatic Qualification";
  const t1 = draw.Team1;
  const t2 = draw.Team2;
  const tone1 = scoreTone(draw.Team1Score, draw.Team2Score);
  const tone2 = scoreTone(draw.Team2Score, draw.Team1Score);

  const saveScore = async () => {
    setSaving(true);
    const result = await addScoreAction(draw.DrawId, {
      Team1: team1,
      Team2: team2,
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
      {canManage && !autoBye && (
        <ManageMenu
          onSelect={(next) => {
            setMode(next);
          }}
        />
      )}

      <div className="flex w-full max-w-[720px] flex-col items-center justify-center gap-3 md:flex-row md:gap-0">
        <TeamFace
          team={t1}
          score={draw.Team1Score}
          tone={tone1}
          side="left"
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
        />
      </div>

      <div className="mt-4 flex min-h-6 flex-wrap items-center justify-center gap-x-4 text-[15.5px] font-bold text-white">
        {mode === "time" ? (
          <div className="flex flex-wrap items-end justify-center gap-2">
            <Input
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="py-2"
            />
            <Input
              type="time"
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
          </div>
        ) : mode === "score" ? (
          <div className="flex flex-wrap items-end justify-center gap-3">
            <Input
              type="number"
              label={t1?.TeamName || "Team 1"}
              value={team1}
              onChange={(e) => setTeam1(Number(e.target.value))}
              className="w-28 py-2"
            />
            <Input
              type="number"
              label={t2?.TeamName || "Team 2"}
              value={team2}
              onChange={(e) => setTeam2(Number(e.target.value))}
              className="w-28 py-2"
            />
            <Button loading={saving} onClick={saveScore} className="bg-win text-[#04201e] hover:bg-win">
              Save
            </Button>
          </div>
        ) : (
          <>
            <span>{draw.Date || "Date TBD"}</span>
            <span className="text-white/40">|</span>
            <span>{draw.Time ? `${draw.Time} (WAT)` : "Time TBD"}</span>
            {draw.Link ? (
              <>
                <span className="text-white/40">|</span>
                <a
                  href={draw.Link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan hover:underline"
                >
                  Join match
                </a>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function TeamFace({
  team,
  score,
  tone,
  side,
}: {
  team?: Teams;
  score: number;
  tone: "win" | "lose" | "draw";
  side: "left" | "right";
}) {
  const name = team?.TeamName || "TBD";
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
        className="h-full w-full object-contain p-2.5"
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
          <span className="min-w-0 truncate font-display text-[20px] leading-none text-surface-3">
            {name}
          </span>
          <span
            className={`ml-2 shrink-0 rounded-[5px] px-2.5 py-1 font-display text-[20px] leading-none text-white ${scoreClass[tone]}`}
          >
            {score}
          </span>
        </>
      ) : (
        <>
          <span
            className={`mr-2 shrink-0 rounded-[5px] px-2.5 py-1 font-display text-[20px] leading-none text-white ${scoreClass[tone]}`}
          >
            {score}
          </span>
          <span className="min-w-0 truncate text-right font-display text-[20px] leading-none text-surface-3">
            {name}
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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow text-[#242e39] shadow-lg ring-2 ring-black/30 hover:bg-yellow-soft"
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

  const saveMeta = async () => {
    setSaving(true);
    if (date && time) {
      const timed = await addTimeAction(draw.DrawId, { Time: time, Date: date });
      if (!timed.ok) {
        setSaving(false);
        toast.error(timed.error);
        return;
      }
      onUpdated(timed.data);
    }
    if (link.trim()) {
      const linked = await addLinkAction(draw.DrawId, { Link: link.trim() });
      if (!linked.ok) {
        setSaving(false);
        toast.error(linked.error);
        return;
      }
      onUpdated(linked.data);
    }
    setSaving(false);
    toast.success("Fixture updated");
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-xl border border-surface-2 bg-[#06252c] p-5">
      {canManage && (
        <ManageMenu
          onSelect={() => {
            setOpen(true);
          }}
        />
      )}
      <h4 className="mb-4 text-center font-display text-xl text-white">
        Battle Royale lobby
      </h4>
      <ul className="divide-y divide-white/10">
        {draw.BRTeams.map((team, i) => (
          <li key={`${team.TeamName}-${i}`} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-deep font-display text-sm text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg leading-none text-white">
                {team.TeamName}
              </p>
              <p className="mt-1 text-xs text-body">
                {team.Players.map((p) => p.UserName).filter(Boolean).join(" · ") ||
                  "No players listed"}
              </p>
            </div>
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
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            type="time"
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
              Save
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
  if (mode === "LEAGUE") return leagueMatchdayLabel(stage);
  if (matchCount < 2) return "FINALS";
  if (matchCount < 3) return "SEMI FINALS";
  if (matchCount < 5) return "QUARTER FINALS";
  if (matchCount < 9) return "ROUND OF SIXTEEN";
  return `ROUND ${stage}`;
}
