"use client";

import type { RegisterTournament } from "@/lib/schemas/register";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";
import { captainUserId } from "@/lib/captain";
import { VerifiedName } from "@/components/ui/VerifiedName";

export function TeamCard({
  team,
  seats,
  checkInRequired = false,
}: {
  team: RegisterTournament;
  seats?: number;
  checkInRequired?: boolean;
}) {
  const name = team.TeamName || "Unnamed team";
  const players = team.Players ?? [];
  const size = Math.max(seats ?? players.length, 1);
  const waiting = players.length < size;
  const captain = captainUserId(team);

  return (
    <article className="rounded-xl border border-surface-2 bg-surface p-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveIcon(team.Icon, FALLBACKS.team)}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg bg-black/25 object-contain p-1 ring-1 ring-primary/25"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-lg leading-tight text-white">
              {name}
            </h3>
            {checkInRequired && team.CheckedIn ? (
              <span className="shrink-0 rounded-md bg-yellow/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow">
                In
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-body">
            {players.length}
            {seats ? `/${seats}` : ""} player
            {players.length === 1 ? "" : "s"}
            {waiting ? " · waiting" : ""}
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {players.length === 0 ? (
          <li className="text-xs text-body">No players listed</li>
        ) : (
          players.map((player, i) => (
            <li
              key={`${player.User_id || player.UserName}-${i}`}
              className="flex min-w-0 items-center gap-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvePlayerIcon(player.Icon, player.User_id)}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full bg-primary object-cover ring-1 ring-black/40"
              />
              <span className="min-w-0 truncate text-xs text-white">
                <VerifiedName
                  name={player.UserName || "Unknown"}
                  verified={player.Verified}
                />
                {player.GameUserName ? (
                  <span className="text-body"> · {player.GameUserName}</span>
                ) : null}
              </span>
              {player.User_id && player.User_id === captain ? (
                <span
                  title="Registered the team. Prize money is paid to the captain."
                  className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  Captain
                </span>
              ) : null}
            </li>
          ))
        )}
        {waiting
          ? Array.from({ length: size - players.length }).map((_, i) => (
              <li
                key={`open-${i}`}
                className="flex items-center gap-2 text-xs text-body"
              >
                <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-white/20" />
                Open spot
              </li>
            ))
          : null}
      </ul>
    </article>
  );
}
