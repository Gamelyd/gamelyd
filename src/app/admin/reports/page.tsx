"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { Loader } from "@/components/ui/Loader";
import { useToast } from "@/components/ui/Toast";
import { RowMenu } from "@/components/ui/RowMenu";
import {
  BulkActionBar,
  SelectCheckbox,
  useRowSelection,
} from "@/components/ui/TableSelection";
import type { Paginated } from "@/lib/result";
import type { ReportAbuse, ReportKind } from "@/lib/schemas/misc";
import {
  adminBulkResolveReportsAction,
  adminDeleteReportAction,
  adminListReportsAction,
  adminResolveReportAction,
} from "@/server/actions/adminActions";

const KINDS: { id: ReportKind | "ALL"; label: string }[] = [
  { id: "ALL", label: "Everything" },
  { id: "TOURNAMENT", label: "Tournaments" },
  { id: "CONTACT_CHANGE", label: "Contact changes" },
  { id: "USER", label: "Users" },
  { id: "OTHER", label: "Other" },
];

const STATUSES: { id: "OPEN" | "DONE" | "ALL"; label: string }[] = [
  { id: "OPEN", label: "Open" },
  { id: "DONE", label: "Handled" },
  { id: "ALL", label: "All" },
];

export default function AdminReportsPage() {
  const toast = useToast();
  const [kind, setKind] = useState<ReportKind | "ALL">("ALL");
  const [status, setStatus] = useState<"OPEN" | "DONE" | "ALL">("OPEN");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ReportAbuse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const visibleIds = useMemo(
    () => rows.map((r) => r.ReportAbuseId),
    [rows],
  );
  const selection = useRowSelection(visibleIds);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void adminListReportsAction(kind, status, page).then((result) => {
      if (!active) return;
      if (result.ok) setData(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind, status, page, reload, toast]);

  const refresh = () => {
    selection.clear();
    setReload((r) => r + 1);
  };

  const run = async (
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      refresh();
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  };

  const bulkResolve = async () => {
    setBusy(true);
    const result = await adminBulkResolveReportsAction(selection.ids);
    setBusy(false);
    setBulkOpen(false);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      if (result.data.failed.length > 0) toast.error(result.data.failed[0]);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Reports</h1>
        <p className="mt-1 text-sm text-body">
          Issues players raised about tournaments, and requests from verified
          users to change their contact details.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-surface-2 bg-surface p-1">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStatus(s.id);
                setPage(1);
                selection.clear();
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === s.id
                  ? "bg-primary/15 text-primary"
                  : "text-body hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-surface-2 bg-surface p-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKind(k.id);
                setPage(1);
                selection.clear();
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                kind === k.id
                  ? "bg-primary/15 text-primary"
                  : "text-body hover:text-white"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <Loader label="Loading reports" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">Nothing here. That is a good sign.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-surface-2">
          <table className="w-full min-w-215 text-left text-sm">
            <thead className="bg-surface-2 text-body">
              <tr>
                <th className="w-10 px-4 py-3">
                  <SelectCheckbox
                    label="Select all reports on this page"
                    checked={selection.allVisibleSelected}
                    indeterminate={selection.someVisibleSelected}
                    onChange={selection.toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">About</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ReportAbuseId}
                  className={`border-t border-surface-2 align-top ${
                    selection.isSelected(r.ReportAbuseId) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <SelectCheckbox
                      label={`Select report from ${r.Name}`}
                      checked={selection.isSelected(r.ReportAbuseId)}
                      onChange={() => selection.toggle(r.ReportAbuseId)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{r.Name || "Unknown"}</div>
                    <div className="text-xs text-body">{r.Email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.Kind === "TOURNAMENT" && r.TournamentId ? (
                      <Link
                        href={`/tournament/${r.TournamentId}`}
                        className="text-primary hover:underline"
                      >
                        {r.TournamentName || "Tournament"}
                      </Link>
                    ) : (
                      <span className="text-body">
                        {r.Kind === "CONTACT_CHANGE"
                          ? "Contact change"
                          : r.For || "Platform"}
                      </span>
                    )}
                    {r.Reason ? (
                      <div className="mt-0.5 text-xs text-body">{r.Reason}</div>
                    ) : null}
                  </td>
                  <td className="max-w-100 px-4 py-3">
                    {r.Kind === "CONTACT_CHANGE" ? (
                      <div className="text-xs text-white">
                        {r.RequestedEmail ? (
                          <div>New email: {r.RequestedEmail}</div>
                        ) : null}
                        {r.RequestedPhone ? (
                          <div>New phone: {r.RequestedPhone}</div>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap text-xs text-body">
                      {r.Message}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.IsCompleted
                          ? "bg-win-deep text-white"
                          : "bg-yellow/15 text-yellow"
                      }`}
                    >
                      {r.IsCompleted ? "Handled" : "Open"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={`Actions for report from ${r.Name}`}
                      actions={[
                        {
                          label: r.IsCompleted
                            ? "Reopen"
                            : "Mark as handled",
                          onSelect: () =>
                            void run(() =>
                              adminResolveReportAction(r.ReportAbuseId),
                            ),
                        },
                        ...(r.Kind === "TOURNAMENT" && r.TournamentId
                          ? [
                              {
                                label: "Open tournament",
                                onSelect: () =>
                                  window.open(
                                    `/tournament/${r.TournamentId}`,
                                    "_blank",
                                  ),
                              },
                            ]
                          : []),
                        ...(r.UserID
                          ? [
                              {
                                label: "Open reporter profile",
                                onSelect: () =>
                                  window.open(
                                    `/profile/${r.UserID}`,
                                    "_blank",
                                  ),
                              },
                            ]
                          : []),
                        {
                          label: "Delete",
                          danger: true,
                          onSelect: () =>
                            void run(() =>
                              adminDeleteReportAction(r.ReportAbuseId),
                            ),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.last_page > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="dark"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-body">
            Page {data.page} of {data.last_page} ({data.total} total)
          </span>
          <Button
            variant="dark"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => Math.min(p + 1, data.last_page))}
          >
            Next
          </Button>
        </div>
      ) : null}

      <BulkActionBar
        count={selection.count}
        noun="report"
        onClear={selection.clear}
      >
        <Button onClick={() => setBulkOpen(true)}>Mark as handled</Button>
      </BulkActionBar>

      <Confirm
        open={bulkOpen}
        title={`Mark ${selection.count} report${selection.count === 1 ? "" : "s"} as handled?`}
        message="Reports already handled are left as they are."
        confirmLabel="Mark handled"
        loading={busy}
        onConfirm={() => void bulkResolve()}
        onCancel={() => {
          if (!busy) setBulkOpen(false);
        }}
      />
    </div>
  );
}
