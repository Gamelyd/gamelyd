"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/lib/schemas/user";
import type { Paginated } from "@/lib/result";
import {
  adminListUsersAction,
  adminSetUserTypeAction,
  adminToggleBanUserAction,
  adminToggleDeleteUserAction,
} from "@/server/actions/adminActions";

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

  const run = async (
    userId: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusyId(userId);
    const result = await action();
    setBusyId("");
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  };

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-white">Users</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(term);
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
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => {
              const isSelf = u.user_id === me?.user_id;
              const isAdmin = u.user_type === "ADMIN";
              return (
                <tr key={u.user_id} className="border-t border-surface-2">
                  <td className="px-4 py-3 text-white">
                    {u.first_name} {u.last_name}
                    <span className="block text-xs text-body">
                      @{u.user_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                    ) : u.isSuspended ? (
                      <span className="text-xs text-pink">Banned</span>
                    ) : (
                      <span className="text-xs text-win">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        loading={busyId === u.user_id}
                        disabled={isSelf}
                        onClick={() =>
                          run(u.user_id, () =>
                            adminSetUserTypeAction(
                              u.user_id,
                              isAdmin ? "USER" : "ADMIN",
                            ),
                          )
                        }
                      >
                        {isAdmin ? "Make member" : "Make admin"}
                      </Button>
                      <Button
                        variant="dark"
                        disabled={isSelf}
                        onClick={() =>
                          run(u.user_id, () =>
                            adminToggleBanUserAction(u.user_id),
                          )
                        }
                      >
                        {u.isSuspended ? "Unban" : "Ban"}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={isSelf}
                        onClick={() =>
                          run(u.user_id, () =>
                            adminToggleDeleteUserAction(u.user_id),
                          )
                        }
                      >
                        {u.isDeleted ? "Restore" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-body">
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
    </div>
  );
}
