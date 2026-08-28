"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import {
  acceptInviteAction,
  countMyInvitesAction,
  declineInviteAction,
  listMyInvitesAction,
} from "@/server/actions/inviteActions";
import {
  countUnreadMatchNotificationsAction,
  getMatchNotificationsAction,
  markNotificationReadAction,
} from "@/server/actions/notificationActions";
import { acceptSettingChangeAction } from "@/server/actions/tournamentActions";
import type { InviteTournament, Notification } from "@/lib/schemas/misc";

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [invites, setInvites] = useState<InviteTournament[]>([]);
  const [matches, setMatches] = useState<Notification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [countResult, listResult, matchCountResult, matchListResult] =
      await Promise.all([
        countMyInvitesAction(),
        listMyInvitesAction(),
        countUnreadMatchNotificationsAction(),
        getMatchNotificationsAction(),
      ]);
    if (countResult.ok) setInviteCount(countResult.data);
    if (listResult.ok) setInvites(listResult.data);
    if (matchCountResult.ok) setMatchCount(matchCountResult.data);
    if (matchListResult.ok) setMatches(matchListResult.data);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setInviteCount(0);
      setMatchCount(0);
      setInvites([]);
      setMatches([]);
      return;
    }
    void load();
  }, [isAuthenticated, pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  const count = inviteCount + matchCount;

  const openMatch = async (note: Notification) => {
    if (!note.is_read) {
      await markNotificationReadAction(note._id);
      setMatches((prev) =>
        prev.map((item) =>
          item._id === note._id ? { ...item, is_read: true } : item,
        ),
      );
      setMatchCount((n) => Math.max(0, n - 1));
    }
    setOpen(false);
    if (note.tournament_id) {
      router.push(`/tournament/${note.tournament_id}`);
    } else {
      router.push("/notifications");
    }
  };

  const respond = async (invite: InviteTournament, accept: boolean) => {
    setBusyId(invite.invite_id);
    if (accept) {
      const result = await acceptInviteAction(invite.invite_id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done");
      setInvites((prev) => prev.filter((i) => i.invite_id !== invite.invite_id));
      setInviteCount((n) => Math.max(0, n - 1));
      setOpen(false);
      router.push(
        result.data.kind === "TEAM"
          ? `/tournament/${result.data.tournamentId}?tab=teams`
          : `/tournament/${result.data.tournamentId}?tab=register`,
      );
      router.refresh();
      return;
    }
    const result = await declineInviteAction(invite.invite_id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Done");
    setInvites((prev) => prev.filter((i) => i.invite_id !== invite.invite_id));
    setInviteCount((n) => Math.max(0, n - 1));
  };

  const acceptChange = async (note: Notification) => {
    if (!note.tournament_id) return;
    setBusyId(note._id);
    const result = await acceptSettingChangeAction(note.tournament_id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Change accepted");
    if (!note.is_read) {
      await markNotificationReadAction(note._id);
      setMatchCount((n) => Math.max(0, n - 1));
    }
    setMatches((prev) => prev.filter((item) => item._id !== note._id));
    setOpen(false);
    router.push(`/tournament/${note.tournament_id}`);
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-white transition-colors hover:bg-white/5 hover:text-primary md:h-8 md:w-8"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon className="h-6 w-6 md:h-5 md:w-5" />
        {count > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold leading-none text-white md:top-0 md:right-0">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-2.5rem)] rounded-xl border border-primary/25 bg-nav p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Notifications
            </p>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-body hover:text-primary"
            >
              View all
            </Link>
          </div>
          {invites.length === 0 && matches.length === 0 ? (
            <p className="px-1 py-4 text-sm text-body">No new notifications.</p>
          ) : (
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {invites.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {invites.map((invite) => (
                    <li
                      key={invite.invite_id}
                      className="rounded-lg border border-primary/30 bg-primary/10 p-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        Invite
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {invite.kind === "TEAM" ? (
                          <>
                            Join{" "}
                            <span className="text-primary">
                              {invite.team_name}
                            </span>{" "}
                            in {invite.tournament_name}
                          </>
                        ) : (
                          <>
                            Join{" "}
                            <span className="text-primary">
                              {invite.tournament_name}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-body">
                        From @{invite.inviter_name || "host"}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          loading={busyId === invite.invite_id}
                          onClick={() => void respond(invite, true)}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          variant="dark"
                          loading={busyId === invite.invite_id}
                          onClick={() => void respond(invite, false)}
                        >
                          Decline
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {matches.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {matches.map((note) => (
                    <li key={note._id}>
                      <button
                        type="button"
                        onClick={() => void openMatch(note)}
                        className={`w-full rounded-lg border p-3 text-left text-sm text-white transition-colors hover:border-primary/40 ${
                          note.is_read
                            ? "border-white/10 bg-black/20"
                            : "border-primary/30 bg-primary/10"
                        }`}
                      >
                        <p>
                          {note.kind === "SCORE"
                            ? "Score posted"
                            : note.kind === "TIME"
                              ? "Time set"
                              : note.kind === "ANNOUNCEMENT"
                                ? "Announcement"
                                : note.kind === "SETTING_CHANGE"
                                  ? "Setting change"
                                  : "Draw made"}
                        </p>
                        <p className="mt-0.5 text-xs text-body">
                          {note.message}
                        </p>
                      </button>
                      {note.kind === "SETTING_CHANGE" &&
                      note.tournament_id &&
                      note.message.includes("Accept it") ? (
                        <div className="mt-2">
                          <Button
                            type="button"
                            loading={busyId === note._id}
                            onClick={() => void acceptChange(note)}
                          >
                            Accept
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 17a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
