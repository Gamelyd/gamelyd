"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  acceptInviteAction,
  declineInviteAction,
  listMyInvitesAction,
} from "@/server/actions/inviteActions";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
} from "@/server/actions/notificationActions";
import { acceptSettingChangeAction } from "@/server/actions/tournamentActions";
import { enterSavedTeamAction } from "@/server/actions/savedTeamActions";
import type { InviteTournament, Notification } from "@/lib/schemas/misc";
import type { NotificationKind } from "@/lib/schemas/common";

/** Kinds that get a coloured eyebrow above the message. */
const KIND_LABEL: Partial<Record<NotificationKind, string>> = {
  SCORE: "Score",
  TIME: "Time",
  DRAW: "Draw",
  ANNOUNCEMENT: "Announcement",
  SETTING_CHANGE: "Setting change",
  TOURNAMENT_INVITE: "Invite",
  TEAM_INVITE: "Invite",
  SAVED_TEAM_INVITE: "Team invite",
  TOURNAMENT_ALERT: "From your team",
};

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [invites, setInvites] = useState<InviteTournament[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.push("/signup?redirect=/notifications");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void listMyInvitesAction().then((result) => {
      if (result.ok) setInvites(result.data);
    });
    void getNotificationsAction(1).then((result) => {
      if (result.ok) setNotes(result.data.items);
    });
    void markAllNotificationsReadAction();
  }, [isAuthenticated]);

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
      router.push(
        result.data.kind === "TEAM"
          ? `/tournament/${result.data.tournamentId}?tab=teams`
          : `/tournament/${result.data.tournamentId}?tab=register`,
      );
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
  };

  const enterTeam = async (note: Notification) => {
    if (!note.tournament_id || !note.team_id) return;
    setBusyId(note._id);
    const result = await enterSavedTeamAction(
      note.team_id,
      note.tournament_id,
    );
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Registered");
    if (result.data.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
      return;
    }
    router.push(`/tournament/${note.tournament_id}?tab=teams`);
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
    router.push(`/tournament/${note.tournament_id}`);
  };

  return (
    <SiteLayout>
      <PageHeader
        kicker="Inbox"
        title="Notifications"
        description="Invites, announcements, fixture draws, match times, scores, and setting changes. You are not on a team until you accept a team invite."
        width="max-w-3xl"
      />
      <section className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        {invites.length > 0 ? (
          <div>
            <h2 className="mb-4 font-display text-2xl text-white">
              Pending invites
            </h2>
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <div
                  key={invite.invite_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary-panel p-4"
                >
                  <div>
                    <p className="text-sm text-white">
                      {invite.kind === "TEAM" ? (
                        <>
                          Join team{" "}
                          <span className="font-semibold text-primary">
                            {invite.team_name}
                          </span>{" "}
                          in {invite.tournament_name}
                        </>
                      ) : (
                        <>
                          Join{" "}
                          <span className="font-semibold text-primary">
                            {invite.tournament_name}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-body">
                      From @{invite.inviter_name || "host"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      loading={busyId === invite.invite_id}
                      onClick={() => void respond(invite, true)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="dark"
                      loading={busyId === invite.invite_id}
                      onClick={() => void respond(invite, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <h2 className="mb-4 font-display text-2xl text-white">
            {invites.length > 0 ? "Earlier" : "Notifications"}
          </h2>
          {notes.length === 0 ? (
            <p className="text-sm text-body">No notifications yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((note) => (
                <li
                  key={note._id}
                  className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm text-white"
                >
                  {KIND_LABEL[note.kind] ? (
                    <p className="mb-1 text-[11px] uppercase tracking-wider text-primary">
                      {KIND_LABEL[note.kind]}
                    </p>
                  ) : null}
                  <p>{note.message}</p>
                  {note.kind === "SETTING_CHANGE" &&
                  note.tournament_id &&
                  note.message.includes("Accept it") ? (
                    <Button
                      className="mt-2"
                      loading={busyId === note._id}
                      onClick={() => void acceptChange(note)}
                    >
                      Accept
                    </Button>
                  ) : null}
                  {/* A teammate asked their captain to enter an event: the
                      captain can put the whole roster in from right here. */}
                  {note.kind === "TOURNAMENT_ALERT" &&
                  note.tournament_id &&
                  note.team_id ? (
                    <Button
                      className="mt-2"
                      loading={busyId === note._id}
                      onClick={() => void enterTeam(note)}
                    >
                      Register my team
                    </Button>
                  ) : null}
                  {note.tournament_id ? (
                    <Link
                      href={`/tournament/${note.tournament_id}`}
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Open tournament
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
