"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { searchUsersAction } from "@/server/actions/userActions";
import { adminSubstituteTeamAction } from "@/server/actions/adminActions";
import { rosterSize, type TeamSize } from "@/lib/schemas/common";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { User } from "@/lib/schemas/user";
import { displayName } from "@/lib/displayName";

/**
 * Replace a team that has stopped responding, after the draw exists.
 *
 * Removing a team at this point is not an option -- the fixtures point at it.
 * This keeps every fixture where it is and changes who is standing in the slot,
 * so the bracket other people are playing is left intact.
 */
export function SubstituteTeam({
  tournamentId,
  participants,
  teamSize,
  rosterCount = 0,
  onDone,
}: {
  tournamentId: string;
  participants: RegisterTournament[];
  teamSize: TeamSize;
  rosterCount?: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const needed = rosterSize(teamSize, rosterCount);
  const [outTeam, setOutTeam] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [picked, setPicked] = useState<User[]>([]);
  const [teamName, setTeamName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const alreadyIn = new Set(
    participants
      .filter((p) => p.TeamName !== outTeam)
      .flatMap((p) => (p.Players ?? []).map((pl) => pl.User_id)),
  );
  const taken = new Set([...alreadyIn, ...picked.map((u) => u.user_id)]);
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

  const reset = () => {
    setOutTeam("");
    setPicked([]);
    setTeamName("");
    setSearch("");
    setResults([]);
  };

  const submit = async () => {
    setBusy(true);
    const result = await adminSubstituteTeamAction(tournamentId, {
      outTeamName: outTeam,
      userIds: picked.map((u) => u.user_id),
      teamName: teamName.trim(),
    });
    setBusy(false);
    setConfirming(false);
    if (result.ok) {
      toast.success(result.message ?? "Team substituted");
      reset();
      onDone();
    } else {
      toast.error(result.error);
    }
  };

  const ready = Boolean(outTeam) && picked.length > 0;

  return (
    <div className="rounded-2xl border border-surface-2 bg-surface p-5">
      <h2 className="font-semibold text-white">Substitute a team</h2>
      <p className="mt-1 text-sm text-body">
        For a team that has stopped responding after the draw. Fixtures stay
        where they are and the replacement takes over the ones still to be
        played. Matches already played keep the team that played them.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select
          label="Team to replace"
          value={outTeam}
          onChange={(e) => setOutTeam(e.target.value)}
          options={[
            { value: "", label: "Pick a team" },
            ...participants.map((p) => ({
              value: p.TeamName,
              label: p.TeamName,
            })),
          ]}
        />
        <Input
          label="New team name (optional)"
          placeholder={outTeam || "Keeps the same name"}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <Input
          label={`Replacement player${needed === 1 ? "" : "s"} (${picked.length}/${needed})`}
          placeholder="Search by name or username"
          value={search}
          onChange={(e) => void runSearch(e.target.value)}
        />
        {picked.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {picked.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() =>
                  setPicked(picked.filter((p) => p.user_id !== u.user_id))
                }
              >
                <Tag tone="primarySoft" size="sm" uppercase={false}>
                  {displayName(u)} ✕
                </Tag>
              </button>
            ))}
          </div>
        ) : null}
        {results.length > 0 && spotsLeft > 0 ? (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10">
            {results.map((u) => (
              <li key={u.user_id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                  onClick={() => {
                    setPicked([...picked, u]);
                    setResults(results.filter((r) => r.user_id !== u.user_id));
                  }}
                >
                  <span>{displayName(u)}</span>
                  <span className="text-xs text-body">@{u.user_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-4">
        <Button
          variant="danger"
          disabled={!ready}
          onClick={() => setConfirming(true)}
        >
          Substitute
        </Button>
      </div>

      <Confirm
        open={confirming}
        title={`Replace ${outTeam}?`}
        message={`${
          teamName.trim() || outTeam
        } takes over every fixture ${outTeam} has left to play. Matches already played keep ${outTeam}. Players in this tournament will see the change.`}
        confirmLabel="Substitute"
        confirmVariant="danger"
        loading={busy}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
