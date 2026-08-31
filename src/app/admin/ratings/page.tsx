"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/Button";
import type { Paginated } from "@/lib/result";
import type { Rating } from "@/lib/schemas/rating";
import { adminListRatingsAction } from "@/server/actions/ratingActions";

function targetHref(type: string, id: string): string {
  if (type === "ORG") return `/org/${id}`;
  if (type === "USER") return `/profile/${id}`;
  return `/tournament/${id}`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export default function AdminRatingsPage() {
  const [data, setData] = useState<Paginated<Rating> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void adminListRatingsAction(page).then((result) => {
      if (!active) return;
      if (result.ok) setData(result.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [page]);

  const items = data?.items ?? [];

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-white">Ratings</h1>
      <p className="mb-6 text-sm text-body">
        Feedback players left after their tournaments finished.
      </p>

      {loading && !data ? (
        <Loader label="Loading ratings" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface py-16 text-center text-body">
          No ratings yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-2">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-b border-surface-2 text-xs uppercase tracking-wide text-body">
                <th className="px-4 py-3 font-medium">Stars</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Rated</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 font-medium">Comment</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.RatingId}
                  className="border-b border-surface-2 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-yellow">{"★".repeat(r.Stars)}</span>
                    <span className="text-white/20">
                      {"★".repeat(Math.max(0, 5 - r.Stars))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-body">
                    {r.TargetType}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={targetHref(r.TargetType, r.TargetId)}
                      className="text-primary hover:underline"
                    >
                      {r.TargetName || r.TargetId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white">
                    {r.UserName ? `@${r.UserName}` : "-"}
                  </td>
                  <td className="max-w-md px-4 py-3 text-body">
                    {r.Comment || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-body">
                    {formatDate(r.Created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.last_page > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="dark"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-body">
            Page {data.page} of {data.last_page}
          </span>
          <Button
            variant="dark"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
