"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { RatingStars } from "./RatingStars";
import type { RatingTarget } from "@/lib/schemas/rating";
import {
  rateAction,
  ratingBoardAction,
  type RatingBoard,
} from "@/server/actions/ratingActions";

/**
 * Shows a target's rating and, for signed-in users, lets them leave or update
 * one. Works for a tournament, an org, or a user.
 */
export function RatingPanel({
  targetType,
  targetId,
  title = "Ratings",
  noun = "this",
  canRate = true,
}: {
  targetType: RatingTarget;
  targetId: string;
  title?: string;
  noun?: string;
  canRate?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [board, setBoard] = useState<RatingBoard | null>(null);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void ratingBoardAction(targetType, targetId).then((result) => {
      if (!active || !result.ok) return;
      setBoard(result.data);
      if (result.data.mine) {
        setStars(result.data.mine.Stars);
        setComment(result.data.mine.Comment);
      }
    });
    return () => {
      active = false;
    };
  }, [targetType, targetId]);

  const submit = async () => {
    if (stars < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    setSaving(true);
    const result = await rateAction(targetType, targetId, {
      Stars: stars,
      Comment: comment,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Thanks for rating");
    const refreshed = await ratingBoardAction(targetType, targetId);
    if (refreshed.ok) setBoard(refreshed.data);
    setOpen(false);
  };

  // Admin switched this rating surface off: show nothing at all.
  if (board && !board.enabled) return null;

  const summary = board?.summary;
  const mine = board?.mine ?? null;
  const showRate = isAuthenticated && canRate;

  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-white">{title}</h3>
          {summary && summary.count > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <RatingStars value={summary.average} />
              <span className="text-sm font-semibold text-white">
                {summary.average.toFixed(1)}
              </span>
              <span className="text-xs text-body">
                ({summary.count} rating{summary.count === 1 ? "" : "s"})
              </span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-body">No ratings yet.</p>
          )}
        </div>
        {showRate ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen((v) => !v)}
          >
            {mine ? "Update your rating" : `Rate ${noun}`}
          </Button>
        ) : null}
      </div>

      {showRate && open ? (
        <div className="mt-4 border-t border-surface-2 pt-4">
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setStars(n)}
                className="text-2xl leading-none"
              >
                <span
                  className={
                    (hover || stars) >= n ? "text-yellow" : "text-white/25"
                  }
                >
                  ★
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <TextArea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional: leave a short review"
            />
          </div>
          <div className="mt-3">
            <Button type="button" loading={saving} onClick={() => void submit()}>
              {mine ? "Update rating" : "Submit rating"}
            </Button>
          </div>
        </div>
      ) : null}

      {board && board.reviews.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3 border-t border-surface-2 pt-4">
          {board.reviews.map((r) => (
            <li key={r.RatingId}>
              <div className="flex items-center gap-2">
                <RatingStars value={r.Stars} size="sm" />
                <span className="text-xs text-body">
                  {r.UserName ? `@${r.UserName}` : "User"}
                </span>
              </div>
              {r.Comment ? (
                <p className="mt-1 text-sm text-body">{r.Comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
