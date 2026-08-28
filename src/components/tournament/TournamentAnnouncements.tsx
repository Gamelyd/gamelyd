"use client";

import { useState } from "react";
import type { TournamentAnnouncement } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import {
  addTournamentAnnouncementAction,
  removeTournamentAnnouncementAction,
} from "@/server/actions/tournamentActions";

export function LatestAnnouncementBanner({
  announcement,
  onOpen,
}: {
  announcement: TournamentAnnouncement;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border-b border-primary/25 bg-primary/10 text-left transition-colors hover:bg-primary/15"
    >
      <span className="mx-auto flex max-w-6xl items-start gap-3 px-page py-3">
        <span className="mt-0.5 shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          New
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">
            Host announcement
          </span>
          <span className="mt-0.5 line-clamp-2 text-sm text-white">
            {announcement.Body}
          </span>
        </span>
        <PostedAt
          value={announcement.CreatedAt}
          className="shrink-0 text-xs text-body"
        />
      </span>
    </button>
  );
}

export function TournamentAnnouncements({
  tournamentId,
  announcements,
  canPost,
  closed = false,
  onChange,
}: {
  tournamentId: string;
  announcements: TournamentAnnouncement[];
  canPost: boolean;
  closed?: boolean;
  onChange: (next: TournamentAnnouncement[]) => void;
}) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [confirmId, setConfirmId] = useState("");

  const post = async () => {
    const next = body.trim();
    if (!next) return;
    setPosting(true);
    const result = await addTournamentAnnouncementAction(tournamentId, {
      Body: next,
    });
    setPosting(false);
    if (result.ok) {
      setBody("");
      onChange(result.data);
      toast.success("Announcement posted");
    } else {
      toast.error(result.error);
    }
  };

  const remove = async () => {
    if (!confirmId) return;
    setRemovingId(confirmId);
    const result = await removeTournamentAnnouncementAction(
      tournamentId,
      confirmId,
    );
    setRemovingId("");
    setConfirmId("");
    if (result.ok) {
      onChange(result.data);
      toast.success("Announcement removed");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-5">
      {closed ? (
        <p className="rounded-xl border border-surface-2 bg-surface px-4 py-3 text-sm text-body">
          This tournament is over. Announcements are closed.
        </p>
      ) : canPost ? (
        <div className="rounded-xl border border-surface-2 bg-surface p-5">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white">
            Post an announcement
          </h3>
          <p className="mb-3 text-sm text-body">
            Everyone in this event gets a notification. Use it for lobby codes,
            setting changes, and match reminders.
          </p>
          <TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write an update for everyone in this event"
            rows={4}
            maxLength={2000}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-body">{body.trim().length}/2000</span>
            <Button
              type="button"
              loading={posting}
              disabled={!body.trim()}
              onClick={() => void post()}
            >
              Post announcement
            </Button>
          </div>
        </div>
      ) : null}

      {announcements.length === 0 ? (
        <p className="py-10 text-center text-sm text-body">
          {canPost && !closed
            ? "Nothing posted yet. Players will see your updates here."
            : "No announcements yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((item, index) => (
            <li
              key={item.Id}
              className={`rounded-xl border bg-surface p-5 ${
                index === 0
                  ? "border-primary/40"
                  : "border-surface-2"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {index === 0 ? "Latest" : "Earlier"}
                  <PostedAt
                    value={item.CreatedAt}
                    className="ml-2 font-normal normal-case tracking-normal text-body"
                  />
                </p>
                {canPost ? (
                  <button
                    type="button"
                    className="text-xs text-lose hover:underline"
                    onClick={() => setConfirmId(item.Id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white">
                {item.Body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Confirm
        open={Boolean(confirmId)}
        title="Remove this announcement?"
        message="Players will no longer see this post on the tournament page."
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={Boolean(removingId)}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!removingId) setConfirmId("");
        }}
      />
    </div>
  );
}

function PostedAt({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <time dateTime={value} suppressHydrationWarning className={className}>
      {formatPostedAt(value)}
    </time>
  );
}

function formatPostedAt(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
