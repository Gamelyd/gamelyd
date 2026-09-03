"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/ui/Loader";
import { RowMenu } from "@/components/ui/RowMenu";
import {
  BulkActionBar,
  SelectCheckbox,
  useRowSelection,
} from "@/components/ui/TableSelection";
import type { User } from "@/lib/schemas/user";
import type { BulkUserOp } from "@/lib/schemas/admin";
import { DEFAULT_PLANS, PLAN_ORDER, type Plan } from "@/lib/plans";
import { VerifiedName } from "@/components/ui/VerifiedName";
import type { Paginated } from "@/lib/result";
import { displayName } from "@/lib/displayName";
import {
  adminBulkUserAction,
  adminListUsersAction,
  adminSetUserTypeAction,
  adminSetPlanAction,
  adminSetUserVerifiedAction,
  adminToggleSuspendUserAction,
  adminToggleBanUserAction,
  adminToggleDeleteUserAction,
} from "@/server/actions/adminActions";

const PLAN_OPTIONS: Plan[] = [...PLAN_ORDER];

interface PendingAction {
  id: string;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: "danger" | "default";
  action: () => Promise<{ ok: boolean; message?: string; error?: string }>;
}

export default function AdminUsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [bulk, setBulk] = useState<{ op: BulkUserOp; label: string } | null>(
    null,
  );

  const rows = useMemo(() => data?.items ?? [], [data]);
  const visibleIds = useMemo(() => rows.map((u) => u.user_id), [rows]);
  const selection = useRowSelection(visibleIds);

  useEffect(() => {
    let activeReq = true;
    void adminListUsersAction(search, page).then((result) => {
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
    userId: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusyId(userId);
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
    const result = await adminBulkUserAction(selection.ids, bulk.op);
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
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Users</h1>
        <p className="mt-1 text-sm text-body">
          Verify players, manage admin access, and moderate accounts.
        </p>
      </div>

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
          placeholder="Search by name or username"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-surface-2">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="w-10 px-4 py-3">
                <SelectCheckbox
                  label="Select all users on this page"
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAll}
                />
              </th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.user_id === me?.user_id;
              const isAdmin = u.user_type === "ADMIN";
              return (
                <tr
                  key={u.user_id}
                  className={`border-t border-surface-2 ${
                    selection.isSelected(u.user_id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <SelectCheckbox
                      label={`Select ${u.user_name}`}
                      checked={selection.isSelected(u.user_id)}
                      onChange={() => selection.toggle(u.user_id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-white">
                    <VerifiedName
                      name={displayName(u)}
                      verified={u.verified}
                    />
                    <span className="block text-xs text-body">
                      @{u.user_name}
                      {isSelf ? " · you" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.plan === "FREE"
                          ? "bg-surface-2 text-body"
                          : "bg-win-deep text-white"
                      }`}
                    >
                      {DEFAULT_PLANS[u.plan].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isAdmin
                          ? "bg-primary/15 text-primary"
                          : "bg-surface-2 text-body"
                      }`}
                    >
                      {u.user_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.isDeleted ? (
                      <span className="text-xs text-lose">Deleted</span>
                    ) : u.isBanned ? (
                      <span className="text-xs text-pink">Banned</span>
                    ) : u.isSuspended ? (
                      <span className="text-xs text-yellow">Suspended</span>
                    ) : (
                      <span className="text-xs text-win">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={`Actions for ${u.user_name}`}
                      actions={[
                        {
                          label: u.verified ? "Remove verification" : "Verify",
                          onSelect: () =>
                            void run(u.user_id, () =>
                              adminSetUserVerifiedAction(
                                u.user_id,
                                !u.verified,
                              ),
                            ),
                        },
                        ...PLAN_OPTIONS.filter((p) => p !== u.plan).map(
                          (p) => ({
                            label: `Move to ${DEFAULT_PLANS[p].label} plan`,
                            onSelect: () =>
                              void run(u.user_id, () =>
                                adminSetPlanAction("user", u.user_id, p),
                              ),
                          }),
                        ),
                        {
                          label: isAdmin ? "Make member" : "Make admin",
                          disabled: isSelf,
                          hint: isSelf
                            ? "You cannot change your own role"
                            : undefined,
                          onSelect: () =>
                            void run(u.user_id, () =>
                              adminSetUserTypeAction(
                                u.user_id,
                                isAdmin ? "USER" : "ADMIN",
                              ),
                            ),
                        },
                        {
                          label: u.isSuspended ? "Unsuspend" : "Suspend",
                          danger: !u.isSuspended,
                          disabled: isSelf,
                          onSelect: () =>
                            setPending({
                              id: u.user_id,
                              title: u.isSuspended
                                ? "Unsuspend this user?"
                                : "Suspend this user?",
                              message: u.isSuspended
                                ? "They will be able to join tournaments again."
                                : "They can still sign in, but cannot register for or join tournaments.",
                              confirmLabel: u.isSuspended
                                ? "Unsuspend"
                                : "Suspend",
                              confirmVariant: u.isSuspended
                                ? "default"
                                : "danger",
                              action: () =>
                                adminToggleSuspendUserAction(u.user_id),
                            }),
                        },
                        {
                          label: u.isBanned ? "Unban" : "Ban",
                          danger: !u.isBanned,
                          disabled: isSelf,
                          onSelect: () =>
                            setPending({
                              id: u.user_id,
                              title: u.isBanned
                                ? "Unban this user?"
                                : "Ban this user?",
                              message: u.isBanned
                                ? "They will be able to sign in again."
                                : "They will be signed out on every device and blocked from signing in.",
                              confirmLabel: u.isBanned ? "Unban" : "Ban",
                              confirmVariant: u.isBanned
                                ? "default"
                                : "danger",
                              action: () =>
                                adminToggleBanUserAction(u.user_id),
                            }),
                        },
                        {
                          label: u.isDeleted ? "Restore" : "Delete",
                          danger: !u.isDeleted,
                          disabled: isSelf,
                          onSelect: () =>
                            setPending({
                              id: u.user_id,
                              title: u.isDeleted
                                ? "Restore this user?"
                                : "Delete this user?",
                              message: u.isDeleted
                                ? "The account will be restored."
                                : "The account will be marked as deleted. You can restore it later.",
                              confirmLabel: u.isDeleted ? "Restore" : "Delete",
                              confirmVariant: u.isDeleted
                                ? "default"
                                : "danger",
                              action: () =>
                                adminToggleDeleteUserAction(u.user_id),
                            }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
            {loading && !data ? (
              <tr>
                <td colSpan={7}>
                  <Loader variant="compact" label="Loading users" />
                </td>
              </tr>
            ) : null}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-body">
                  No users found.
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
            Page {data.page} of {data.last_page}
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
        noun="user"
        onClear={selection.clear}
      >
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "VERIFY", label: "Verify" })}
        >
          Verify
        </Button>
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "UNVERIFY", label: "Unverify" })}
        >
          Unverify
        </Button>
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "UNSUSPEND", label: "Unsuspend" })}
        >
          Unsuspend
        </Button>
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "SUSPEND", label: "Suspend" })}
        >
          Suspend
        </Button>
        <Button
          variant="dark"
          onClick={() => setBulk({ op: "UNBAN", label: "Unban" })}
        >
          Unban
        </Button>
        <Button
          variant="danger"
          onClick={() => setBulk({ op: "BAN", label: "Ban" })}
        >
          Ban
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
        title={`${bulk?.label ?? ""} ${selection.count} user${selection.count === 1 ? "" : "s"}?`}
        message={
          bulk?.op === "DELETE" || bulk?.op === "BAN"
            ? "Affected accounts are signed out immediately. You can undo this from the same menu."
            : "This applies to every selected user."
        }
        confirmLabel={bulk?.label}
        confirmVariant={
          bulk?.op === "DELETE" || bulk?.op === "BAN" ? "danger" : "default"
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
