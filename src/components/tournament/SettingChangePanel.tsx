"use client";

import { useState } from "react";
import type { PendingSettingChange, Tournament } from "@/lib/schemas/tournament";
import { settingChangeReady } from "@/lib/settingChange";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import {
  acceptSettingChangeAction,
  addTournamentAnnouncementAction,
  applySettingChangeAction,
  cancelSettingChangeAction,
} from "@/server/actions/tournamentActions";

export function SettingChangePanel({
  tournamentId,
  change,
  currentUserId,
  canApply,
  onUpdated,
}: {
  tournamentId: string;
  change: PendingSettingChange;
  currentUserId?: string;
  canApply: boolean;
  onUpdated: (tournament: Tournament) => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState<"accept" | "apply" | "cancel" | "announce" | "">("");
  const ready = settingChangeReady(change);
  // An admin can push a change through without waiting, so a single player who
  // never responds cannot freeze the tournament for good.
  const canForce = user?.user_type === "ADMIN";
  const accepted = change.AcceptedUserIds.length;
  const required = change.RequiredUserIds.length;
  const isVoter = Boolean(
    currentUserId && change.RequiredUserIds.includes(currentUserId),
  );
  const alreadyAccepted = Boolean(
    currentUserId && change.AcceptedUserIds.includes(currentUserId),
  );

  const run = async (
    kind: "accept" | "apply" | "cancel",
    action: () => Promise<{ ok: boolean; data?: Tournament; error?: string; message?: string }>,
  ) => {
    setBusy(kind);
    const result = await action();
    setBusy("");
    if (!result.ok || !result.data) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(result.message ?? "Done");
    onUpdated(result.data);
  };

  const announce = async () => {
    setBusy("announce");
    const result = await addTournamentAnnouncementAction(tournamentId, {
      Body: `Please accept this setting change: ${change.Summary}`,
    });
    setBusy("");
    if (result.ok) {
      toast.success("Everyone was notified to accept");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/10 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        Setting change
      </p>
      <p className="mt-1 text-sm text-white">{change.Summary}</p>
      <p className="mt-2 text-sm text-body">
        {required === 0
          ? "No registered players, so the host can apply this now."
          : `${accepted} of ${required} players have accepted.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {isVoter && !alreadyAccepted ? (
          <Button
            type="button"
            loading={busy === "accept"}
            disabled={Boolean(busy)}
            onClick={() =>
              void run("accept", () => acceptSettingChangeAction(tournamentId))
            }
          >
            Accept
          </Button>
        ) : null}
        {isVoter && alreadyAccepted ? (
          <p className="self-center text-xs text-primary">You accepted</p>
        ) : null}
        {canApply ? (
          <>
            <Button
              type="button"
              loading={busy === "apply"}
              disabled={(!ready && !canForce) || Boolean(busy)}
              onClick={() =>
                void run("apply", () => applySettingChangeAction(tournamentId))
              }
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              loading={busy === "announce"}
              disabled={Boolean(busy)}
              onClick={() => void announce()}
            >
              Tell everyone to accept
            </Button>
            <Button
              type="button"
              variant="dark"
              loading={busy === "cancel"}
              disabled={Boolean(busy)}
              onClick={() =>
                void run("cancel", () => cancelSettingChangeAction(tournamentId))
              }
            >
              Cancel
            </Button>
          </>
        ) : null}
      </div>
      {canApply && !ready ? (
        <p className="mt-3 text-xs text-body">
          {canForce
            ? "Not everyone has accepted. Applying now overrides them."
            : "Apply unlocks when every registered player accepts."}
        </p>
      ) : null}
    </div>
  );
}
