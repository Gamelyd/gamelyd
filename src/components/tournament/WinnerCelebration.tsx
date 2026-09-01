"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Teams } from "@/lib/schemas/draw";
import type { Podium } from "@/lib/podium";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";
import { VerifiedName } from "@/components/ui/VerifiedName";

const CONFETTI_COLORS = ["#f6c945", "#2dd4bf", "#ffffff", "#f472b6", "#a78bfa"];
const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  left: (i * 97) % 100,
  delay: `${(i % 13) * 0.16}s`,
  duration: `${2.6 + (i % 6) * 0.45}s`,
  drift: `${((i % 7) - 3) * 26}px`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  w: 6 + (i % 3) * 2,
  h: 10 + (i % 4) * 3,
  round: i % 3 === 0,
}));

const PODIUM_META = {
  1: { color: "#f6c945", label: "Champion", crest: 84, bar: 100 },
  2: { color: "#cbd5e1", label: "Runner-up", crest: 62, bar: 68 },
  3: { color: "#cd7f32", label: "Third", crest: 62, bar: 50 },
} as const;

export function WinnerCelebration({
  podium,
  tournamentName,
  gameName,
  onClose,
}: {
  podium: Podium;
  tournamentName: string;
  gameName: string;
  onClose: () => void;
}) {
  const { first, second, third } = podium;
  const hasPodium = Boolean(second || third);
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  const podiumCols: Array<{ team: Teams; place: 1 | 2 | 3 }> = [];
  if (second) podiumCols.push({ team: second, place: 2 });
  podiumCols.push({ team: first, place: 1 });
  if (third) podiumCols.push({ team: third, place: 3 });

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-center justify-center overflow-hidden bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="champion-title"
      onClick={onClose}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[72vmin] w-[72vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow/20 blur-3xl"
        style={{ animation: "champ-glow 3s ease-in-out infinite" }}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="champ-confetti-piece absolute top-0 block"
            style={
              {
                left: `${c.left}%`,
                width: c.w,
                height: c.h,
                backgroundColor: c.color,
                borderRadius: c.round ? "9999px" : "2px",
                "--drift": c.drift,
                animation: `champ-confetti ${c.duration} linear ${c.delay} infinite`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="relative w-full max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {hasPodium && !focused ? (
          <div
            className="champ-animate relative overflow-hidden rounded-3xl border border-surface-2 bg-primary-panel p-6 shadow-2xl sm:p-8"
            style={{ animation: "champ-pop .5s cubic-bezier(.2,.8,.2,1) both" }}
          >
            <CloseButton onClose={onClose} />
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-yellow">
              Final standings
            </p>
            <h2
              id="champion-title"
              className="mt-1 text-center font-display text-2xl text-white"
            >
              {tournamentName}
            </h2>
            {gameName ? (
              <p className="mt-1 text-center text-xs text-body">{gameName}</p>
            ) : null}

            <div className="mt-8 flex items-end justify-center gap-3 sm:gap-5">
              {podiumCols.map(({ team, place }) => (
                <PodiumCol key={place} team={team} place={place} />
              ))}
            </div>

            <RosterRow team={first} className="mt-7" label="Champion roster" />

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => setFocused(true)}>
                Champion view
              </Button>
              <Button onClick={onClose}>Enter tournament</Button>
            </div>
          </div>
        ) : (
          <ChampionCard
            team={first}
            tournamentName={tournamentName}
            gameName={gameName}
            onClose={onClose}
            onBack={hasPodium ? () => setFocused(false) : undefined}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function ChampionCard({
  team,
  tournamentName,
  gameName,
  onClose,
  onBack,
}: {
  team: Teams;
  tournamentName: string;
  gameName: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  const crest = resolveIcon(team.Icon, FALLBACKS.team);
  return (
    <div
      className="champ-animate relative overflow-hidden rounded-3xl border border-yellow/30 bg-primary-panel p-8 text-center shadow-2xl"
      style={{ animation: "champ-pop .5s cubic-bezier(.2,.8,.2,1) both" }}
    >
      <CloseButton onClose={onClose} />
      <Trophy />
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-yellow">
        Champion
      </p>

      <div className="relative mx-auto mt-5 h-28 w-28">
        <div
          className="absolute inset-0 rounded-full bg-yellow/30 blur-xl"
          style={{ animation: "champ-glow 2.5s ease-in-out infinite" }}
          aria-hidden
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={crest}
          alt=""
          className="relative h-28 w-28 rounded-full object-cover"
          style={{ boxShadow: "0 0 0 4px #f6c945, 0 0 32px #f6c94577" }}
        />
      </div>

      <h2 id="champion-title" className="mt-5 font-display text-3xl text-white">
        {team.TeamName}
      </h2>
      <RosterRow team={team} className="mt-4" />
      <p className="mt-4 text-sm text-body">
        {[gameName, tournamentName].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            Back to standings
          </Button>
        ) : null}
        <Button onClick={onClose}>View tournament</Button>
      </div>
    </div>
  );
}

function PodiumCol({ team, place }: { team: Teams; place: 1 | 2 | 3 }) {
  const meta = PODIUM_META[place];
  const crest = resolveIcon(team.Icon, FALLBACKS.team);
  return (
    <div className="flex w-full max-w-[8.5rem] flex-1 flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={crest}
        alt=""
        className="rounded-full object-cover"
        style={{
          width: meta.crest,
          height: meta.crest,
          boxShadow: `0 0 0 3px ${meta.color}, 0 0 22px ${meta.color}55`,
        }}
      />
      <p className="mt-2 max-w-full truncate text-center text-sm font-semibold text-white">
        {team.TeamName}
      </p>
      <p
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: meta.color }}
      >
        {meta.label}
      </p>
      <div
        className="mt-2 flex w-full justify-center rounded-t-lg"
        style={{
          height: meta.bar,
          background: `linear-gradient(to bottom, ${meta.color}, ${meta.color}bb)`,
        }}
      >
        <span className="mt-2 font-display text-2xl text-black/70">{place}</span>
      </div>
    </div>
  );
}

function RosterRow({
  team,
  className = "",
  label,
}: {
  team: Teams;
  className?: string;
  label?: string;
}) {
  const roster = (team.Players ?? []).filter(
    (p) => p.UserName || p.GameUserName,
  );
  if (roster.length === 0) return null;
  return (
    <div className={className}>
      {label ? (
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-body">
          {label}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {roster.slice(0, 8).map((player) => (
          <span
            key={player.User_id || player.UserName}
            className="inline-flex items-center gap-1.5 text-xs text-body"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvePlayerIcon(player.Icon, player.User_id)}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
            <VerifiedName
              name={player.GameUserName || player.UserName}
              verified={player.Verified}
            />
          </span>
        ))}
        {roster.length > 8 ? (
          <span className="text-xs text-body">+{roster.length - 8}</span>
        ) : null}
      </div>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white/70 transition-colors hover:bg-black/50 hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

function Trophy() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      className="mx-auto text-yellow"
      aria-hidden
    >
      <path
        d="M7 4h10v4a5 5 0 0 1-10 0V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 13v3M8.5 20h7M9.5 20l.5-4h4l.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
