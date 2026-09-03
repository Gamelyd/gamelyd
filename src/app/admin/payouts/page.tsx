"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Confirm } from "@/components/ui/Confirm";
import { Loader } from "@/components/ui/Loader";
import { useToast } from "@/components/ui/Toast";
import { RowMenu } from "@/components/ui/RowMenu";
import {
  BulkActionBar,
  SelectCheckbox,
  useRowSelection,
} from "@/components/ui/TableSelection";
import { formatMoney } from "@/lib/currency";
import { placeLabel } from "@/lib/schemas/tournament";
import type {
  PayoutRecord,
  PayoutStatus,
  PayoutTotals,
} from "@/lib/schemas/payment";
import {
  adminDisbursePayoutAction,
  adminDisbursePayoutsAction,
  adminListPayoutsAction,
  adminMarkPayoutPaidAction,
  adminPayoutTotalsAction,
} from "@/server/actions/payoutActions";

const TABS: { id: PayoutStatus | "ALL"; label: string }[] = [
  { id: "OWED", label: "Owed" },
  { id: "PROCESSING", label: "Processing" },
  { id: "FAILED", label: "Failed" },
  { id: "PAID", label: "Paid" },
  { id: "ALL", label: "All" },
];

const STATUS_STYLE: Record<PayoutStatus, string> = {
  OWED: "bg-yellow/15 text-yellow",
  PROCESSING: "bg-primary/15 text-primary",
  PAID: "bg-win-deep text-white",
  FAILED: "bg-lose/15 text-lose",
};

