"use client";

import { useState } from "react";
import type { TournamentGroup } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Player } from "@/lib/schemas/draw";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";

type GroupTeam = {
  key: string;
  name: string;
  icon: string;
  players: Player[];
};

function groupBadge(name: string, index: number): string {
  const stripped = name.replace(/group/i, "").trim();
  if (stripped) return stripped.slice(0, 2).toUpperCase();
  return String.fromCharCode(65 + (index % 26));
}

export function GroupsBoard({
  groups,
  participants,
}: {
  groups: TournamentGroup[];
  participants: RegisterTournament[];
}) {
  const byName = new Map(participants.map((p) => [p.TeamName, p]));

  return (
    <div className="grid grid-cols-1 gap-5 py-2 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group, gi) => {
        const teams: GroupTeam[] = group.Teams.map((t, ti) => {
          const reg = byName.get(t.TeamName);
          return {
            key: reg?.RegisterTournamentId || reg?._id || `${t.TeamName}-${ti}`,
            name: t.TeamName || "Unnamed team",
            icon: reg?.Icon || t.Icon || "",
            players: (reg?.Players ?? t.Players ?? []) as Player[],
          };
        });

        return (
          <GroupPanel
            key={group.GroupName || gi}
            title={group.GroupName || `Group ${gi + 1}`}
            badge={groupBadge(group.GroupName, gi)}
            teams={teams}
          />
        );
      })}
    </div>
  );
}

function GroupPanel({
  title,
  badge,
  teams,
}: {
  title: string;
  badge: string;
  teams: GroupTeam[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-surface-2 bg-surface shadow-lg shadow-black/20">
      <header className="flex items-center gap-3 border-b border-surface-2 bg-primary-panel px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary font-display text-lg leading-none text-primary-panel">
          {badge}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg leading-tight text-white">
            {title}
          </h3>
          <p className="text-xs text-body">
            {teams.length} team{teams.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <ul className="divide-y divide-surface-2">
        {teams.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-body">
            No teams in this group
          </li>
        ) : (
          teams.map((team, i) => (
            <GroupTeamRow key={team.key} rank={i + 1} team={team} />
          ))
        )}
      </ul>
    </section>
  );
}

function GroupTeamRow({ rank, team }: { rank: number; team: GroupTeam }) {
  const [open, setOpen] = useState(false);
  const hasPlayers = team.players.length > 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => hasPlayers && setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          hasPlayers ? "hover:bg-surface-2" : "cursor-default"
        }`}
        aria-expanded={hasPlayers ? open : undefined}
      >
        <span className="w-5 shrink-0 text-center text-sm tabular-nums text-body">
          {rank}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveIcon(team.icon, FALLBACKS.team)}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full bg-input object-cover ring-1 ring-surface-2"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">
            {team.name}
          </span>
          <span className="block text-xs text-body">
            {team.players.length} player{team.players.length === 1 ? "" : "s"}
          </span>
        </span>
        {hasPlayers ? (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`h-4 w-4 shrink-0 text-body transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>

      {open && hasPlayers ? (
        <ul className="space-y-1 bg-surface-4/60 px-4 pb-3 pl-12">
          {team.players.map((player, i) => (
            <li
              key={`${player.User_id || player.UserName}-${i}`}
              className="flex items-center gap-2.5 py-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvePlayerIcon(player.Icon, player.User_id)}
                alt=""
                className="h-6 w-6 rounded-full bg-input object-cover"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-white">
                  {player.UserName || "Unknown"}
                </span>
                {player.GameUserName ? (
                  <span className="block truncate text-[11px] text-body">
                    {player.GameUserName}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
