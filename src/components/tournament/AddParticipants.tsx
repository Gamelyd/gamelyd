"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { searchUsersAction } from "@/server/actions/userActions";
import { addParticipantsAction } from "@/server/actions/tournamentActions";
import { rosterSize, type TeamSize } from "@/lib/schemas/common";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { User } from "@/lib/schemas/user";
import { playerIconFor } from "@/lib/icons";

export function AddParticipants({
  tournamentId,
  teamSize,
  started,
  existingUserIds,
  onAdded,
}: {
  tournamentId: string;
  teamSize: TeamSize;
  started: boolean;
  existingUserIds: string[];
  onAdded: (registration: RegisterTournament) => void;
}) {
  const toast = useToast();
  const needed = rosterSize(teamSize);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [picked, setPicked] = useState<User[]>([]);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  const taken = new Set([
    ...existingUserIds,
    ...picked.map((u) => u.user_id),
  ]);
  const spotsLeft = Math.max(needed - picked.length, 0);

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
    if (taken.has(u.user_id) || picked.length >= needed) return;
    if (needed === 1) {
      void submitWith([u]);
      return;
    }
    setPicked((prev) => [...prev, u]);
    setSearch("");
    setResults([]);
  };

  const submitWith = async (users: User[]) => {
    if (users.length !== needed) {
      toast.error(
        `This ${teamSize.toLowerCase()} tournament needs ${needed} player${needed === 1 ? "" : "s"}.`,
      );
      return;
    }
    setLoading(true);
    const result = await addParticipantsAction(tournamentId, {
      userIds: users.map((u) => u.user_id),
      teamName,
    });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Added");
      onAdded(result.data);
      setPicked([]);
      setTeamName("");
      setSearch("");
      setResults([]);
    } else {
      toast.error(result.error);
    }
  };

  const submit = () => submitWith(picked);

  if (started) {
    return (
      <p className="text-sm text-body">
        Registration is closed because this tournament has started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Search users"
        placeholder="Type a username or name"
        value={search}
        onChange={(e) => void runSearch(e.target.value)}
        disabled={spotsLeft === 0 || loading}
      />
      {results.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-surface-2 bg-bg">
          {results.map((u) => (
            <button
              key={u.user_id}
              type="button"
              onClick={() => pick(u)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-body hover:bg-surface-2 hover:text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={playerIconFor(u.user_id)}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
              <span>
                {u.first_name} {u.last_name}{" "}
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

      {needed > 1 ? (
        <Input
          label="Team name (optional)"
          placeholder="Defaults to the players’ usernames"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      ) : null}

      <p className="text-xs text-body">
        {needed === 1
          ? "Solo event — pick a user to add them immediately."
          : `Pick ${needed} players, then add them as one team (${picked.length}/${needed}).`}
      </p>

      {needed > 1 ? (
        <div>
          <Button
            type="button"
            loading={loading}
            disabled={picked.length !== needed}
            onClick={() => void submit()}
          >
            Add to tournament
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
    <ul className="mt-6 divide-y divide-surface-2 border-t border-surface-2">
      {participants.map((p) => (
        <li
          key={p.RegisterTournamentId || p._id}
          className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
        >
          <span className="font-medium text-white">{p.TeamName}</span>
          <span className="text-body">
            {(p.Players ?? [])
              .map((pl) => pl.UserName)
              .filter(Boolean)
              .join(", ") || "No players listed"}
          </span>
        </li>
      ))}
    </ul>
  );
}
