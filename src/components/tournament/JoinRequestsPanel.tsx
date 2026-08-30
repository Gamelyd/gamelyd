"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JoinRequest } from "@/lib/schemas/joinRequest";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  listJoinRequestsAction,
  acceptJoinRequestAction,
  declineJoinRequestAction,
} from "@/server/actions/joinRequestActions";

/** Manager view of pending requests to join an invite-only tournament. */
export function JoinRequestsPanel({ tournamentId }: { tournamentId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listJoinRequestsAction(tournamentId).then((result) => {
      if (active && result.ok) setRequests(result.data);
    });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  if (requests.length === 0) return null;

  const accept = async (id: string) => {
    setBusyId(id);
    const result = await acceptJoinRequestAction(id);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.message ?? "Accepted");
      setRequests((prev) => prev.filter((r) => r.JoinRequestId !== id));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const decline = async (id: string) => {
    setBusyId(id);
    const result = await declineJoinRequestAction(id);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.message ?? "Declined");
      setRequests((prev) => prev.filter((r) => r.JoinRequestId !== id));
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
        Join requests ({requests.length})
      </h3>
      <ul className="flex flex-col gap-3">
        {requests.map((req) => (
          <li
            key={req.JoinRequestId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-2 bg-surface p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-white">{req.TeamName}</p>
              <p className="text-xs text-body">
                {req.UserName ? `@${req.UserName}` : "Player"}
                {req.Players.length > 1
                  ? ` · ${req.Players.length} players`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                loading={busyId === req.JoinRequestId}
                onClick={() => void accept(req.JoinRequestId)}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="dark"
                disabled={busyId === req.JoinRequestId}
                onClick={() => void decline(req.JoinRequestId)}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
