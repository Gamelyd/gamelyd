"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Confirm } from "@/components/ui/Confirm";
import { Loader } from "@/components/ui/Loader";
import { IconPicker } from "@/components/ui/IconPicker";
import { RowMenu } from "@/components/ui/RowMenu";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { useToast } from "@/components/ui/Toast";
import { useIcons } from "@/hooks/useIcons";
import { useAuth } from "@/context/AuthContext";
import { FALLBACKS, resolveIcon, resolvePlayerIcon } from "@/lib/icons";
import type { SavedTeam, SavedTeamInvite } from "@/lib/schemas/savedTeam";
import { LIMITS } from "@/lib/limits";
import {
  createSavedTeamAction,
  deleteSavedTeamAction,
  inviteToSavedTeamAction,
  leaveSavedTeamAction,
  mySavedTeamInvitesAction,
  mySavedTeamsAction,
  removeSavedTeamMemberAction,
  respondToSavedTeamInviteAction,
  transferSavedTeamCaptainAction,
  updateSavedTeamAction,
} from "@/server/actions/savedTeamActions";

/**
 * Rosters a player keeps on their profile and reuses across tournaments. The
 * captain owns the team; entering a tournament with it brings everyone in at
 * once instead of inviting each teammate per event.
 */
export function SavedTeams() {
  const { user } = useAuth();
  const toast = useToast();
  const { icons: teamIcons, loading: iconsLoading } = useIcons("team");
  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [invites, setInvites] = useState<SavedTeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavedTeam | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(FALLBACKS.team);
  const [iconOpen, setIconOpen] = useState(false);

  const [inviteTeam, setInviteTeam] = useState<SavedTeam | null>(null);
  const [inviteHandle, setInviteHandle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedTeam | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<SavedTeam | null>(null);

  const load = useCallback(async () => {
    const [teamResult, inviteResult] = await Promise.all([
      mySavedTeamsAction(),
      mySavedTeamInvitesAction(),
    ]);
    if (teamResult.ok) setTeams(teamResult.data);
    else toast.error(teamResult.error);
    if (inviteResult.ok) setInvites(inviteResult.data);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setIcon(teamIcons[0]?.url ?? FALLBACKS.team);
    setFormOpen(true);
  };

  const openEdit = (team: SavedTeam) => {
    setEditing(team);
    setName(team.name);
    setIcon(team.icon || FALLBACKS.team);
    setFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = editing
      ? await updateSavedTeamAction(editing.team_id, { name, icon })
      : await createSavedTeamAction({ name, icon, game_user_name: "" });
    setBusy(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setFormOpen(false);
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTeam) return;
    setBusy(true);
    const result = await inviteToSavedTeamAction(inviteTeam.team_id, {
      usernameOrEmail: inviteHandle,
    });
    setBusy(false);
    if (result.ok) {
      toast.success(result.message ?? "Invite sent");
      setInviteHandle("");
      setInviteTeam(null);
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const answerInvite = async (invite: SavedTeamInvite, accept: boolean) => {
    setBusy(true);
    const result = await respondToSavedTeamInviteAction(
      invite.invite_id,
      accept,
    );
    setBusy(false);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const removeMember = async (team: SavedTeam, memberId: string) => {
    const result = await removeSavedTeamMemberAction(team.team_id, memberId);
    if (result.ok) {
      toast.success(result.message ?? "Removed");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const makeCaptain = async (team: SavedTeam, memberId: string) => {
    const result = await transferSavedTeamCaptainAction(team.team_id, memberId);
    if (result.ok) {
      toast.success(result.message ?? "Captain updated");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const removeTeam = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteSavedTeamAction(deleteTarget.team_id);
    setBusy(false);
    setDeleteTarget(null);
    if (result.ok) {
      toast.success(result.message ?? "Deleted");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const leaveTeam = async () => {
    if (!leaveTarget) return;
    setBusy(true);
    const result = await leaveSavedTeamAction(leaveTarget.team_id);
    setBusy(false);
    setLeaveTarget(null);
    if (result.ok) {
      toast.success(result.message ?? "You left the team");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  if (loading) return <Loader label="Loading your teams" />;

  return (
    <div className="space-y-5">
      {invites.length > 0 ? (
        <div className="rounded-xl border border-primary/35 bg-primary/10 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            Team invites
          </h3>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.invite_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3"
              >
                <span className="text-sm text-white">
                  <span className="font-semibold">{invite.inviter_name}</span>{" "}
                  invited you to{" "}
                  <span className="font-semibold">{invite.team_name}</span>
                </span>
                <span className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => void answerInvite(invite, true)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="dark"
                    disabled={busy}
                    onClick={() => void answerInvite(invite, false)}
                  >
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">Your teams</h2>
          <p className="text-sm text-body">
            Build a roster once, then enter it into any tournament.
          </p>
        </div>
        <Button onClick={openCreate}>Create team</Button>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">
            No teams yet. Create one, invite your players, and you can enter
            tournaments together in one click.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {teams.map((team) => (
            <li
              key={team.team_id}
              className="rounded-xl border border-surface-2 bg-surface p-5"
            >
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveIcon(team.icon, FALLBACKS.team)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg bg-black/25 object-contain p-1 ring-1 ring-primary/25"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-xl text-white">
                    {team.name}
                  </h3>
                  <p className="text-xs text-body">
                    {team.members.length} player
                    {team.members.length === 1 ? "" : "s"}
                    {team.isCaptain ? " · you are captain" : ""}
                  </p>
                </div>
                <RowMenu
                  label={`Actions for ${team.name}`}
                  actions={
                    team.isCaptain
                      ? [
                          {
                            label: "Invite player",
                            onSelect: () => setInviteTeam(team),
                          },
                          {
                            label: "Edit team",
                            onSelect: () => openEdit(team),
                          },
                          {
                            label: "Delete team",
                            danger: true,
                            onSelect: () => setDeleteTarget(team),
                          },
                        ]
                      : [
                          {
                            label: "Leave team",
                            danger: true,
                            onSelect: () => setLeaveTarget(team),
                          },
                        ]
                  }
                />
              </div>

              <ul className="mt-4 space-y-2">
                {team.members.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center gap-3 rounded-lg bg-surface-2/40 px-3 py-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvePlayerIcon(member.icon, member.user_id)}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full bg-primary object-cover ring-1 ring-black/40"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      <VerifiedName
                        name={member.user_name || member.first_name || "Player"}
                        verified={member.verified}
                      />
                      {member.game_user_name ? (
                        <span className="text-body">
                          {" "}
                          · {member.game_user_name}
                        </span>
                      ) : null}
                    </span>
                    {member.role === "CAPTAIN" ? (
                      <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Captain
                      </span>
                    ) : null}
                    {team.isCaptain && member.user_id !== user?.user_id ? (
                      <RowMenu
                        label={`Actions for ${member.user_name}`}
                        actions={[
                          {
                            label: "Make captain",
                            hint: "You become a regular member",
                            onSelect: () =>
                              void makeCaptain(team, member.user_id),
                          },
                          {
                            label: "Remove from team",
                            danger: true,
                            onSelect: () =>
                              void removeMember(team, member.user_id),
                          },
                        ]}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit team" : "Create team"}
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <Input
            label="Team name"
            maxLength={LIMITS.teamName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <p className="mb-2 text-sm text-label">Team icon</p>
            <button
              type="button"
              onClick={() => setIconOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-input px-3 py-2.5 text-left transition-colors hover:border-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveIcon(icon, FALLBACKS.team)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
              />
              <span className="text-sm text-white">Tap to change</span>
            </button>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? "Save changes" : "Create team"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        title="Team icon"
        width="max-w-2xl"
      >
        <IconPicker
          label="Pick an icon"
          icons={teamIcons}
          value={icon}
          onChange={(url) => {
            setIcon(url);
            setIconOpen(false);
          }}
          loading={iconsLoading}
        />
      </Modal>

      <Modal
        open={inviteTeam !== null}
        onClose={() => setInviteTeam(null)}
        title={`Invite to ${inviteTeam?.name ?? ""}`}
      >
        <form onSubmit={sendInvite} className="flex flex-col gap-4">
          <p className="text-sm text-body">
            They get a notification and join once they accept.
          </p>
          <Input
            label="Username or email"
            maxLength={LIMITS.email}
            value={inviteHandle}
            onChange={(e) => setInviteHandle(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setInviteTeam(null)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Send invite
            </Button>
          </div>
        </form>
      </Modal>

      <Confirm
        open={deleteTarget !== null}
        title="Delete this team?"
        message={`"${deleteTarget?.name ?? ""}" will be removed from your profile. Tournaments it already entered are not affected.`}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void removeTeam()}
        onCancel={() => {
          if (!busy) setDeleteTarget(null);
        }}
      />

      <Confirm
        open={leaveTarget !== null}
        title="Leave this team?"
        message={`You will be removed from "${leaveTarget?.name ?? ""}".`}
        confirmLabel="Leave"
        loading={busy}
        onConfirm={() => void leaveTeam()}
        onCancel={() => {
          if (!busy) setLeaveTarget(null);
        }}
      />
    </div>
  );
}
