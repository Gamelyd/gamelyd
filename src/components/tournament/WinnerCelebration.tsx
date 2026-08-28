"use client";

import { useEffect } from "react";
import type { Teams } from "@/lib/schemas/draw";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";
import { VerifiedName } from "@/components/ui/VerifiedName";

const BURST = Array.from({ length: 18 }, (_, i) => ({
  angle: (i / 18) * 360,
  dist: 72 + (i % 5) * 16,
  delay: `${(i % 9) * 0.035}s`,
  size: 4 + (i % 3) * 2,
  tone: i % 2 === 0 ? "teal" : "gold",
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
  const roster = (team.Players ?? []).filter(
    (p) => p.UserName || p.GameUserName,
  );

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
      <div className="champion-glow" aria-hidden />

      <div
        className="champion-stage"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="champion-kicker">{gameName || "Tournament complete"}</p>

        <div className="champion-core">
          <div className="champion-burst" aria-hidden>
            {BURST.map((spark, i) => (
              <span
                key={i}
                className={`champion-spark champion-spark-${spark.tone}`}
                style={{
                  width: spark.size,
                  height: spark.size,
                  animationDelay: spark.delay,
                  ["--a" as string]: `${spark.angle}deg`,
                  ["--d" as string]: `${spark.dist}px`,
                }}
              />
            ))}
          </div>
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
        <span className="champion-rule" aria-hidden />
        <p className="champion-event">{tournamentName}</p>

        {roster.length > 0 ? (
          <ul className="champion-roster">
            {roster.slice(0, 6).map((player) => (
              <li key={player.User_id || player.UserName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvePlayerIcon(player.Icon, player.User_id)}
                  alt=""
                />
                <VerifiedName
                  name={player.GameUserName || player.UserName}
                  verified={player.Verified}
                />
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
    <svg className="champion-rings" viewBox="0 0 280 280" aria-hidden>
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
        <circle cx="140" cy="14" r="3.5" fill="currentColor" />
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
      </g>
      <polygon
        points="140,28 238,84 238,196 140,252 42,196 42,84"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="champion-hex-stroke"
      />
    </svg>
  );
}
