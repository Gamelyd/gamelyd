"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { Loader } from "@/components/ui/Loader";
import { RowMenu } from "@/components/ui/RowMenu";
import {
  BulkActionBar,
  SelectCheckbox,
  useRowSelection,
} from "@/components/ui/TableSelection";
import type { Tournament } from "@/lib/schemas/tournament";
import type { BulkTournamentOp } from "@/lib/schemas/admin";
import { VerifiedName } from "@/components/ui/VerifiedName";
import type { Paginated } from "@/lib/result";
import {
  adminBulkTournamentAction,
  adminListTournamentsAction,
  adminToggleDeleteTournamentAction,
  adminToggleFeaturedTournamentAction,
  adminToggleSuspendTournamentAction,
} from "@/server/actions/adminActions";

interface PendingAction {
  id: string;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: "danger" | "default";
  action: () => Promise<{ ok: boolean; message?: string; error?: string }>;
}

export default function AdminTournamentsPage() {
  const toast = useToast();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Tournament> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [bulk, setBulk] = useState<{
    op: BulkTournamentOp;
    label: string;
  } | null>(null);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const visibleIds = useMemo(() => rows.map((t) => t._id), [rows]);
  const selection = useRowSelection(visibleIds);

  useEffect(() => {
    let activeReq = true;
    void adminListTournamentsAction(search, page).then((result) => {
      if (!activeReq) return;
      if (result.ok) setData(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
    return () => {
      activeReq = false;
    };
  }, [search, page, reload, toast]);

  const refresh = () => {
    selection.clear();
    setReload((r) => r + 1);
  };

  const run = async (
    id: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusyId(id);
    const result = await action();
    setBusyId("");
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setPending(null);
      setReload((r) => r + 1);
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBusyId("bulk");
    const result = await adminBulkTournamentAction(selection.ids, bulk.op);
    setBusyId("");
    setBulk(null);
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
      <h1 className="mb-2 font-display text-3xl text-white">Tournaments</h1>
      <p className="mb-6 text-sm text-body">
        Home banner shows up to 2 tournaments. Use Manage to reset a tournament
        that was started by mistake.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(term);
          selection.clear();
        }}
        className="mb-6 flex gap-3"
      >
        <Input
          placeholder="Search by name or game"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-surface-2">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="w-10 px-4 py-3">
                <SelectCheckbox
                  label="Select all tournaments on this page"
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAll}
                />
              </th>
              <th className="px-4 py-3 font-medium">Tournament</th>
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Banner</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, index) => (
              <tr
                key={`${t._id}:${index}`}
                className={`border-t border-surface-2 ${
                  selection.isSelected(t._id) ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <SelectCheckbox
                    label={`Select ${t.Name || "tournament"}`}
                    checked={selection.isSelected(t._id)}
                    onChange={() => selection.toggle(t._id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/tournament/${t._id}`}
                    className="text-white hover:text-primary"
                  >
                    {t.Name || "Untitled"}
                  </Link>
                  {t.OrgName ? (
                    <span className="mt-0.5 block text-xs text-body">
                      <VerifiedName
                        name={t.OrgName}
                        verified={t.OrgVerified}
                      />
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-body">{t.GameName || "-"}</td>
                <td className="px-4 py-3 text-body">
                  {t.Payment} · {t.TournamentMode}
                </td>
                <td className="px-4 py-3">
                  {t.IsDeleted ? (
                    <span className="text-xs text-lose">Deleted</span>
                  ) : t.IsSuspended ? (
                    <span className="text-xs text-pink">Suspended</span>
                  ) : t.Start ? (
                    <span className="text-xs text-pink">Started</span>
                  ) : (
                    <span className="text-xs text-win">Open</span>
                  )}
                </td>
                <td className="px-4 py-3 text-body">
                  {t.Date ? new Date(t.Date).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3">
                  {t.Featured ? (
                    <span className="text-xs text-primary">On banner</span>
                  ) : (
                    <span className="text-xs text-body">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RowMenu
                    label={`Actions for ${t.Name || "tournament"}`}
                    actions={[
                      {
                        label: "Manage",
                        onSelect: () =>
                          router.push(`/admin/tournaments/${t._id}`),
                      },
                      {
                        label: t.Featured ? "Remove from banner" : "Add to banner",
                        hint: t.Featured ? undefined : "The home banner holds 2",
                        onSelect: () =>
                          void run(t._id, () =>
                            adminToggleFeaturedTournamentAction(t._id),
                          ),
                      },
                      {
                        label: t.IsSuspended ? "Unsuspend" : "Suspend",
                        danger: !t.IsSuspended,
                        onSelect: () =>
                          setPending({
                            id: t._id,
                            title: t.IsSuspended
                              ? "Unsuspend this tournament?"
                              : "Suspend this tournament?",
                            message: t.IsSuspended
                              ? "The tournament will be visible and usable again."
                              : "The tournament will be hidden from public listings until you unsuspend it.",
                            confirmLabel: t.IsSuspended
                              ? "Unsuspend"
                              : "Suspend",
                            confirmVariant: t.IsSuspended
                              ? "default"
                              : "danger",
                            action: () =>
                              adminToggleSuspendTournamentAction(t._id),
                          }),
                      },
                      {
                        label: t.IsDeleted ? "Restore" : "Delete",
                        danger: !t.IsDeleted,
                        onSelect: () =>
                          setPending({
                            id: t._id,
                            title: t.IsDeleted
                              ? "Restore this tournament?"
                              : "Delete this tournament?",
                            message: t.IsDeleted
                              ? "The tournament will be restored and visible again."
                              : "The tournament will be marked as deleted. You can restore it later.",
                            confirmLabel: t.IsDeleted ? "Restore" : "Delete",
                            confirmVariant: t.IsDeleted ? "default" : "danger",
                            action: () =>
                              adminToggleDeleteTournamentAction(t._id),
                          }),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {loading && !data ? (
              <tr>
                <td colSpan={8}>
                  <Loader variant="compact" label="Loading tournaments" />
                </td>
              </tr>
            ) : null}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-body">
                  No tournaments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
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
      )}

      <BulkActionBar
        count={selection.count}
        noun="tournament"
        onClear={selection.clear}
      >
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "FEATURE", label: "Add to banner" })}
        >
          Add to banner
        </Button>
        <Button
          variant="dark"
          onClick={() =>
            setBulk({ op: "UNFEATURE", label: "Remove from banner" })
          }
        >
          Remove from banner
        </Button>
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "UNSUSPEND", label: "Unsuspend" })}
        >
          Unsuspend
        </Button>
        <Button
          variant="danger"
          onClick={() => setBulk({ op: "SUSPEND", label: "Suspend" })}
        >
          Suspend
        </Button>
        <Button
          variant="danger"
          onClick={() => setBulk({ op: "DELETE", label: "Delete" })}
        >
          Delete
        </Button>
      </BulkActionBar>

      <Confirm
        open={pending !== null}
        title={pending?.title}
        message={pending?.message ?? ""}
        confirmLabel={pending?.confirmLabel}
        confirmVariant={pending?.confirmVariant}
        loading={busyId === pending?.id}
        onConfirm={() => {
          if (pending) void run(pending.id, pending.action);
        }}
        onCancel={() => {
          if (!busyId) setPending(null);
        }}
      />

      <Confirm
        open={bulk !== null}
        title={`${bulk?.label ?? ""} ${selection.count} tournament${selection.count === 1 ? "" : "s"}?`}
        message="This applies to every selected tournament. Rows already in that state are left alone."
        confirmLabel={bulk?.label}
        confirmVariant={
          bulk?.op === "DELETE" || bulk?.op === "SUSPEND"
            ? "danger"
            : "default"
        }
        loading={busyId === "bulk"}
        onConfirm={() => void runBulk()}
        onCancel={() => {
          if (!busyId) setBulk(null);
        }}
      />
    </div>
  );
}
