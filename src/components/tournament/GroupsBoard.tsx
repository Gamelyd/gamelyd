"use client";

import { useEffect, useRef, useState } from "react";
import type { TournamentGroup } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Player } from "@/lib/schemas/draw";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";
import { isSoloVerified, VerifiedName } from "@/components/ui/VerifiedName";
import { groupBadge } from "@/lib/groupBadge";

type GroupTeam = {
  key: string;
  name: string; // raw TeamName used for persistence
  icon: string;
  players: Player[];
};

type LocalGroup = {
  GroupName: string;
  badge: string;
  teams: GroupTeam[];
};

export type GroupArrangement = { GroupName: string; TeamNames: string[] };

function buildLocalGroups(
  groups: TournamentGroup[],
  participants: RegisterTournament[],
): LocalGroup[] {
  const byName = new Map(participants.map((p) => [p.TeamName, p]));
  return groups.map((group, gi) => ({
    GroupName: group.GroupName || `Group ${gi + 1}`,
    badge: groupBadge(group.GroupName, gi),
    teams: (group.Teams ?? []).map((t, ti) => {
      const reg = byName.get(t.TeamName);
      return {
        key: reg?.RegisterTournamentId || reg?._id || `${t.TeamName}-${ti}`,
        name: t.TeamName,
        icon: reg?.Icon || t.Icon || "",
        players: (reg?.Players ?? t.Players ?? []) as Player[],
      };
    }),
  }));
}

function signature(groups: LocalGroup[]): string {
  return groups.map((g) => `${g.GroupName}:${g.teams.map((t) => t.name).join(",")}`).join("|");
}

