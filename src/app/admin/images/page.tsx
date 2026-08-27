"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Confirm } from "@/components/ui/Confirm";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/ui/Toast";
import type { Game } from "@/lib/schemas/game";
import type { IconAsset, IconKind } from "@/lib/schemas/icon";
import { adminListGamesAction } from "@/server/actions/gameActions";
import {
  adminListIconsAction,
  archiveIconAction,
  createIconAction,
  deleteIconAction,
  seedIconsAction,
  updateIconAction,
} from "@/server/actions/iconActions";

const KINDS: { id: IconKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tournament", label: "Covers" },
  { id: "team", label: "Teams" },
  { id: "player", label: "Players" },
];

interface FormState {
  name: string;
  url: string;
  kind: IconKind;
  gameIds: string[];
}

const emptyForm: FormState = {
  name: "",
  url: "",
  kind: "tournament",
  gameIds: [],
};

export default function AdminImagesPage() {
  const toast = useToast();
  const [items, setItems] = useState<IconAsset[]>([]);
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [kind, setKind] = useState<IconKind | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IconAsset | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IconAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      adminListIconsAction({
        kind: kind === "all" ? undefined : kind,
        search: search.trim() || undefined,
        includeArchived: true,
      }),
      adminListGamesAction(),
    ]).then(([iconsResult, gamesResult]) => {
      if (!active) return;
      if (iconsResult.ok) setItems(iconsResult.data);
      else toast.error(iconsResult.error);
      if (gamesResult.ok) setGamesList(gamesResult.data);
      else toast.error(gamesResult.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind, search, reload, toast]);

  const refresh = () => setReload((r) => r + 1);

  const downloadImages = async () => {
    setSeeding(true);
    const result = await seedIconsAction();
    setSeeding(false);
    if (result.ok) {
      toast.success(result.message ?? "Catalog updated");
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      kind: kind === "all" ? "tournament" : kind,
    });
    setModalOpen(true);
  };

  const openEdit = (icon: IconAsset) => {
    setEditing(icon);
    setForm({
      name: icon.name,
      url: icon.url,
      kind: icon.kind,
      gameIds: icon.gameIds,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = editing
      ? await updateIconAction(editing.icon_id, form)
      : await createIconAction(form);
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setModalOpen(false);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const toggleArchive = async (icon: IconAsset) => {
    const result = await archiveIconAction(icon.icon_id, !icon.archived);
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
    const result = await deleteIconAction(deleteTarget.icon_id);
    setDeleting(false);
    if (result.ok) {
      toast.success(result.message ?? "Deleted");
      setDeleteTarget(null);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const gameName = (id: string) =>
    gamesList.find((game) => game.game_id === id)?.name ?? id;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-white">Images</h1>
          <p className="mt-1 text-sm text-body">
            Download current covers and crests into the database, then add,
            archive, or delete catalog entries. Local files stay on disk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={seeding} onClick={downloadImages}>
            Download images
          </Button>
          <Button onClick={openCreate}>Add image</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setKind(item.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium ${
              kind === item.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-surface-2 bg-surface text-body hover:border-primary/40"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-6 max-w-sm">
        <Input
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && items.length === 0 ? (
        <p className="text-body">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">
            No catalog images yet. Download images to seed covers, team crests,
            and player tokens from the app.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((icon) => (
            <div
              key={icon.icon_id}
              className="overflow-hidden rounded-2xl border border-surface-2 bg-surface"
            >
              <div className="relative h-36 w-full bg-surface-2">
                {icon.url ? (
                  <Image
                    src={icon.url}
                    alt={icon.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : null}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    icon.archived
                      ? "bg-surface-3 text-body"
                      : "bg-win-deep text-white"
                  }`}
                >
                  {icon.archived ? "Archived" : icon.kind}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-white">{icon.name}</h3>
                {icon.gameIds.length > 0 ? (
                  <p className="mt-1 text-xs text-body">
                    {icon.gameIds.map(gameName).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-body">No game tags</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => openEdit(icon)}>
                    Edit
                  </Button>
                  <Button variant="dark" onClick={() => void toggleArchive(icon)}>
                    {icon.archived ? "Restore" : "Archive"}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeleteTarget(icon)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit image" : "Add image"}
        width="max-w-xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Wolf"
          />
          <Input
            label="Image URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
            placeholder="/images/crests/team/crest-team-01-wolf.png"
          />
          <Select
            label="Kind"
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as IconKind })
            }
            options={[
              { label: "Tournament cover", value: "tournament" },
              { label: "Team crest", value: "team" },
              { label: "Player token", value: "player" },
            ]}
          />
          <MultiSelect
            label="Game tags"
            options={gamesList.map((game) => ({
              label: game.name,
              value: game.game_id,
            }))}
            value={form.gameIds}
            onChange={(gameIds) => setForm({ ...form, gameIds })}
            hint="When a host picks a tagged game, only those covers are shown."
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add image"}
            </Button>
          </div>
        </form>
      </Modal>
      <Confirm
        open={deleteTarget !== null}
        title="Delete this catalog entry?"
        message={`Remove "${deleteTarget?.name ?? ""}" from the database? The file on disk is not deleted.`}
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
