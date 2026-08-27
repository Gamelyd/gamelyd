"use client";

import { useState } from "react";
import Image from "next/image";
import type { RegisterTournament } from "@/lib/schemas/register";
import type { Player } from "@/lib/schemas/draw";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import {
  disqualifyTeamAction,
  removeRegisteredTeamAction,
  removeUserAction,
} from "@/server/actions/tournamentActions";
import type { Tournament, TournamentGroup } from "@/lib/schemas/tournament";
import type { Draw } from "@/lib/schemas/draw";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";

type Pending =
  | { kind: "team"; name: string }
  | { kind: "player"; userId: string; label: string; teamName: string };

export function DisqualifyTeams({
  tournamentId,
  started,
  participants,
  disqualifiedTeams,
  onDisqualified,
  onRemoved,
  onPlayerRemoved,
}: {
  tournamentId: string;
  started: boolean;
  participants: RegisterTournament[];
  disqualifiedTeams: string[];
  onDisqualified: (next: {
    tournament: Tournament;
    draws: Draw[];
    teamName: string;
  }) => void;
  onRemoved: (next: { teamName: string; groups: TournamentGroup[] }) => void;
  onPlayerRemoved: (next: { teamName: string; players: Player[] }) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const dq = new Set(disqualifiedTeams);
  const teamAction = started ? "Disqualify" : "Remove";

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);

    if (pending.kind === "player") {
      const result = await removeUserAction(pending.userId, tournamentId);
      setBusy(false);
      if (result.ok) {
        toast.success(`${pending.label} removed.`);
        onPlayerRemoved({
          teamName: pending.teamName,
          players: result.data,
        });
        setPending(null);
      } else {
        toast.error(result.error);
      }
      return;
    }

    if (!started) {
      const result = await removeRegisteredTeamAction(
        tournamentId,
        pending.name,
      );
      setBusy(false);
      if (result.ok) {
        toast.success(`${pending.name} removed from the tournament.`);
        onRemoved(result.data);
        setPending(null);
      } else {
        toast.error(result.error);
      }
      return;
    }

    const result = await disqualifyTeamAction(tournamentId, pending.name);
    setBusy(false);
    if (result.ok) {
      toast.success(
        result.data.forfeited > 0
          ? `${pending.name} disqualified. ${result.data.forfeited} remaining match${
              result.data.forfeited === 1 ? "" : "es"
            } set as 3–0 losses.`
          : `${pending.name} disqualified.`,
      );
      onDisqualified({
        tournament: result.data.tournament,
        draws: result.data.draws,
        teamName: pending.name,
      });
      setPending(null);
    } else {
      toast.error(result.error);
    }
  };

  if (participants.length === 0) {
    return <p className="text-sm text-body">No teams registered yet.</p>;
  }

  const confirmTitle =
    pending?.kind === "player"
      ? `Remove ${pending.label}?`
      : started
        ? `Disqualify ${pending?.name ?? "this team"}?`
        : `Remove ${pending?.name ?? "this team"}?`;
  const confirmMessage =
    pending?.kind === "player"
      ? "They will be taken off this team. If they were the last player, the team is removed too."
      : started
        ? "They will lose every remaining match 3–0. In knockout, their opponent goes through automatically. Played results stay as they are."
        : "They will be taken off the roster. They can register again later if you allow it.";
  const confirmLabel =
    pending?.kind === "player" ? "Remove" : teamAction;

  return (
    <>
      <CollapsiblePanel title="Registered teams" count={participants.length}>
        <ul className="divide-y divide-surface-2">
          {participants.map((p) => {
            const out = dq.has(p.TeamName);
            const players = p.Players ?? [];
            return (
              <li key={p.RegisterTournamentId || p._id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
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
                      ) : null}
                    </div>
                  </div>
                  {out ? null : (
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setPending({ kind: "team", name: p.TeamName })}
                    >
                      {teamAction}
                    </Button>
                  )}
                </div>
                {!out && players.length > 0 ? (
                  <ul className="mt-2 space-y-1 pl-11">
                    {players.map((pl) => {
                      const label =
                        pl.UserName || pl.GameUserName || "Player";
                      return (
                        <li
                          key={pl.User_id}
                          className="flex items-center justify-between gap-2 text-xs text-body"
                        >
                          <span className="truncate">
                            {label}
                            {pl.GameUserName && pl.UserName
                              ? ` · ${pl.GameUserName}`
                              : ""}
                          </span>
                          {!started && pl.User_id ? (
                            <button
                              type="button"
                              className="shrink-0 text-lose hover:underline"
                              onClick={() =>
                                setPending({
                                  kind: "player",
                                  userId: pl.User_id,
                                  label,
                                  teamName: p.TeamName,
                                })
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CollapsiblePanel>
      <Confirm
        open={Boolean(pending)}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
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
