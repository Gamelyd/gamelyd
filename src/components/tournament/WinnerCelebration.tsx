"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Teams } from "@/lib/schemas/draw";
import type { Podium } from "@/lib/podium";
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

const PLACE_COPY = {
  1: { label: "Champion", rank: "1st" },
  2: { label: "Second", rank: "2nd" },
  3: { label: "Third", rank: "3rd" },
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
  const fullPodium = Boolean(second && third);
  const [mounted, setMounted] = useState(false);

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

  return createPortal(
    <div
      className="champion-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="champion-title"
      onClick={onClose}
    >
      <div className="champion-glow" aria-hidden />

      <div className="champion-overlay-inner">
        <div
          className="champion-stage"
          onClick={(event) => event.stopPropagation()}
        >
        <p className="champion-kicker">{gameName || "Tournament complete"}</p>
        <p className="champion-event champion-event-top">{tournamentName}</p>

        {hasPodium ? (
          <div
            className={`champion-podium ${fullPodium ? "has-third" : "has-two"}`}
          >
            {fullPodium ? (
              <>
                <PodiumSlot team={second!} place={2} />
                <PodiumSlot team={first} place={1} featured />
                <PodiumSlot team={third!} place={3} />
              </>
            ) : (
              <>
                <PodiumSlot team={first} place={1} featured />
                {second ? <PodiumSlot team={second} place={2} /> : null}
                {third && !second ? (
                  <PodiumSlot team={third} place={3} />
                ) : null}
              </>
            )}
          </div>
        ) : (
          <ChampionHero team={first} />
        )}

        {!hasPodium ? (
          <>
            <p className="champion-label">Champion</p>
            <h2 id="champion-title" className="champion-name">
              {first.TeamName}
            </h2>
            <span className="champion-rule" aria-hidden />
            <Roster team={first} />
          </>
        ) : (
          <h2 id="champion-title" className="sr-only">
            {first.TeamName} won {tournamentName}
          </h2>
        )}

          <Button onClick={onClose} className="mt-8">
            Enter tournament
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ChampionHero({ team }: { team: Teams }) {
  const crest = resolveIcon(team.Icon, FALLBACKS.team);
  return (
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
  );
}

function PodiumSlot({
  team,
  place,
  featured = false,
}: {
  team: Teams;
  place: 1 | 2 | 3;
  featured?: boolean;
}) {
  const crest = resolveIcon(team.Icon, FALLBACKS.team);
  const copy = PLACE_COPY[place];
  const wing = place === 2 ? "left" : place === 3 ? "right" : "under";
  return (
    <div className={`champion-place champion-place-${place}`}>
      <div className="champion-place-body">
        {wing === "left" ? <Roster team={team} layout="stack" /> : null}
        <div className="champion-place-team">
          {featured ? (
            <div className="champion-core champion-core-podium">
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
          ) : (
            <div className={`champion-hex champion-hex-${place}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={crest} alt="" className="champion-crest" />
            </div>
          )}
          <p className={`champion-place-rank champion-place-rank-${place}`}>
            {copy.rank}
          </p>
          <p className="champion-place-label">{copy.label}</p>
          <p className="champion-place-name">{team.TeamName}</p>
          {wing === "under" ? <Roster team={team} layout="under" /> : null}
        </div>
        {wing === "right" ? <Roster team={team} layout="stack" /> : null}
      </div>
      <span className="champion-place-stand" aria-hidden />
    </div>
  );
}

function Roster({
  team,
  layout = "row",
}: {
  team: Teams;
  layout?: "row" | "stack" | "under";
}) {
  const roster = (team.Players ?? []).filter(
    (p) => p.UserName || p.GameUserName,
  );
  if (roster.length === 0) return null;
  const scrollable = roster.length > 6;
  return (
    <div
      className={`champion-roster-wrap champion-roster-wrap-${layout}${
        scrollable ? " is-scroll" : ""
      }`}
    >
      {scrollable ? (
        <p className="champion-roster-count">{roster.length} players</p>
      ) : null}
      <ul className={`champion-roster champion-roster-${layout}`}>
        {roster.map((player) => (
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
