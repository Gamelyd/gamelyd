"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { TOURNAMENT_REPORT_REASONS } from "@/lib/schemas/misc";
import { reportTournamentAction } from "@/server/actions/contactActions";
import { LIMITS } from "@/lib/limits";

/**
 * Lets a player raise an issue about an event straight from its page, so the
 * admin inbox gets it with the tournament and reporter already attached.
 */
export function ReportTournament({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(TOURNAMENT_REPORT_REASONS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const result = await reportTournamentAction({
      TournamentId: tournamentId,
      Reason: reason,
      Message: message,
    });
    setSending(false);
    if (result.ok) {
      toast.success(result.message ?? "Report sent");
      setOpen(false);
      setMessage("");
      setSent(true);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-sm text-body underline-offset-4 transition-colors hover:text-white hover:underline"
      >
        {sent ? "Report sent" : "Report this tournament"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Report ${tournamentName}`}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-body">
            Tell us what is wrong and our team will look into it. The host is
            not told who reported them.
          </p>
          <Select
            label="What is this about?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            options={TOURNAMENT_REPORT_REASONS.map((r) => ({
              value: r,
              label: r,
            }))}
          />
          <TextArea
            label="What happened?"
            value={message}
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Give us the detail we would need to check this, such as which match or which team."
            maxLength={LIMITS.message}
            required
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="dark" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={sending}
              disabled={message.trim().length < 10}
            >
              Send report
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
