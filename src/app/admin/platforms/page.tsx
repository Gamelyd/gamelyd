"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { Loader } from "@/components/ui/Loader";
import type { Platform } from "@/lib/schemas/platform";
import {
  adminListPlatformsAction,
  createPlatformAction,
  deletePlatformAction,
  togglePlatformActiveAction,
  updatePlatformAction,
} from "@/server/actions/platformActions";

interface FormState {
  name: string;
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  active: true,
};

export default function AdminPlatformsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Platform | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Platform | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let activeReq = true;
    void adminListPlatformsAction().then((result) => {
      if (!activeReq) return;
      if (result.ok) setItems(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
    return () => {
      activeReq = false;
    };
  }, [reload, toast]);

  const refresh = () => setReload((r) => r + 1);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (platform: Platform) => {
    setEditing(platform);
    setForm({ name: platform.name, active: platform.active });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = editing
      ? await updatePlatformAction(editing.platform_id, form)
      : await createPlatformAction(form);
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setModalOpen(false);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const toggleActive = async (platform: Platform) => {
    const result = await togglePlatformActiveAction(platform.platform_id);
    if (result.ok) {
      toast.success(result.message ?? "Updated");
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deletePlatformAction(deleteTarget.platform_id);
    setDeleting(false);
    if (result.ok) {
      toast.success(result.message ?? "Deleted");
      setDeleteTarget(null);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-white">Platforms</h1>
        <Button onClick={openCreate}>Add platform</Button>
      </div>

      {loading && items.length === 0 ? (
        <Loader label="Loading platforms" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">
            No platforms yet. Add PC, PlayStation, Xbox, Mobile, and others so
            hosts can pick them when creating a tournament.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-surface-2">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface-2 text-body">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((platform) => (
                <tr
                  key={platform.platform_id}
                  className="border-t border-surface-2"
                >
                  <td className="px-4 py-3 text-white">{platform.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        platform.active
                          ? "bg-win-deep text-white"
                          : "bg-surface-3 text-body"
                      }`}
                    >
                      {platform.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openEdit(platform)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="dark"
                        onClick={() => toggleActive(platform)}
                      >
                        {platform.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setDeleteTarget(platform)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit platform" : "Add platform"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="PlayStation, Xbox, Mobile…"
            required
          />
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            Active (selectable when creating tournaments)
          </label>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create platform"}
            </Button>
          </div>
        </form>
      </Modal>
      <Confirm
        open={deleteTarget !== null}
        title="Delete this platform?"
        message={`Delete "${deleteTarget?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
