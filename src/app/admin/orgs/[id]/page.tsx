"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Org, OrgMemberWithUser } from "@/lib/schemas/org";
import {
  adminGetOrgAction,
  adminListOrgMembersAction,
  adminRemoveOrgMemberAction,
  adminToggleDeleteOrgAction,
  adminUpdateOrgAction,
} from "@/server/actions/adminActions";
import { IconPicker } from "@/components/ui/IconPicker";
import { ORG_ICONS } from "@/lib/icons";

export default function AdminOrgDetailPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id;
  const toast = useToast();
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<OrgMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busyUid, setBusyUid] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    image: "",
    website: "",
  });

  useEffect(() => {
    let activeReq = true;
    void Promise.all([
      adminGetOrgAction(orgId),
      adminListOrgMembersAction(orgId),
    ]).then(([orgResult, membersResult]) => {
      if (!activeReq) return;
      if (orgResult.ok && orgResult.data) {
        setOrg(orgResult.data);
        setForm({
          name: orgResult.data.name,
          description: orgResult.data.description,
          image: orgResult.data.image,
          website: orgResult.data.website,
        });
      } else if (orgResult.ok) {
        setOrg(null);
      } else {
        toast.error(orgResult.error);
      }
      if (membersResult.ok) setMembers(membersResult.data);
      setLoading(false);
    });
    return () => {
      activeReq = false;
    };
  }, [orgId, reload, toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await adminUpdateOrgAction(orgId, form);
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error);
    }
  };

  const toggleDelete = async () => {
    const result = await adminToggleDeleteOrgAction(orgId);
    if (result.ok) {
      toast.success(result.message ?? "Done");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error);
    }
  };

  const removeMember = async (member: OrgMemberWithUser) => {
    setBusyUid(member.user_id);
    const result = await adminRemoveOrgMemberAction(orgId, member.user_id);
    setBusyUid("");
    if (result.ok) {
      toast.success(result.message ?? "Removed");
      setReload((r) => r + 1);
    } else {
      toast.error(result.error);
    }
  };

  if (loading && !org) {
    return <p className="text-body">Loading…</p>;
  }

  if (!org) {
    return <p className="text-body">Organization not found.</p>;
  }

  return (
    <div>
      <Link
        href="/admin/orgs"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        ← All organizations
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {org.image ? (
            <Image
              src={org.image}
              alt={org.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 text-body">
              {org.name.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl text-white">{org.name}</h1>
            {org.isDeleted ? (
              <span className="text-xs text-lose">Deleted</span>
            ) : (
              <span className="text-xs text-win">Active</span>
            )}
          </div>
        </div>
        <Button
          variant={org.isDeleted ? "dark" : "danger"}
          onClick={toggleDelete}
        >
          {org.isDeleted ? "Restore organization" : "Delete organization"}
        </Button>
      </div>

      <form
        onSubmit={save}
        className="mb-10 flex max-w-xl flex-col gap-4 rounded-2xl border border-surface-2 bg-surface p-6"
      >
        <h2 className="text-lg font-semibold text-white">Details</h2>
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <TextArea
          label="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <IconPicker
          label="Logo"
          icons={ORG_ICONS}
          value={form.image}
          onChange={(url) => setForm({ ...form, image: url })}
        />
        <Input
          label="Website"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
        <div>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>

      <h2 className="mb-4 text-lg font-semibold text-white">
        Members ({members.length})
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-surface-2">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-t border-surface-2">
                <td className="px-4 py-3 text-white">
                  {m.first_name} {m.last_name}
                  <span className="block text-xs text-body">
                    @{m.user_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-body">{m.email}</td>
                <td className="px-4 py-3 text-body">{m.role}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="danger"
                    loading={busyUid === m.user_id}
                    onClick={() => removeMember(m)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-body">
                  No members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
