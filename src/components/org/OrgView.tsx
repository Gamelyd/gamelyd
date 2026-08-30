"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Org, OrgMemberWithUser } from "@/lib/schemas/org";
import type { Tournament } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Confirm } from "@/components/ui/Confirm";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  inviteMemberAction,
  removeMemberAction,
  updateOrgAction,
} from "@/server/actions/orgActions";
import { IconPicker } from "@/components/ui/IconPicker";
import { useIcons } from "@/hooks/useIcons";
import type { OrgRole } from "@/lib/schemas/common";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { ShareButton } from "@/components/ui/ShareButton";

export function OrgView({
  org,
  initialMembers,
  tournaments,
}: {
  org: Org;
  initialMembers: OrgMemberWithUser[];
  tournaments: Tournament[];
}) {
  const { user, refreshOrgs } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [current, setCurrent] = useState<Org>(org);
  const [members, setMembers] = useState<OrgMemberWithUser[]>(initialMembers);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMemberWithUser | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const myRole = members.find((m) => m.user_id === user?.user_id)?.role;
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  const handleRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    const result = await removeMemberAction(
      current.org_id,
      removeTarget.user_id,
    );
    setBusy(false);
    if (result.ok) {
      setMembers((prev) =>
        prev.filter((m) => m.user_id !== removeTarget.user_id),
      );
      toast.success("Member removed");
    } else {
      toast.error(result.error);
    }
    setRemoveTarget(null);
  };

  return (
    <div>
      <section className="border-b border-primary/20 bg-primary-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-page py-10 lg:py-12 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-primary/25 bg-black/30">
            {current.image ? (
              <Image
                src={current.image}
                alt={current.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl font-bold text-white">
                {current.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1">
            <VerifiedName
              as="h1"
              name={current.name}
              verified={current.verified}
              className="font-display text-4xl text-white md:text-5xl"
            />
            {current.description && (
              <p className="mt-2 max-w-2xl text-body">
                {current.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton
              name={current.name}
              description={
                current.description || `${current.name} on Gamelyd`
              }
              urlPath={`/org/${current.org_id}`}
            />
            {canManage && (
              <>
                <Button variant="dark" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button variant="outline" onClick={() => setInviteOpen(true)}>
                  Invite member
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-page py-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-white">
              Tournaments hosted
            </h2>
            {members.some((m) => m.user_id === user?.user_id) && (
              <Button onClick={() => router.push("/tournament/new")}>
                Host tournament
              </Button>
            )}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {tournaments.length === 0 ? (
              <EmptyTournaments message="This organization hasn't hosted any tournaments yet." />
            ) : (
              tournaments.map((t) => (
                <TournamentCard key={`${t._id}:${t.TournamentId}`} tournament={t} />
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-display text-2xl text-white">
            Members ({members.length})
          </h2>
          <div className="flex flex-col gap-3">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary-panel p-3"
              >
                <div className="min-w-0">
                  <VerifiedName
                    as="p"
                    name={`${m.first_name} ${m.last_name}`.trim()}
                    verified={m.verified}
                    className="text-sm font-medium text-white"
                  />
                  <p className="truncate text-xs text-body">@{m.user_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-xs text-primary">
                    {m.role}
                  </span>
                  {canManage && m.user_id !== user?.user_id && (
                    <button
                      onClick={() => setRemoveTarget(m)}
                      className="text-xs text-lose hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {canManage && (
        <>
          <EditOrgModal
            open={editOpen}
            org={current}
            onClose={() => setEditOpen(false)}
            onSaved={(updated) => {
              setCurrent(updated);
              setEditOpen(false);
              void refreshOrgs();
              toast.success("Organization updated");
            }}
          />
          <InviteModal
            open={inviteOpen}
            orgId={current.org_id}
            onClose={() => setInviteOpen(false)}
          />
        </>
      )}

      <Confirm
        open={removeTarget !== null}
        message={`Remove ${removeTarget?.user_name ?? "this member"} from the organization?`}
        confirmLabel="Remove"
        loading={busy}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

function EditOrgModal({
  open,
  org,
  onClose,
  onSaved,
}: {
  open: boolean;
  org: Org;
  onClose: () => void;
  onSaved: (org: Org) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: org.name,
    description: org.description,
    image: org.image,
    website: org.website,
  });
  const [loading, setLoading] = useState(false);
  const { icons: orgIcons, loading: orgIconsLoading } = useIcons("team");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await updateOrgAction(org.org_id, form);
    setLoading(false);
    if (result.ok) onSaved(result.data);
    else toast.error(result.error);
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit organization">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <IconPicker
          label="Logo"
          icons={orgIcons}
          value={form.image}
          onChange={(url) => setForm({ ...form, image: url })}
          loading={orgIconsLoading}
        />
        <Input
          label="Website"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
        <TextArea
          label="Description"
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Button type="submit" loading={loading} fullWidth>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

const roleOptions: { label: string; value: OrgRole }[] = [
  { label: "Member", value: "MEMBER" },
  { label: "Admin", value: "ADMIN" },
  { label: "Owner", value: "OWNER" },
];

function InviteModal({
  open,
  orgId,
  onClose,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("MEMBER");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await inviteMemberAction(orgId, { usernameOrEmail, role });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Invite sent");
      setUsernameOrEmail("");
      onClose();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite a member">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Username or email"
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          required
        />
        <Select
          label="Role"
          options={roleOptions}
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
        />
        <Button type="submit" loading={loading} fullWidth>
          Send invite
        </Button>
      </form>
    </Modal>
  );
}
