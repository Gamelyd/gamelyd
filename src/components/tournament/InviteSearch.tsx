"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CatalogAvatar } from "@/components/ui/CatalogAvatar";
import { useToast } from "@/components/ui/Toast";
import { searchUsersAction } from "@/server/actions/userActions";
import {
  inviteToTeamAction,
  inviteToTournamentAction,
} from "@/server/actions/inviteActions";
import type { InviteTournament } from "@/lib/schemas/misc";
import type { User } from "@/lib/schemas/user";
import { VerifiedName } from "@/components/ui/VerifiedName";

export function InviteSearch({
  tournamentId,
  kind,
  excludeIds = [],
  onSent,
}: {
  tournamentId: string;
  kind: "TOURNAMENT" | "TEAM";
  excludeIds?: string[];
  onSent?: (invite: InviteTournament) => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const runSearch = async (value: string) => {
    setSearch(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const result = await searchUsersAction(value, 1);
    if (result.ok) {
      setResults(
        result.data.items.filter((u) => !excludeIds.includes(u.user_id)),
      );
    }
  };

  const send = async (u: User) => {
    setLoadingId(u.user_id);
    const result =
      kind === "TEAM"
        ? await inviteToTeamAction(tournamentId, u.user_name)
        : await inviteToTournamentAction(tournamentId, u.user_name);
    setLoadingId(null);
    if (result.ok) {
      toast.success(result.message ?? "Invite sent");
      setSearch("");
      setResults([]);
      onSent?.(result.data);
      return;
    }
    toast.error(result.error);
  };

  return (
    <div>
      <Input
        label={kind === "TEAM" ? "Invite a teammate" : "Invite a player"}
        placeholder="Search by username"
        value={search}
        onChange={(e) => void runSearch(e.target.value)}
      />
      {results.length > 0 ? (
        <div className="mt-2 rounded-lg border border-surface-2 bg-surface">
          {results.map((u) => (
            <div
              key={u.user_id}
              className="flex items-center justify-between gap-3 px-4 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-white">
                <CatalogAvatar
                  userId={u.user_id}
                  icon={u.icon}
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="truncate">
                  <VerifiedName
                    name={`${u.first_name} (@${u.user_name})`}
                    verified={u.verified}
                  />
                </span>
              </span>
              <Button
                type="button"
                loading={loadingId === u.user_id}
                onClick={() => void send(u)}
              >
                Invite
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
