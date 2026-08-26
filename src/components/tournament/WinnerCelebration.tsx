"use client";

import { useEffect } from "react";
import type { Teams } from "@/lib/schemas/draw";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";

const SHARDS = Array.from({ length: 32 }, (_, i) => ({
  left: `${4 + ((i * 29) % 92)}%`,
  delay: `${(i % 14) * 0.07}s`,
  duration: `${1.8 + (i % 6) * 0.22}s`,
  size: 5 + (i % 5) * 3,
  tilt: (i * 21) % 360,
  tone: i % 4,
}));

export function WinnerCelebration({
  team,
  tournamentName,
  gameName,
  onClose,
}: {
  team: Teams;
  tournamentName: string;
  gameName: string;
  onClose: () => void;
}) {
  const crest = resolveIcon(team.Icon, FALLBACKS.team);
  const roster = (team.Players ?? []).filter((p) => p.UserName || p.GameUserName);

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

  return (
    <div
      className="champion-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="champion-title"
      onClick={onClose}
    >
      <div className="champion-grid" aria-hidden />
      <div className="champion-sweep" aria-hidden />
      <div className="champion-shards" aria-hidden>
        {SHARDS.map((shard, i) => (
          <span
            key={i}
            className={`champion-shard champion-shard-${shard.tone}`}
            style={{
              left: shard.left,
              width: shard.size,
              height: shard.size,
              animationDelay: shard.delay,
              animationDuration: shard.duration,
              ["--tilt" as string]: `${shard.tilt}deg`,
            }}
          />
        ))}
      </div>

      <div
        className="champion-stage"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="champion-kicker">{gameName || "Tournament complete"}</p>

        <div className="champion-core">
          <HudRings />
          <div className="champion-hex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={crest} alt="" className="champion-crest" />
          </div>
        </div>

        <p className="champion-label">Champion</p>
        <h2 id="champion-title" className="champion-name">
          {team.TeamName}
        </h2>
        <p className="champion-event">{tournamentName}</p>

        {roster.length > 0 ? (
          <ul className="champion-roster">
            {roster.slice(0, 6).map((player) => (
              <li key={player.User_id || player.UserName}>
                {player.GameUserName || player.UserName}
              </li>
            ))}
          </ul>
        ) : null}

        <Button onClick={onClose} className="mt-8">
          Enter tournament
        </Button>
      </div>
    </div>
  );
}

function HudRings() {
  return (
    <svg
      className="champion-rings"
      viewBox="0 0 280 280"
      aria-hidden
    >
      <g className="champion-orbit champion-orbit-a">
        <circle
          cx="140"
          cy="140"
          r="126"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="6 10"
        />
        <circle cx="140" cy="14" r="4" fill="currentColor" />
        <circle cx="252" cy="196" r="3" fill="currentColor" />
      </g>
      <g className="champion-orbit champion-orbit-b">
        <circle
          cx="140"
          cy="140"
          r="108"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 14"
        />
        <rect x="136" y="28" width="8" height="8" fill="currentColor" />
      </g>
      <polygon
        points="140,28 238,84 238,196 140,252 42,196 42,84"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="champion-hex-stroke"
      />
      <polygon
        points="140,42 224,90 224,190 140,238 56,190 56,90"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.45"
      />
      <g className="champion-ticks">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 140 + Math.cos(a) * 118;
          const y1 = 140 + Math.sin(a) * 118;
          const x2 = 140 + Math.cos(a) * 128;
          const y2 = 140 + Math.sin(a) * 128;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
            />
          );
        })}
      </g>
    </svg>
  );
}