export function GroupsBoard({
  groups,
  participants,
  editable = false,
  onSave,
}: {
  groups: TournamentGroup[];
  participants: RegisterTournament[];
  editable?: boolean;
  onSave?: (arrangement: GroupArrangement[]) => Promise<boolean>;
}) {
  const [local, setLocal] = useState<LocalGroup[]>(() =>
    buildLocalGroups(groups, participants),
  );
  const [saving, setSaving] = useState(false);
  const [dragKey, setDragKey] = useState<string>("");
  const [overGroup, setOverGroup] = useState<number>(-1);
  const dragRef = useRef<{ fromGroup: number; key: string } | null>(null);

  // Re-sync when the server data changes (e.g. after regrouping or a save),
  // unless the user is mid-drag.
  const incoming = buildLocalGroups(groups, participants);
  const incomingSig = signature(incoming);
  const localSig = signature(local);
  useEffect(() => {
    if (!dragRef.current && incomingSig !== localSig) {
      setLocal(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSig]);

  const persist = async (next: LocalGroup[], previous: LocalGroup[]) => {
    if (!onSave) return;
    setSaving(true);
    const ok = await onSave(
      next.map((g) => ({
        GroupName: g.GroupName,
        TeamNames: g.teams.map((t) => t.name),
      })),
    );
    setSaving(false);
    if (!ok) setLocal(previous);
  };

  const moveTeam = (
    fromGroup: number,
    key: string,
    toGroup: number,
    toIndex: number | null,
  ) => {
    if (saving) return;
    setLocal((prev) => {
      const src = prev[fromGroup];
      const idx = src?.teams.findIndex((t) => t.key === key) ?? -1;
      if (!src || idx === -1) return prev;
      const team = src.teams[idx];

      // No-op guard: dropping onto its own position in the same group.
      if (fromGroup === toGroup) {
        if (toIndex === null && idx === src.teams.length - 1) return prev;
        if (toIndex !== null && (toIndex === idx || toIndex === idx + 1)) {
          return prev;
        }
      }

      const next = prev.map((g) => ({ ...g, teams: [...g.teams] }));
      next[fromGroup].teams.splice(idx, 1);

      let insertAt =
        toIndex === null ? next[toGroup].teams.length : toIndex;
      // Adjust index when removing an earlier item from the same group.
      if (fromGroup === toGroup && toIndex !== null && toIndex > idx) {
        insertAt -= 1;
      }
      next[toGroup].teams.splice(insertAt, 0, team);

      void persist(next, prev);
      return next;
    });
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragKey("");
    setOverGroup(-1);
  };

  return (
    <div className="py-2">
      {editable ? (
        <p className="mb-4 text-center text-xs text-body">
          Drag a team into another group to move it
          {saving ? " · saving…" : ""}.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {local.map((group, gi) => (
          <section
            key={group.GroupName || gi}
            onDragOver={
              editable
                ? (e) => {
                    e.preventDefault();
                    setOverGroup(gi);
                  }
                : undefined
            }
            onDrop={
              editable
                ? (e) => {
                    e.preventDefault();
                    const d = dragRef.current;
                    if (d) moveTeam(d.fromGroup, d.key, gi, null);
                    endDrag();
                  }
                : undefined
            }
            className={`overflow-hidden rounded-2xl border bg-surface shadow-lg shadow-black/20 transition-colors ${
              editable && overGroup === gi
                ? "border-primary"
                : "border-surface-2"
            }`}
          >
            <header className="flex items-center gap-3 border-b border-surface-2 bg-primary-panel px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary font-display text-lg leading-none text-primary-panel">
                {group.badge}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg leading-tight text-white">
                  {group.GroupName}
                </h3>
                <p className="text-xs text-body">
                  {group.teams.length} team
                  {group.teams.length === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            <ul className="divide-y divide-surface-2">
              {group.teams.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-body">
                  Drop a team here
                </li>
              ) : (
                group.teams.map((team, i) => (
                  <GroupTeamRow
                    key={team.key}
                    rank={i + 1}
                    team={team}
                    editable={editable}
                    dragging={dragKey === team.key}
                    groups={local}
                    groupIndex={gi}
                    onDragStart={() => {
                      dragRef.current = { fromGroup: gi, key: team.key };
                      setDragKey(team.key);
                    }}
                    onDragEnd={endDrag}
                    onDropBefore={() => {
                      const d = dragRef.current;
                      if (d) moveTeam(d.fromGroup, d.key, gi, i);
                      endDrag();
                    }}
                    onMoveTo={(toGroup) =>
                      moveTeam(gi, team.key, toGroup, null)
                    }
                  />
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function GroupTeamRow({
  rank,
  team,
  editable,
  dragging,
  groups,
  groupIndex,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onMoveTo,
}: {
  rank: number;
  team: GroupTeam;
  editable: boolean;
  dragging: boolean;
  groups: LocalGroup[];
  groupIndex: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
  onMoveTo: (toGroup: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasPlayers = team.players.length > 0;

  return (
    <li
      draggable={editable}
      onDragStart={
        editable
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart();
            }
          : undefined
      }
      onDragEnd={editable ? onDragEnd : undefined}
      onDragOver={editable ? (e) => e.preventDefault() : undefined}
      onDrop={
        editable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropBefore();
            }
          : undefined
      }
      className={dragging ? "opacity-40" : ""}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
          hasPlayers ? "hover:bg-surface-2" : ""
        }`}
      >
        {editable ? (
          <span
            className="shrink-0 cursor-grab text-body active:cursor-grabbing"
            aria-hidden
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <circle cx="7" cy="5" r="1.4" />
              <circle cx="7" cy="10" r="1.4" />
              <circle cx="7" cy="15" r="1.4" />
              <circle cx="13" cy="5" r="1.4" />
              <circle cx="13" cy="10" r="1.4" />
              <circle cx="13" cy="15" r="1.4" />
            </svg>
          </span>
        ) : (
          <span className="w-5 shrink-0 text-center text-sm tabular-nums text-body">
            {rank}
          </span>
        )}

        <button
          type="button"
          onClick={() => hasPlayers && setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={hasPlayers ? open : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveIcon(team.icon, FALLBACKS.team)}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full bg-input object-cover ring-1 ring-surface-2"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">
              <VerifiedName
                name={team.name || "Unnamed team"}
                verified={isSoloVerified(team.players)}
              />
            </span>
            <span className="block text-xs text-body">
              {team.players.length} player
              {team.players.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>

        {editable ? (
          <select
            aria-label={`Move ${team.name || "team"} to another group`}
            value={groupIndex}
            onChange={(e) => onMoveTo(Number(e.target.value))}
            className="shrink-0 rounded-lg border border-surface-2 bg-input px-2 py-1.5 text-xs text-white outline-none focus:border-primary"
          >
            {groups.map((g, gi) => (
              <option key={g.GroupName || gi} value={gi} className="bg-input">
                {g.GroupName}
              </option>
            ))}
          </select>
        ) : hasPlayers ? (
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
      </div>

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
                  <VerifiedName
                    name={player.UserName || "Unknown"}
                    verified={player.Verified}
                  />
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
