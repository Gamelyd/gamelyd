"use client";

import { useEffect, useState } from "react";
import { CatalogImage } from "@/components/ui/CatalogImage";
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
  deleteIconAction,
  saveIconFormAction,
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

function nameFromImageFile(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return base.replace(/\.[^.]+$/, "").trim();
}

export default function AdminImagesPage() {
  const toast = useToast();
  const [items, setItems] = useState<IconAsset[]>([]);
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [kind, setKind] = useState<IconKind | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IconAsset | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
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

  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetForm = (next: FormState) => {
    setForm(next);
    setFile(null);
  };

  const openCreate = () => {
    setEditing(null);
    resetForm({
      ...emptyForm,
      kind: kind === "all" ? "tournament" : kind,
    });
    setModalOpen(true);
  };

  const openEdit = (icon: IconAsset) => {
    setEditing(icon);
    resetForm({
      name: icon.name,
      url: icon.url,
      kind: icon.kind,
      gameIds: icon.gameIds,
    });
    setModalOpen(true);
  };

  const pickFile = (next: File | null) => {
    setFile(next);
    if (!next) return;
    setForm((prev) => ({
      ...prev,
      name: nameFromImageFile(next.name),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = new FormData();
    if (editing) data.set("icon_id", editing.icon_id);
    data.set("name", form.name);
    data.set("kind", form.kind);
    data.set("url", form.url);
    data.set("gameIds", JSON.stringify(form.gameIds));
    if (file) data.set("file", file);
    const result = await saveIconFormAction(data);
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
            Add, archive, or delete catalog entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            No catalog images yet. Add one to get started.
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
                  <CatalogImage
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
          <label className="block w-full">
            <span className="mb-1.5 block text-sm text-label">Image file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="w-full cursor-pointer rounded-lg border border-primary/25 bg-input px-4 py-3 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#04201e] hover:file:bg-primary/90"
            />
            <span className="mt-1 block text-xs text-body">
              Choosing a file fills the name from the filename. PNG, JPEG, WebP,
              or GIF, up to 6 MB.
            </span>
          </label>
          {filePreview || form.url ? (
            <div className="relative h-36 w-full overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePreview || form.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="EAFC"
          />
          <Input
            label="Image URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required={!file && !editing}
            placeholder="/api/icons/eafc"
          />
          {file ? (
            <p className="-mt-2 text-xs text-body">
              URL is not needed when you select a file. The upload sets it.
            </p>
          ) : null}
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
        message={`Remove "${deleteTarget?.name ?? ""}" from the catalog? This does not delete the image file.`}
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
