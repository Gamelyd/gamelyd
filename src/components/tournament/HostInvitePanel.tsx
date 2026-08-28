"use client";

import { useEffect, useMemo, useState } from "react";
import { InviteSearch } from "./InviteSearch";
import type { InviteTournament } from "@/lib/schemas/misc";
import type { Tournament } from "@/lib/schemas/tournament";
import { listHostTournamentInvitesAction } from "@/server/actions/inviteActions";

export function HostInvitePanel({
  tournamentId,
  tournamentType,
  started,
  excludeIds = [],
  registeredCount = 0,
  tournamentSize = 0,
}: {
  tournamentId: string;
  tournamentType: Tournament["TournamentType"];
  started: boolean;
  excludeIds?: string[];
  registeredCount?: number;
  tournamentSize?: number;
}) {
  const [pending, setPending] = useState<InviteTournament[]>([]);
  const full =
    !started && tournamentSize > 0 && registeredCount >= tournamentSize;

  useEffect(() => {
    let active = true;
    void listHostTournamentInvitesAction(tournamentId).then((result) => {
      if (active && result.ok) setPending(result.data);
    });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  const blockedIds = useMemo(
    () => [...excludeIds, ...pending.map((invite) => invite.invitee_id)],
    [excludeIds, pending],
  );

  return (
    <div className="rounded-xl border border-primary/25 bg-surface p-5">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white">
        Invite players
      </h3>
      <p className="mb-3 text-sm text-body">
        {started
          ? "Registration is closed. You can't send more invites."
          : full
            ? "This tournament is full. You can't send more invites. Outstanding invites will be rejected if someone tries to accept."
            : tournamentType === "PRIVATE"
              ? "This event is invite-only. Search a username and send an invite. They register after they accept."
              : "Optional. Send someone an invite so they get a notification and email."}
      </p>
      {!started && !full ? (
        <InviteSearch
          tournamentId={tournamentId}
          kind="TOURNAMENT"
          excludeIds={blockedIds}
          onSent={(invite) =>
            setPending((prev) => [
              invite,
              ...prev.filter((row) => row.invite_id !== invite.invite_id),
            ])
          }
        />
      ) : null}
      {pending.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-surface-2 pt-4 text-sm text-body">
          {pending.map((invite) => (
            <li key={invite.invite_id}>
              Waiting for @{invite.invitee_name || "player"} to accept
              {full ? " · will be rejected (tournament full)" : ""}
            </li>
          ))}
        </ul>
      ) : !started && !full ? (
        <p className="mt-3 text-sm text-body">No pending invites yet.</p>
      ) : null}
    </div>
  );
}
