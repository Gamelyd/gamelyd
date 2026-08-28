"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { searchUsersAction } from "@/server/actions/userActions";
import { addParticipantsAction } from "@/server/actions/tournamentActions";
import { rosterSize, type TeamSize } from "@/lib/schemas/common";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { User } from "@/lib/schemas/user";
import { CatalogAvatar } from "@/components/ui/CatalogAvatar";
import { VerifiedName, PlayerNameList } from "@/components/ui/VerifiedName";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";

const NEW_TEAM = "";

export function AddParticipants({
  tournamentId,
  teamSize,
  rosterCount = 0,
  started,
  participants,
  existingUserIds,
  onAdded,
}: {
  tournamentId: string;
  teamSize: TeamSize;
  rosterCount?: number;
  started: boolean;
  participants: RegisterTournament[];
  existingUserIds: string[];
  onAdded: (registration: RegisterTournament) => void;
}) {
  const toast = useToast();
  const needed = rosterSize(teamSize, rosterCount);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [picked, setPicked] = useState<User[]>([]);
  const [teamName, setTeamName] = useState("");
  const [target, setTarget] = useState(NEW_TEAM);
  const [loading, setLoading] = useState(false);

  const openTeams = useMemo(
    () =>
      participants.filter(
        (team) => (team.Players ?? []).length < needed,
      ),
    [participants, needed],
  );

  const selectedTeam = openTeams.find((team) => team.TeamName === target);
  const filled = selectedTeam ? (selectedTeam.Players ?? []).length : 0;
  const spotsLeft = Math.max(
    needed - filled - picked.length,
    0,
  );

  const taken = new Set([
    ...existingUserIds,
    ...picked.map((u) => u.user_id),
  ]);

  const runSearch = async (value: string) => {
    setSearch(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const result = await searchUsersAction(value, 1);
    if (result.ok) {
      setResults(result.data.items.filter((u) => !taken.has(u.user_id)));
    }
  };

  const pick = (u: User) => {
    if (taken.has(u.user_id) || spotsLeft <= 0) return;
    if (needed === 1 && target === NEW_TEAM) {
      void submitWith([u]);
      return;
    }
    setPicked((prev) => [...prev, u]);
    setSearch("");
    setResults([]);
  };

  const changeTarget = (value: string) => {
    setTarget(value);
    setPicked([]);
    setSearch("");
    setResults([]);
  };

  const submitWith = async (users: User[]) => {
    if (users.length < 1) {
      toast.error("Pick at least one player");
      return;
    }
    if (users.length > needed - filled) {
      toast.error(
        `A team cannot have more than ${needed} player${needed === 1 ? "" : "s"}. ${needed - filled} spot${needed - filled === 1 ? "" : "s"} left.`,
      );
      return;
    }
    setLoading(true);
    const result = await addParticipantsAction(tournamentId, {
      userIds: users.map((u) => u.user_id),
      teamName,
      existingTeamName: target,
    });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Added");
      onAdded(result.data);
      setPicked([]);
      setTeamName("");
      setSearch("");
      setResults([]);
      if (target && (result.data.Players?.length ?? 0) >= needed) {
        setTarget(NEW_TEAM);
      }
    } else {
      toast.error(result.error);
    }
  };

  if (started) {
    return (
      <p className="text-sm text-body">
        Registration is closed because this tournament has started.
      </p>
    );
  }

  const addingToExisting = Boolean(target);
  const canSubmit = picked.length > 0 && spotsLeft >= 0;

  return (
    <div className="flex flex-col gap-4">
      {needed > 1 ? (
        <Select
          label="Add to"
          value={target}
          onChange={(e) => changeTarget(e.target.value)}
          options={[
            { value: NEW_TEAM, label: "New team" },
            ...openTeams.map((team) => ({
              value: team.TeamName,
              label: `${team.TeamName} (${(team.Players ?? []).length}/${needed})`,
            })),
          ]}
        />
      ) : null}

      <Input
        label="Search users"
        placeholder="Type a username or name"
        value={search}
        onChange={(e) => void runSearch(e.target.value)}
        disabled={spotsLeft === 0 || loading}
      />
      {results.length > 0 ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-surface-2 bg-bg">
          {results.map((u) => (
            <button
              key={u.user_id}
              type="button"
              onClick={() => pick(u)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-body hover:bg-surface-2 hover:text-white"
            >
              <CatalogAvatar
                userId={u.user_id}
                icon={u.icon}
                className="h-8 w-8 rounded-full object-cover"
              />
              <span>
                <VerifiedName
                  name={`${u.first_name} ${u.last_name}`.trim()}
                  verified={u.verified}
                />{" "}
                <span className="text-primary">@{u.user_name}</span>
              </span>
              <span className="ml-auto text-primary">+ Add</span>
            </button>
          ))}
        </div>
      ) : null}

      {picked.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {picked.map((u) => (
            <span
              key={u.user_id}
              className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-sm text-white"
            >
              @{u.user_name}
              <button
                type="button"
                className="text-lose"
                onClick={() =>
                  setPicked((prev) =>
                    prev.filter((p) => p.user_id !== u.user_id),
                  )
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {needed > 1 && !addingToExisting ? (
        <Input
          label="Team name"
          placeholder="Defaults to the players’ usernames"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      ) : null}

      <p className="text-xs text-body">
        {needed === 1
          ? "The host set 1 player per team. Pick a user to add them as their own team."
          : addingToExisting
            ? `Adding to ${target}. ${spotsLeft} of ${needed} spots left after this pick (${picked.length} selected). A team cannot have more than ${needed} players.`
            : `New team: add 1–${needed} players now. You can fill remaining spots later (${picked.length}/${needed} selected). A team cannot have more than ${needed} players.`}
      </p>

      {needed > 1 || picked.length > 0 ? (
        <div>
          <Button
            type="button"
            loading={loading}
            disabled={!canSubmit || loading}
            onClick={() => void submitWith(picked)}
          >
            {addingToExisting ? "Add to team" : "Create team"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RegisteredTeamsList({
  participants,
}: {
  participants: RegisterTournament[];
}) {
  if (participants.length === 0) {
    return <p className="mt-4 text-sm text-body">No teams registered yet.</p>;
  }

  return (
    <div className="mt-6">
      <CollapsiblePanel title="Registered teams" count={participants.length}>
        <ul className="divide-y divide-surface-2">
          {participants.map((p) => (
            <li
              key={p.RegisterTournamentId || p._id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
            >
              <span className="font-medium text-white">{p.TeamName}</span>
              <span className="text-body">
                <PlayerNameList players={p.Players ?? []} />
              </span>
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </div>
  );
}

function upsertParticipant(
  prev: RegisterTournament[],
  next: RegisterTournament,
): RegisterTournament[] {
  const id = next.RegisterTournamentId || next._id;
  const index = prev.findIndex(
    (p) => (p.RegisterTournamentId || p._id) === id || p.TeamName === next.TeamName,
  );
  if (index < 0) return [...prev, next];
  const copy = [...prev];
  copy[index] = next;
  return copy;
}

export { upsertParticipant };
