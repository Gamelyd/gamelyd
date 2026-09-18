"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { adminPrefillParticipantsAction } from "@/server/actions/adminActions";

/**
 * Admin-only test helper: fill every open spot with random users as full
 * teams. The server skips registration emails, so nobody is notified.
 */
export function PrefillParticipants({
  tournamentId,
  started,
  openSpots,
  onDone,
}: {
  tournamentId: string;
  started: boolean;
  openSpots: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const prefill = async () => {
    setBusy(true);
    const result = await adminPrefillParticipantsAction(tournamentId);
    setBusy(false);
    setConfirming(false);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      onDone();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="mt-4 border-t border-surface-2 pt-4">
      <p className="mb-3 text-sm text-body">
        Admin, for testing: fill every open spot with random users as full
        teams. They are not emailed.
      </p>
      <Button
        variant="dark"
        disabled={busy || started || openSpots <= 0}
        onClick={() => setConfirming(true)}
      >
        Prefill with users
      </Button>
      <Confirm
        open={confirming}
        title="Prefill with users?"
        message={`Random users will be added as teams until the tournament is full (${Math.max(openSpots, 0)} spots left). They can be removed individually afterwards.`}
        confirmLabel="Prefill"
        confirmVariant="default"
        loading={busy}
        onConfirm={prefill}
        onCancel={() => {
          if (!busy) setConfirming(false);
        }}
      />
    </div>
  );
}
