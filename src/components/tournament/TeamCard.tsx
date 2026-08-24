"use client";

import { useState } from "react";
import type { RegisterTournament } from "@/lib/schemas/register";
import {
  FALLBACKS,
  UI_ICONS,
  resolveIcon,
  resolvePlayerIcon,
} from "@/lib/icons";

export function TeamCard({ team }: { team: RegisterTournament }) {
  const [flipped, setFlipped] = useState(false);
  const name = team.TeamName || "Unnamed team";
  const players = team.Players ?? [];

  return (
    <article
      className="team-card w-[234px] cursor-pointer max-[570px]:w-[168px]"
      onClick={() => setFlipped((open) => !open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((open) => !open);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${name}. Hover or tap to see players.`}
      data-flipped={flipped ? "true" : "false"}
    >
      <div className="team-card-scene h-[326px] w-full max-[570px]:h-[226px]">
        <div className="team-card-inner">
          <div
            className="team-card-face team-card-front"
            style={{ backgroundImage: `url("${UI_ICONS.teamCard}")` }}
          >
            <div className="team-card-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveIcon(team.Icon, FALLBACKS.team)}
                alt=""
                className="absolute inset-0 h-full w-full object-contain p-4"
              />
              <div className="team-card-shade" />
              <div className="team-card-banner-wrap">
                <div
                  className="team-card-banner"
                  style={{ backgroundImage: `url("${UI_ICONS.teamName}")` }}
                >
                  <h3>{name}</h3>
                </div>
              </div>
            </div>
          </div>

          <div
            className="team-card-face team-card-back"
            style={{ backgroundImage: `url("${UI_ICONS.teamCard}")` }}
          >
            <div className="team-card-back-inner">
              <div
                className="team-card-banner"
                style={{ backgroundImage: `url("${UI_ICONS.teamName}")` }}
              >
                <h3>{name}</h3>
              </div>
              <ul>
                {players.length === 0 ? (
                  <li className="empty">No players listed</li>
                ) : (
                  players.map((player, i) => (
                    <li key={`${player.User_id || player.UserName}-${i}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="avatar"
                        src={resolvePlayerIcon(player.Icon, player.User_id)}
                        alt=""
                      />
                      <span className="meta">
                        <span className="uname">
                          {player.UserName || "Unknown"}
                        </span>
                        {player.GameUserName ? (
                          <span className="gname">{player.GameUserName}</span>
                        ) : null}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