export default function AdminPayoutsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<PayoutStatus | "ALL">("OWED");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PayoutRecord[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<PayoutTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sendTarget, setSendTarget] = useState<PayoutRecord | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<PayoutRecord | null>(null);
  const [manualRef, setManualRef] = useState("");

  const visibleIds = useMemo(() => rows.map((row) => row.payout_id), [rows]);
  const selection = useRowSelection(visibleIds);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void adminListPayoutsAction(status, query, page).then((result) => {
      if (!active) return;
      if (result.ok) {
        setRows(result.data.items);
        setLastPage(result.data.last_page);
        setTotal(result.data.total);
      } else {
        toast.error(result.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [status, query, page, reload, toast]);

  useEffect(() => {
    void adminPayoutTotalsAction().then((result) => {
      if (result.ok) setTotals(result.data);
    });
  }, [reload]);

  const refresh = () => {
    selection.clear();
    setReload((r) => r + 1);
  };

  const sendOne = async (row: PayoutRecord) => {
    setBusy(true);
    const result = await adminDisbursePayoutAction(row.payout_id);
    setBusy(false);
    setSendTarget(null);
    if (result.ok) {
      toast.success(result.message ?? "Transfer sent");
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const sendSelected = async () => {
    setBusy(true);
    const result = await adminDisbursePayoutsAction(selection.ids);
    setBusy(false);
    setBulkOpen(false);
    if (result.ok) {
      if (result.data.failed.length > 0) {
        toast.error(
          `${result.data.failed.length} could not be sent: ${result.data.failed[0].error}`,
        );
      } else {
        toast.success(result.message ?? "Transfers sent");
      }
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const markPaid = async () => {
    if (!manualTarget) return;
    setBusy(true);
    const result = await adminMarkPayoutPaidAction(
      manualTarget.payout_id,
      manualRef,
    );
    setBusy(false);
    if (result.ok) {
      toast.success(result.message ?? "Marked as paid");
      setManualTarget(null);
      setManualRef("");
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const sendableSelected = rows.filter(
    (row) =>
      selection.isSelected(row.payout_id) &&
      row.recipientReady &&
      (row.status === "OWED" || row.status === "FAILED"),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Payouts</h1>
        <p className="mt-1 text-sm text-body">
          Prize money owed to team captains and hosts. Transfers go to the
          payout account on each recipient&apos;s profile.
        </p>
      </div>

      {totals ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Owed" value={totals.owed} tone="yellow" />
          <Stat label="Processing" value={totals.processing} tone="primary" />
          <Stat label="Paid" value={totals.paid} tone="win" />
          <Stat
            label="Blocked · no account"
            value={totals.needsAccount}
            tone={totals.needsAccount > 0 ? "lose" : "body"}
          />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-surface-2 bg-surface p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
                selection.clear();
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.id
                  ? "bg-primary/15 text-primary"
                  : "text-body hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Team, winner, or tournament"
          />
          <Button type="submit" variant="dark">
            Search
          </Button>
        </form>
      </div>

      {loading && rows.length === 0 ? (
        <Loader label="Loading payouts" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">
            Nothing here. Payout lines are created automatically when a paid or
            sponsored tournament finishes.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-surface-2">
          <table className="w-full min-w-215 text-left text-sm">
            <thead className="bg-surface-2 text-body">
              <tr>
                <th className="w-10 px-4 py-3">
                  <SelectCheckbox
                    label="Select all payouts on this page"
                    checked={selection.allVisibleSelected}
                    indeterminate={selection.someVisibleSelected}
                    onChange={selection.toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Tournament</th>
                <th className="px-4 py-3 font-medium">Place</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sendable =
                  row.status === "OWED" || row.status === "FAILED";
                return (
                  <tr
                    key={row.payout_id}
                    className={`border-t border-surface-2 ${
                      selection.isSelected(row.payout_id)
                        ? "bg-primary/5"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <SelectCheckbox
                        label={`Select payout to ${row.teamName}`}
                        checked={selection.isSelected(row.payout_id)}
                        onChange={() => selection.toggle(row.payout_id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white">
                        {row.userName || "Unknown"}
                      </div>
                      <div className="text-xs text-body">
                        {row.place > 0 ? `Captain · ${row.teamName}` : "Host"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {row.tournamentName || row.tournamentId}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {row.place > 0 ? placeLabel(row.place) : "Remainder"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-white">
                      {formatMoney(row.amount, row.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]}`}
                      >
                        {row.status}
                      </span>
                      {!row.recipientReady && sendable ? (
                        <div className="mt-1 text-xs text-lose">
                          No payout account
                        </div>
                      ) : null}
                      {row.failureReason ? (
                        <div className="mt-1 max-w-55 text-xs text-lose">
                          {row.failureReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <RowMenu
                        label={`Actions for ${row.teamName}`}
                        actions={[
                          {
                            label:
                              row.status === "FAILED"
                                ? "Retry transfer"
                                : "Send transfer",
                            disabled: !sendable || !row.recipientReady,
                            hint:
                              sendable && !row.recipientReady
                                ? "Recipient has no payout account"
                                : undefined,
                            onSelect: () => setSendTarget(row),
                          },
                          {
                            label: "Mark paid manually",
                            disabled: row.status === "PAID",
                            hint: "Records money you sent outside Gamelyd",
                            onSelect: () => {
                              setManualTarget(row);
                              setManualRef("");
                            },
                          },
                          {
                            label: "Open tournament",
                            onSelect: () =>
                              window.open(
                                `/tournament/${row.tournamentId}`,
                                "_blank",
                              ),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-body">
          <span>
            Page {page} of {lastPage} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="dark"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </Button>
            <Button
              variant="dark"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(p + 1, lastPage))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <BulkActionBar
        count={selection.count}
        noun="payout"
        onClear={selection.clear}
      >
        <Button
          disabled={sendableSelected.length === 0}
          onClick={() => setBulkOpen(true)}
        >
          Send {sendableSelected.length || ""} transfer
          {sendableSelected.length === 1 ? "" : "s"}
        </Button>
      </BulkActionBar>

      <Confirm
        open={sendTarget !== null}
        title="Send this transfer?"
        message={
          sendTarget
            ? `Send ${formatMoney(sendTarget.amount, sendTarget.currency)} to ${sendTarget.userName || "this recipient"}. Transfers cannot be undone from here.`
            : ""
        }
        confirmLabel="Send"
        loading={busy}
        onConfirm={() => sendTarget && void sendOne(sendTarget)}
        onCancel={() => {
          if (!busy) setSendTarget(null);
        }}
      />

      <Confirm
        open={bulkOpen}
        title={`Send ${sendableSelected.length} transfers?`}
        message={`This sends ${formatMoney(
          sendableSelected.reduce((sum, row) => sum + row.amount, 0),
          sendableSelected[0]?.currency,
        )} across ${sendableSelected.length} recipient${sendableSelected.length === 1 ? "" : "s"}. Rows without a payout account are skipped.`}
        confirmLabel="Send all"
        loading={busy}
        onConfirm={() => void sendSelected()}
        onCancel={() => {
          if (!busy) setBulkOpen(false);
        }}
      />

      <Modal
        open={manualTarget !== null}
        onClose={() => setManualTarget(null)}
        title="Mark as paid"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void markPaid();
          }}
        >
          <p className="text-sm text-body">
            Use this only when you sent{" "}
            {manualTarget
              ? formatMoney(manualTarget.amount, manualTarget.currency)
              : "the money"}{" "}
            to {manualTarget?.userName || "the recipient"} outside Gamelyd. It
            closes the line without moving money.
          </p>
          <Input
            label="Reference (optional)"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder="Bank transfer reference"
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setManualTarget(null)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Mark paid
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "yellow" | "primary" | "win" | "lose" | "body";
}) {
  const color = {
    yellow: "text-yellow",
    primary: "text-primary",
    win: "text-win",
    lose: "text-lose",
    body: "text-white",
  }[tone];
  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-body">{label}</p>
      <p className={`mt-1 font-display text-2xl ${color}`}>{value}</p>
    </div>
  );
}
