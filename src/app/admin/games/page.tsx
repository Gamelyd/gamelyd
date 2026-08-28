"use client";

import { CatalogImage } from "@/components/ui/CatalogImage";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import type { Game } from "@/lib/schemas/game";
import type { Platform } from "@/lib/schemas/platform";
import { IconPicker } from "@/components/ui/IconPicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FALLBACKS, iconForGame, resolveIcon } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";
import {
  adminListGamesAction,
  createGameAction,
  deleteGameAction,
  toggleGameActiveAction,
  updateGameAction,
} from "@/server/actions/gameActions";
import { getPlatformsAction } from "@/server/actions/platformActions";

interface FormState {
  name: string;
  image: string;
  platforms: string[];
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  image: "",
  platforms: [],
  active: true,
};

export default function AdminGamesPage() {
  const toast = useToast();
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const { icons: covers, loading: coversLoading } = useIcons("tournament");

  useEffect(() => {
    let activeReq = true;
    void Promise.all([adminListGamesAction(), getPlatformsAction()]).then(
      ([gamesResult, platformsResult]) => {
        if (!activeReq) return;
        if (gamesResult.ok) setGamesList(gamesResult.data);
        else toast.error(gamesResult.error);
        if (platformsResult.ok) setPlatformList(platformsResult.data);
        else toast.error(platformsResult.error);
        setLoading(false);
      },
    );
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

  const openEdit = (game: Game) => {
    setEditing(game);
    setForm({
      name: game.name,
      image: game.image,
      platforms: game.platforms,
      active: game.active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      image: form.image,
      platforms: form.platforms,
      active: form.active,
    };
    const result = editing
      ? await updateGameAction(editing.game_id, payload)
      : await createGameAction(payload);
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setModalOpen(false);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const toggleActive = async (game: Game) => {
    const result = await toggleGameActiveAction(game.game_id);
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
    const result = await deleteGameAction(deleteTarget.game_id);
    setDeleting(false);
    if (result.ok) {
      toast.success(result.message ?? "Deleted");
      setDeleteTarget(null);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const filtered = gamesList.filter((game) =>
    game.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-white">Games</h1>
        <Button onClick={openCreate}>Add game</Button>
      </div>

      {gamesList.length > 0 ? (
        <div className="mb-6 max-w-md">
          <Input
            placeholder="Search games by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search games by name"
          />
        </div>
      ) : null}

      {loading && gamesList.length === 0 ? (
        <p className="text-body">Loading…</p>
      ) : gamesList.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">
            No games yet. Add your first game so hosts can pick it when creating
            a tournament.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">No games match that name.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((game) => (
            <div
              key={game.game_id}
              className="overflow-hidden rounded-2xl border border-surface-2 bg-surface"
            >
              <div className="relative h-36 w-full bg-surface-2">
                {game.image ? (
                  <CatalogImage
                    src={resolveIcon(game.image, FALLBACKS.tournament)}
                    alt={game.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-body">
                    No image
                  </div>
                )}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    game.active
                      ? "bg-win-deep text-white"
                      : "bg-surface-3 text-body"
                  }`}
                >
                  {game.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-white">{game.name}</h3>
                {game.platforms.length > 0 && (
                  <p className="mt-1 text-xs text-body">
                    {game.platforms.join(" · ")}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => openEdit(game)}>
                    Edit
                  </Button>
                  <Button variant="dark" onClick={() => toggleActive(game)}>
                    {game.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteTarget(game)}>
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
        title={editing ? "Edit game" : "Add game"}
        width="max-w-xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm({
                ...form,
                name,
                image: form.image || iconForGame(name, covers),
              });
            }}
            required
          />
          <IconPicker
            label="Game image"
            icons={covers}
            value={form.image}
            onChange={(url) => setForm({ ...form, image: url })}
            loading={coversLoading}
          />
          <MultiSelect
            label="Platforms"
            options={platformList.map((p) => ({
              label: p.name,
              value: p.name,
            }))}
            value={form.platforms}
            onChange={(platforms) => setForm({ ...form, platforms })}
            hint={
              platformList.length === 0
                ? "Add platforms under Admin → Platforms first."
                : "Select every platform this game runs on."
            }
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
          <div className="sticky bottom-0 z-1 flex justify-end gap-3 bg-surface pt-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create game"}
            </Button>
          </div>
        </form>
      </Modal>
      <Confirm
        open={deleteTarget !== null}
        title="Delete this game?"
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
