"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Draw } from "@/lib/schemas/draw";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import {
  advanceGroupStageAction,
  drawKnockoutNextAction,
  getDrawsAction,
} from "@/server/actions/drawActions";
import type { NextStagePrompt } from "@/lib/nextStagePrompt";

export function NextStageModal({
  prompt,
  tournamentId,
  advancePerGroup,
  onClose,
  onDrawn,
  onGoToGroups,
}: {
  prompt: NextStagePrompt | null;
  tournamentId: string;
  advancePerGroup: number;
  onClose: () => void;
  onDrawn: (draws: Draw[], kind: "advance" | "knockoutNext" | "nextStage") => void;
  onGoToGroups: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!prompt) return;
    if (prompt.kind === "breakTies") {
      onGoToGroups();
      onClose();
      return;
    }

    setBusy(true);
    const result =
      prompt.kind === "advance"
        ? await advanceGroupStageAction(tournamentId, {
            AdvancePerGroup: advancePerGroup,
          })
        : await drawKnockoutNextAction({ TournamentId: tournamentId });
    if (!result.ok) {
      setBusy(false);
      toast.error(result.error);
      return;
    }

    const all = await getDrawsAction(tournamentId);
    setBusy(false);
    toast.success(
      prompt.kind === "advance"
        ? "Knockout stage drawn"
        : "Next round drawn",
    );
    onDrawn(all.ok ? all.data : result.data, prompt.kind);
    onClose();
    router.refresh();
  };

  return (
    <Confirm
      open={prompt !== null}
      title={prompt?.title}
      message={prompt?.message ?? ""}
      confirmLabel={prompt?.confirmLabel ?? "Continue"}
      confirmVariant="default"
      loading={busy}
      onConfirm={() => void handleConfirm()}
      onCancel={() => {
        if (!busy) onClose();
      }}
    />
  );
}
