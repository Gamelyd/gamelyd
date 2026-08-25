"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Tournament } from "@/lib/schemas/tournament";
import type { Paginated } from "@/lib/result";
import {
  adminListTournamentsAction,
  adminToggleDeleteTournamentAction,
  adminToggleFeaturedTournamentAction,
  adminToggleSuspendTournamentAction,
} from "@/server/actions/adminActions";

export default function AdminTournamentsPage() {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Tournament> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState("");

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

  const run = async (
    id: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusyId(id);
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
      <h1 className="mb-2 font-display text-3xl text-white">Tournaments</h1>
      <p className="mb-6 text-sm text-body">
        Home banner shows up to 2 tournaments. Adding a third replaces the oldest.
      </p>

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
          placeholder="Search by name or game"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-surface-2">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="px-4 py-3 font-medium">Tournament</th>
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Banner</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((t, index) => (
              <tr key={`${t._id}:${index}`} className="border-t border-surface-2">
                <td className="px-4 py-3">
                  <Link
                    href={`/tournament/${t._id}`}
                    className="text-white hover:text-primary"
                  >
                    {t.Name || "Untitled"}
                  </Link>
                  {t.OrgName ? (
                    <span className="mt-0.5 block text-xs text-body">
                      {t.OrgName}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-body">{t.GameName || "—"}</td>
                <td className="px-4 py-3 text-body">
                  {t.Payment} · {t.TournamentMode}
                </td>
                <td className="px-4 py-3">
                  {t.IsDeleted ? (
                    <span className="text-xs text-lose">Deleted</span>
                  ) : t.IsSuspended ? (
                    <span className="text-xs text-pink">Suspended</span>
                  ) : (
                    <span className="text-xs text-win">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-body">
                  {t.Date ? new Date(t.Date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  {t.Featured ? (
                    <span className="text-xs text-primary">On banner</span>
                  ) : (
                    <span className="text-xs text-body">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/tournament/${t._id}`}>
                      <Button variant="outline">View</Button>
                    </Link>
                    <Button
                      variant={t.Featured ? "active" : "dark"}
                      loading={busyId === t._id}
                      onClick={() =>
                        run(t._id, () =>
                          adminToggleFeaturedTournamentAction(t._id),
                        )
                      }
                    >
                      {t.Featured ? "Remove banner" : "Add to banner"}
                    </Button>
                    <Button
                      variant="dark"
                      loading={busyId === t._id}
                      onClick={() =>
                        run(t._id, () =>
                          adminToggleSuspendTournamentAction(t._id),
                        )
                      }
                    >
                      {t.IsSuspended ? "Unsuspend" : "Suspend"}
                    </Button>
                    <Button
                      variant="danger"
                      loading={busyId === t._id}
                      onClick={() =>
                        run(t._id, () =>
                          adminToggleDeleteTournamentAction(t._id),
                        )
                      }
                    >
                      {t.IsDeleted ? "Restore" : "Delete"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-body">
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
    </div>
  );
}
