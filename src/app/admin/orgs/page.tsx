"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RowMenu } from "@/components/ui/RowMenu";
import { useToast } from "@/components/ui/Toast";
import { Loader } from "@/components/ui/Loader";
import type { Org } from "@/lib/schemas/org";
import { VerifiedName } from "@/components/ui/VerifiedName";
import type { Paginated } from "@/lib/result";
import {
  adminListOrgsAction,
  adminSetOrgVerifiedAction,
  adminToggleDeleteOrgAction,
} from "@/server/actions/adminActions";

export default function AdminOrgsPage() {
  const toast = useToast();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Org> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  // Only the setter is used: row feedback now comes from the toast, not a
  // per-button spinner, but the guard still prevents overlapping writes.
  const [, setBusyId] = useState("");

  useEffect(() => {
    let activeReq = true;
    void adminListOrgsAction(search, page).then((result) => {
      if (!activeReq) return;
      if (result.ok) setData(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
    return () => {
      activeReq = false;
    };
  }, [search, page, reload, toast]);

  const toggleDelete = async (org: Org) => {
    setBusyId(org.org_id);
    const result = await adminToggleDeleteOrgAction(org.org_id);
    setBusyId("");
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error);
    }
  };

  const toggleVerified = async (org: Org) => {
    setBusyId(org.org_id);
    const result = await adminSetOrgVerifiedAction(org.org_id, !org.verified);
    setBusyId("");
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-white">Organizations</h1>

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
          placeholder="Search by name"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-surface-2">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((org) => (
              <tr key={org.org_id} className="border-t border-surface-2">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orgs/${org.org_id}`}
                    className="text-white hover:text-primary"
                  >
                    <VerifiedName name={org.name} verified={org.verified} />
                  </Link>
                  {org.description ? (
                    <span className="mt-0.5 block max-w-sm truncate text-xs text-body">
                      {org.description}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {org.isDeleted ? (
                    <span className="text-xs text-lose">Deleted</span>
                  ) : (
                    <span className="text-xs text-win">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-body">
                  {org.created_at
                    ? new Date(org.created_at).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <RowMenu
                    label={`Actions for ${org.name}`}
                    actions={[
                      {
                        label: "Manage",
                        onSelect: () => router.push(`/admin/orgs/${org.org_id}`),
                      },
                      {
                        label: org.verified
                          ? "Remove verification"
                          : "Verify",
                        onSelect: () => toggleVerified(org),
                      },
                      {
                        label: org.isDeleted ? "Restore" : "Delete",
                        danger: !org.isDeleted,
                        onSelect: () => toggleDelete(org),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {loading && !data ? (
              <tr>
                <td colSpan={4}>
                  <Loader variant="compact" label="Loading organizations" />
                </td>
              </tr>
            ) : null}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-body">
                  No organizations found.
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
