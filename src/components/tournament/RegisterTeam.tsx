"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconPicker } from "@/components/ui/IconPicker";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { searchUsersAction } from "@/server/actions/userActions";
import { registerForTournamentAction } from "@/server/actions/tournamentActions";
import { FALLBACKS, PLAYER_ICONS, TEAM_ICONS, playerIconFor } from "@/lib/icons";
import type { Player } from "@/lib/schemas/draw";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { TeamSize } from "@/lib/schemas/common";
import { rosterSize } from "@/lib/schemas/common";

function playerFromUser(u: {
  user_name?: string;
  first_name?: string;
  user_id: string;
  email?: string;
}): Player {
  const userName = u.user_name || u.first_name || "Player";
  return {
    UserName: userName,
    GameUserName: "",
    User_id: u.user_id,
    Email: u.email || "",
    Icon: playerIconFor(u.user_id),
  };
}

export function RegisterTeam({
  tournamentId,
  teamSize,
  onRegistered,
}: {
  tournamentId: string;
  teamSize: TeamSize;
  onRegistered: (registration: RegisterTournament) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [teamName, setTeamName] = useState("");
  const [icon, setIcon] = useState(TEAM_ICONS[0]?.url ?? FALLBACKS.team);
  const [gameUserName, setGameUserName] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [players, setPlayers] = useState<Player[]>(
    user ? [playerFromUser(user)] : [],
  );
  const [activePlayerId, setActivePlayerId] = useState(user?.user_id ?? "");
  const [loading, setLoading] = useState(false);
  const needed = rosterSize(teamSize);
  const spotsLeft = Math.max(needed - players.length, 0);

  const runSearch = async (value: string) => {
    setSearch(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const result = await searchUsersAction(value, 1);
    if (result.ok) setResults(result.data.items);
  };

  const addPlayer = (u: User) => {
    if (players.some((p) => p.User_id === u.user_id)) return;
    if (players.length >= needed) {
      toast.error(
        `This is a ${teamSize.toLowerCase()} tournament. Maximum ${needed} player${needed === 1 ? "" : "s"}.`,
      );
      return;
    }
    const next = playerFromUser(u);
    setPlayers((prev) => [...prev, next]);
    setActivePlayerId(next.User_id);
    setSearch("");
    setResults([]);
  };

  const removePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.User_id !== id));
    if (activePlayerId === id) {
      setActivePlayerId(user?.user_id ?? "");
    }
  };

  const setPlayerIcon = (userId: string, url: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.User_id === userId ? { ...p, Icon: url } : p)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (players.length !== needed) {
      toast.error(
        `This ${teamSize.toLowerCase()} tournament needs exactly ${needed} player${needed === 1 ? "" : "s"}.`,
      );
      return;
    }
    setLoading(true);
    const withGameName = players.map((p) => ({
      UserName: p.UserName || "Player",
      GameUserName:
        p.User_id === user?.user_id ? gameUserName : p.GameUserName || "",
      User_id: p.User_id,
      Email: p.Email || "",
      Icon: p.Icon || playerIconFor(p.User_id),
    }));
    const result = await registerForTournamentAction(tournamentId, {
      Players: withGameName,
      TeamName: teamName,
      Icon: icon || FALLBACKS.team,
      RefNumber: "",
      PaymentChannel: "",
      Amount: 0,
    });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Registered");
      onRegistered(result.data);
      setTeamName("");
      setIcon(TEAM_ICONS[0]?.url ?? FALLBACKS.team);
    } else {
      toast.error(result.error);
    }
  };

  if (!user) {
    return (
      <p className="rounded-xl border border-surface-2 bg-surface p-6 text-body">
        Please sign in to register a team.
      </p>
    );
  }

  const activePlayer =
    players.find((p) => p.User_id === activePlayerId) ?? players[0];

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <Input
        label="Team name"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        required
      />
      <IconPicker
        label="Team icon"
        icons={TEAM_ICONS}
        value={icon}
        onChange={setIcon}
      />
      <Input
        label="Your in-game username"
        value={gameUserName}
        onChange={(e) => setGameUserName(e.target.value)}
      />

      {needed > 1 ? (
        <div>
          <Input
            label={`Add teammates (${players.length}/${needed})`}
            placeholder={
              spotsLeft === 0
                ? "Roster is full"
                : "Search players by username"
            }
            value={search}
            onChange={(e) => runSearch(e.target.value)}
            disabled={spotsLeft === 0}
          />
          {results.length > 0 && spotsLeft > 0 && (
            <div className="mt-2 rounded-lg border border-surface-2 bg-surface">
              {results.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => addPlayer(u)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-body hover:bg-surface-2 hover:text-white"
                >
                  <span>
                    {u.first_name} {u.last_name} (@{u.user_name})
                  </span>
                  <span className="text-primary">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-body">
          Solo tournament — you register alone.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <button
            key={p.User_id}
            type="button"
            onClick={() => setActivePlayerId(p.User_id)}
            className={`flex items-center gap-2 rounded-full px-2 py-1 text-sm text-white ${
              activePlayer?.User_id === p.User_id
                ? "bg-primary/30 ring-1 ring-primary"
                : "bg-surface-2"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.Icon || playerIconFor(p.User_id)}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
            {p.UserName}
            {p.User_id !== user.user_id && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removePlayer(p.User_id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    removePlayer(p.User_id);
                  }
                }}
                className="text-lose"
              >
                ✕
              </span>
            )}
          </button>
        ))}
      </div>

      {activePlayer ? (
        <IconPicker
          label={`Player icon for @${activePlayer.UserName}`}
          icons={PLAYER_ICONS}
          value={activePlayer.Icon || playerIconFor(activePlayer.User_id)}
          onChange={(url) => setPlayerIcon(activePlayer.User_id, url)}
          size="sm"
        />
      ) : null}

      <Button type="submit" loading={loading}>
        Register team
      </Button>
    </form>
  );
}
