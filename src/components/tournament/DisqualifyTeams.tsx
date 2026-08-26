"use client";

import { useState } from "react";
import Image from "next/image";
import type { RegisterTournament } from "@/lib/schemas/register";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { disqualifyTeamAction } from "@/server/actions/tournamentActions";
import type { Tournament } from "@/lib/schemas/tournament";
import type { Draw } from "@/lib/schemas/draw";

export function DisqualifyTeams({
  tournamentId,
  participants,
  disqualifiedTeams,
  onDisqualified,
}: {
  tournamentId: string;
  participants: RegisterTournament[];
  disqualifiedTeams: string[];
  onDisqualified: (next: {
    tournament: Tournament;
    draws: Draw[];
    teamName: string;
  }) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const dq = new Set(disqualifiedTeams);

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    const result = await disqualifyTeamAction(tournamentId, pending);
    setBusy(false);
    if (result.ok) {
      toast.success(
        result.data.forfeited > 0
          ? `${pending} disqualified. ${result.data.forfeited} remaining match${
              result.data.forfeited === 1 ? "" : "es"
            } set as 3–0 losses.`
          : `${pending} disqualified.`,
      );
      onDisqualified({
        tournament: result.data.tournament,
        draws: result.data.draws,
        teamName: pending,
      });
      setPending(null);
    } else {
      toast.error(result.error);
    }
  };

  if (participants.length === 0) {
    return <p className="text-sm text-body">No teams registered yet.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-surface-2">
        {participants.map((p) => {
          const out = dq.has(p.TeamName);
          return (
            <li
              key={p.RegisterTournamentId || p._id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={resolveIcon(p.Icon, FALLBACKS.team)}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {p.TeamName}
                  </p>
                  {out ? (
                    <p className="text-xs text-lose">Disqualified</p>
                  ) : (
                    <p className="truncate text-xs text-body">
                      {(p.Players ?? [])
                        .map((pl) => pl.UserName)
                        .filter(Boolean)
                        .join(", ") || "No players listed"}
                    </p>
                  )}
                </div>
              </div>
              {out ? null : (
                <Button
                  variant="danger"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setPending(p.TeamName)}
                >
                  Disqualify
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Confirm
        open={Boolean(pending)}
        title={`Disqualify ${pending ?? "this team"}?`}
        message="They will lose every remaining match 3–0. In knockout, their opponent goes through automatically. Played results stay as they are."
        confirmLabel="Disqualify"
        confirmVariant="danger"
        loading={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
    </>
  );
}
